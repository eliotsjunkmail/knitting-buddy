"use client";
import { useEffect, useRef, useCallback, useState } from "react";

interface Row { label: string; steps: string[]; note?: string; bbox?: { x: number; y: number; w: number; h: number } | null }
interface Progress { currentRow: number; currentStep: number; lastUsed: string }
interface Pattern { id: string; name: string; rows: Row[]; imageData?: string | null; progress?: Progress | null }

const SAVE_DEBOUNCE = 1500;

export default function PatternViewer({ pattern }: { pattern: Pattern }) {
  const [rows, setRows] = useState<Row[]>(pattern.rows as Row[]);
  const init = pattern.progress;

  const [currentRow,  setCurrentRow]  = useState(init?.currentRow  ?? 0);
  const [currentStep, setCurrentStep] = useState(init?.currentStep ?? 0);
  const [paperMode,   setPaperMode]   = useState(true);   // default: Page mode
  const [docMode,     setDocMode]     = useState(true);   // default: clean doc view (exact positions)
  const [zoom,  setZoom]  = useState(1);
  const [panX,  setPanX]  = useState(0);
  const [panY,  setPanY]  = useState(0);
  // Highlight position stored as % of image element dims — survives zoom/resize
  const [hlXPct, setHlXPct] = useState(5);
  const [hlYPct, setHlYPct] = useState(32); // start mid-page where row content typically lives
  const [hlWPct, setHlWPct] = useState(35);
  const [hlHPct, setHlHPct] = useState(7);
  const [hlHint, setHlHint] = useState(true); // disappears after first drag
  const [bboxDetecting, setBboxDetecting] = useState(false);
  const [bboxFailed, setBboxFailed] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [micActive,    setMicActive]    = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [lastCommand,  setLastCommand]  = useState("");

  const saveTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bboxFetchedRef   = useRef(false);
  const zoomRef          = useRef(zoom);
  const rowRef           = useRef(currentRow);
  const stepRef          = useRef(currentStep);
  const recognitionRef   = useRef<any>(null);
  const micActiveRef     = useRef(false);
  const touchStartX      = useRef<number | null>(null);
  const nextStepRef      = useRef<() => void>(() => {});
  const prevStepRef      = useRef<() => void>(() => {});
  const lastPinchDist    = useRef<number | null>(null);
  const lastPanPos       = useRef<{ x: number; y: number } | null>(null);
  const paperContainerRef = useRef<HTMLDivElement>(null);
  const stepsScrollRef   = useRef<HTMLDivElement>(null);
  const imgRef           = useRef<HTMLImageElement>(null);
  const docDivRef        = useRef<HTMLDivElement>(null);
  // Stores starting touch + starting hl percentage at drag onset
  const hlDragRef = useRef<{ sx: number; sy: number; shx: number; shy: number } | null>(null);

  rowRef.current  = currentRow;
  stepRef.current = currentStep;
  zoomRef.current = zoom;

  const totalRows  = rows.length;
  const rowData    = rows[currentRow] ?? { label: "", steps: [] };
  const totalSteps = rowData.steps.length;
  const isAtEnd    = currentRow === totalRows - 1 && currentStep === totalSteps - 1;
  const isAtStart  = currentRow === 0 && currentStep === 0;

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setMicSupported(!!SR);
  }, []);

  // Restore saved view mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("kb_view_mode");
    if (saved === "step") setPaperMode(false);
    // "page" or unset → stay in Page mode (already the default)
  }, []);

  // Prevent browser scroll/zoom in paper mode
  useEffect(() => {
    const el = paperContainerRef.current;
    if (!el || !paperMode) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, [paperMode]);

  // Keep current step chip visible
  useEffect(() => {
    if (!paperMode || !stepsScrollRef.current) return;
    const chip = stepsScrollRef.current.children[currentStep] as HTMLElement | undefined;
    chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentStep, paperMode]);

  useEffect(() => {
    if (zoom <= 1) { setPanX(0); setPanY(0); }
  }, [zoom]);

  function runBboxDetection() {
    bboxFetchedRef.current = true;
    setBboxDetecting(true);
    setBboxFailed(false);
    fetch(`/api/patterns/${pattern.id}/detect-bboxes`, { method: "POST" })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.rows)) {
          setRows(data.rows as Row[]);
          const hasAny = (data.rows as Row[]).some(r => r.bbox != null);
          if (!hasAny) { setBboxFailed(true); bboxFetchedRef.current = false; }
        }
      })
      .catch(() => { setBboxFailed(true); bboxFetchedRef.current = false; })
      .finally(() => setBboxDetecting(false));
  }

  // Detect row positions the first time Paper mode is opened for a pattern with no bboxes,
  // or when existing bboxes look wrong (all clustered in the top 55% = typical bad detection).
  useEffect(() => {
    if (!paperMode || !pattern.imageData || bboxFetchedRef.current) return;
    const validBboxes = rows.map(r => r.bbox).filter(Boolean) as { y: number }[];
    const hasBboxes = validBboxes.length > 0;
    if (hasBboxes) {
      const ys = validBboxes.map(b => b.y);
      const yRange = Math.max(...ys) - Math.min(...ys);
      // If the bboxes only span < 15% of image height, they're bunched together — bad detection
      const looksWrong = rows.length > 3 && yRange < 0.15;
      if (!looksWrong) return;
    }
    runBboxDetection();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperMode]);

  // Auto-snap highlight + zoom to current row's bbox when navigating in paper mode
  useEffect(() => {
    if (!paperMode) return;
    const bbox = rows[currentRow]?.bbox;
    if (!bbox) return;
    setHlXPct(bbox.x * 100);
    setHlYPct(bbox.y * 100);
    setHlWPct(bbox.w * 100);
    setHlHPct(bbox.h * 100);
    if (imgRef.current) {
      const imgH = imgRef.current.offsetHeight;
      if (imgH > 0) {
        const rowCenterY = bbox.y + bbox.h / 2;
        setPanY(zoomRef.current * imgH * (0.5 - rowCenterY));
      }
    }
  }, [currentRow, paperMode, rows]);

  // Doc-view auto-pan: centre current row using exact DOM measurements.
  // children[0] = title div, children[i+1] = row i
  useEffect(() => {
    if (!paperMode || !docMode) return;
    const docEl = docDivRef.current;
    if (!docEl) return;
    const docH = docEl.offsetHeight;
    if (!docH) return;
    const rowEl = docEl.children[currentRow + 1] as HTMLElement | undefined;
    if (!rowEl) return;
    const rowFrac = (rowEl.offsetTop + rowEl.offsetHeight / 2) / docH;
    const z = zoomRef.current;
    setPanX(0);
    setPanY(z * docH * (0.5 - rowFrac));
  }, [currentRow, paperMode, docMode]);

  const scheduleSave = useCallback((r: number, s: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/patterns/${pattern.id}/progress`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentRow: r, currentStep: s }),
        });
      } finally { setSaving(false); }
    }, SAVE_DEBOUNCE);
  }, [pattern.id]);

  const navigate = useCallback((r: number, s: number) => {
    setCurrentRow(r); setCurrentStep(s); scheduleSave(r, s);
  }, [scheduleSave]);

  function nextStep() {
    if (currentStep < totalSteps - 1) navigate(currentRow, currentStep + 1);
    else if (currentRow < totalRows - 1) navigate(currentRow + 1, 0);
  }
  function prevStep() {
    if (currentStep > 0) navigate(currentRow, currentStep - 1);
    else if (currentRow > 0) navigate(currentRow - 1, (rows[currentRow - 1]?.steps?.length ?? 1) - 1);
  }
  function nextRow() { if (currentRow < totalRows - 1) navigate(currentRow + 1, 0); }
  function prevRow() { if (currentRow > 0) navigate(currentRow - 1, 0); }
  function restart() { navigate(0, 0); }

  nextStepRef.current = nextStep;
  prevStepRef.current = prevStep;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") nextStep();
      else if (e.key === "ArrowLeft") prevStep();
      else if (e.key === "ArrowDown") nextRow();
      else if (e.key === "ArrowUp") prevRow();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true; recognition.interimResults = false; recognition.lang = "en-US";
    recognition.onresult = (e: any) => {
      const t = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
      if (t.includes("next row")) { nextRow(); setLastCommand("next row"); }
      else if (t.includes("prev row") || t.includes("previous row")) { prevRow(); setLastCommand("prev row"); }
      else if (t.includes("knit next") || t.includes("next")) { nextStepRef.current(); setLastCommand("next"); }
      else if (t.includes("knit previous") || t.includes("previous") || t.includes("back") || t.includes("prev")) { prevStepRef.current(); setLastCommand("previous"); }
    };
    recognition.onend = () => { if (micActiveRef.current) { try { recognition.start(); } catch {} } };
    recognition.onerror = (e: any) => { if (e.error === "not-allowed") { micActiveRef.current = false; setMicActive(false); } };
    recognitionRef.current = recognition; micActiveRef.current = true; setMicActive(true); setLastCommand("");
    try { recognition.start(); } catch {}
  }
  function stopListening() {
    micActiveRef.current = false; setMicActive(false); setLastCommand("");
    try { recognitionRef.current?.stop(); } catch {}
  }

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) { dx < 0 ? nextStep() : prevStep(); }
    touchStartX.current = null;
  }

  // Image pan / pinch-zoom
  function onPaperTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
      lastPanPos.current = null;
    } else if (e.touches.length === 1) {
      lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastPinchDist.current = null;
    }
  }
  function onPaperTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setZoom(z => Math.min(6, Math.max(1, z * d / lastPinchDist.current!)));
      lastPinchDist.current = d;
    } else if (e.touches.length === 1 && lastPanPos.current) {
      setPanX(x => x + e.touches[0].clientX - lastPanPos.current!.x);
      setPanY(y => y + e.touches[0].clientY - lastPanPos.current!.y);
      lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }
  function onPaperTouchEnd() { lastPinchDist.current = null; lastPanPos.current = null; }

  // Highlight drag — position in image-element %, divides screen delta by zoom
  function onHLTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
    setHlHint(false);
    hlDragRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, shx: hlXPct, shy: hlYPct };
  }
  function onHLTouchMove(e: React.TouchEvent) {
    e.stopPropagation();
    if (!hlDragRef.current || !imgRef.current) return;
    const imgW = imgRef.current.offsetWidth;
    const imgH = imgRef.current.offsetHeight;
    if (!imgW || !imgH) return;
    const pctDx = ((e.touches[0].clientX - hlDragRef.current.sx) / zoom / imgW) * 100;
    const pctDy = ((e.touches[0].clientY - hlDragRef.current.sy) / zoom / imgH) * 100;
    setHlXPct(Math.max(0, Math.min(100 - hlWPct, hlDragRef.current.shx + pctDx)));
    setHlYPct(Math.max(0, Math.min(100 - hlHPct, hlDragRef.current.shy + pctDy)));
  }
  function onHLTouchEnd(e: React.TouchEvent) { e.stopPropagation(); hlDragRef.current = null; }

  function zoomIn()    { setZoom(z => Math.min(6, z * 1.4)); }
  function zoomOut()   { setZoom(z => { const n = z / 1.4; return n < 1.1 ? 1 : n; }); }
  function zoomReset() { setZoom(1); setPanX(0); setPanY(0); }

  const overallPct = totalRows > 0
    ? ((currentRow + (currentStep + 1) / (totalSteps || 1)) / totalRows) * 100
    : 0;
  const prevStepText = currentStep > 0 ? rowData.steps[currentStep - 1] : currentRow > 0 ? rows[currentRow - 1]?.steps?.at(-1) : null;
  const nextStepText = currentStep < totalSteps - 1 ? rowData.steps[currentStep + 1] : currentRow < totalRows - 1 ? rows[currentRow + 1]?.steps?.[0] : null;
  const prevRowLabel = currentStep > 0 ? rowData.label : currentRow > 0 ? rows[currentRow - 1]?.label : null;
  const nextRowLabel = currentStep < totalSteps - 1 ? rowData.label : currentRow < totalRows - 1 ? rows[currentRow + 1]?.label : null;
  const hasPaper = !!pattern.imageData;
  const hasPaperOrRows = hasPaper || rows.length > 0; // doc view works for all patterns

  // ── Shared header ─────────────────────────────────────────────────────────
  const header = (
    <div style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", flexShrink: 0, zIndex: 20, boxShadow: "0 4px 20px rgba(76,29,149,0.3)" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0 1rem", height: "56px", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <a href="/dashboard" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "1.25rem", lineHeight: 1, padding: "0.25rem" }}>←</a>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pattern.name}</div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.72rem" }}>
            Row {currentRow + 1}/{totalRows} · Step {currentStep + 1}/{totalSteps}
            {saving && <span style={{ marginLeft: "0.5rem", opacity: 0.7 }}>saving…</span>}
          </div>
        </div>
        {hasPaperOrRows && (
          <div style={{ display: "flex", background: "rgba(0,0,0,0.28)", borderRadius: "20px", padding: "3px", gap: "2px" }}>
            <button onClick={() => { setZoom(1); setPanX(0); setPanY(0); setDocMode(true); setPaperMode(true); localStorage.setItem("kb_view_mode", "page"); }}
              style={{ padding: "5px 12px", borderRadius: "16px", background: paperMode ? "white" : "transparent", color: paperMode ? "#4c1d95" : "rgba(255,255,255,0.75)", border: "none", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
              Page
            </button>
            <button onClick={() => { setPaperMode(false); localStorage.setItem("kb_view_mode", "step"); }}
              style={{ padding: "5px 12px", borderRadius: "16px", background: !paperMode ? "white" : "transparent", color: !paperMode ? "#4c1d95" : "rgba(255,255,255,0.75)", border: "none", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
              Step
            </button>
          </div>
        )}
      </div>
      <div style={{ height: "3px", background: "rgba(255,255,255,0.2)" }}>
        <div style={{ height: "100%", width: `${overallPct}%`, background: "rgba(255,255,255,0.9)", transition: "width 0.4s" }} />
      </div>
    </div>
  );

  // ── Paper mode ────────────────────────────────────────────────────────────
  if (paperMode) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#111" }}>
        {header}

        {/* Content area */}
        <div
          ref={paperContainerRef}
          onTouchStart={onPaperTouchStart}
          onTouchMove={onPaperTouchMove}
          onTouchEnd={onPaperTouchEnd}
          style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
        >
          {/* Transform group */}
          <div style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: "center center",
            display: "inline-block",
            position: "relative",
            ...(docMode ? {} : { maxWidth: "100%", maxHeight: "100%", lineHeight: 0 }),
          }}>

            {docMode ? (
              /* ── Doc view: clean text rendering with exact row positions ── */
              <div
                ref={docDivRef}
                style={{ width: "100vw", background: "white", padding: "20px 14px 40px", fontFamily: "ui-monospace, 'Courier New', monospace" }}
              >
                <div style={{ fontWeight: 700, color: "#4c1d95", fontSize: "15px", textAlign: "center", marginBottom: "14px", fontFamily: "system-ui, sans-serif" }}>
                  {pattern.name}
                </div>
                {rows.map((row, i) => {
                  const isCurrent = i === currentRow;
                  const isDone = i < currentRow;
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "6px 10px",
                        margin: "1px 0",
                        border: `${1 / zoom}px solid ${isCurrent ? "#dc2626" : "transparent"}`,
                        borderRadius: `${3 / zoom}px`,
                        background: isCurrent ? "rgba(255,255,210,0.6)" : "transparent",
                        opacity: isDone ? 0.38 : 1,
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#1e1b4b", fontSize: "15px", textDecoration: isDone ? "line-through" : "none" }}>
                        {row.label}:
                      </span>{" "}
                      {isCurrent ? (
                        // Current row: render each step individually so we can highlight the active one
                        row.steps.map((step, si) => {
                          const isActiveStep = si === currentStep;
                          const isPastStep   = si < currentStep;
                          return (
                            <span key={si} style={{
                              fontSize: "15px",
                              fontWeight: isActiveStep ? 700 : 400,
                              color: isActiveStep ? "#16a34a" : isPastStep ? "#9ca3af" : "#374151",
                              textDecoration: isPastStep ? "line-through" : "none",
                            }}>
                              {step}{si < row.steps.length - 1 ? ", " : ""}
                            </span>
                          );
                        })
                      ) : (
                        <span style={{ color: "#374151", fontSize: "15px", textDecoration: isDone ? "line-through" : "none" }}>
                          {row.steps.join(", ")}
                        </span>
                      )}
                      {row.note && <div style={{ fontSize: "12px", color: "#6b7280", fontStyle: "italic", marginTop: "2px" }}>{row.note}</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── Photo view: original image + draggable highlight ── */
              <>
                <img
                  ref={imgRef}
                  src={pattern.imageData!}
                  alt="Pattern"
                  draggable={false}
                  style={{ display: "block", maxWidth: "100%", maxHeight: "100%", userSelect: "none", touchAction: "none", pointerEvents: "none" }}
                />
                <div
                  onTouchStart={onHLTouchStart}
                  onTouchMove={onHLTouchMove}
                  onTouchEnd={onHLTouchEnd}
                  style={{
                    position: "absolute",
                    left: `${hlXPct}%`, top: `${hlYPct}%`,
                    width: `${hlWPct}%`, height: `${hlHPct}%`,
                    border: `${1 / zoom}px solid #dc2626`,
                    borderRadius: `${2 / zoom}px`,
                    background: "rgba(255,255,210,0.10)",
                    cursor: "move", touchAction: "none", boxSizing: "border-box", zIndex: 2,
                  }}
                >
                  {hlHint && !rows[currentRow]?.bbox && (
                    <div style={{ position: "absolute", top: "100%", left: 0, marginTop: `${3/zoom}px`, fontSize: `${11/zoom}px`, lineHeight: 1.3, color: "white", background: "rgba(220,38,38,0.82)", padding: `${2/zoom}px ${5/zoom}px`, borderRadius: `${3/zoom}px`, whiteSpace: "nowrap", pointerEvents: "none" }}>
                      drag to your current row
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Photo / Doc toggle — only shown when image exists */}
          {hasPaper && (
            <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)", borderRadius: "20px", padding: "3px", display: "flex", gap: "2px", zIndex: 10 }}>
              <button onClick={() => { setDocMode(true); setZoom(1); setPanX(0); setPanY(0); }}
                style={{ padding: "4px 12px", borderRadius: "16px", background: docMode ? "white" : "transparent", color: docMode ? "#4c1d95" : "rgba(255,255,255,0.75)", border: "none", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>
                Doc
              </button>
              <button onClick={() => { setDocMode(false); setZoom(1); setPanX(0); setPanY(0); }}
                style={{ padding: "4px 12px", borderRadius: "16px", background: !docMode ? "white" : "transparent", color: !docMode ? "#4c1d95" : "rgba(255,255,255,0.75)", border: "none", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>
                Photo
              </button>
            </div>
          )}

          {/* Photo-mode: bbox detection overlays */}
          {!docMode && bboxDetecting && (
            <div style={{ position: "absolute", bottom: 44, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.65)", color: "white", fontSize: "0.72rem", padding: "0.3rem 0.8rem", borderRadius: "99px", zIndex: 10, whiteSpace: "nowrap", pointerEvents: "none" }}>
              Locating rows…
            </div>
          )}
          {!docMode && bboxFailed && !bboxDetecting && (
            <div style={{ position: "absolute", bottom: 44, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.72)", color: "white", fontSize: "0.72rem", padding: "0.3rem 0.8rem", borderRadius: "99px", zIndex: 10, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>Could not locate rows</span>
              <button onClick={runBboxDetection} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: "4px", padding: "0.1rem 0.4rem", cursor: "pointer", fontSize: "0.72rem" }}>Retry</button>
            </div>
          )}

          {/* Floating zoom controls */}
          <div style={{ position: "absolute", top: 8, right: 10, display: "flex", flexDirection: "column", gap: "4px", zIndex: 10 }}>
            <button onClick={zoomIn}    style={zoomBtnStyle}>+</button>
            <button onClick={zoomReset} style={{ ...zoomBtnStyle, fontSize: "0.62rem", fontWeight: 600, width: "auto", padding: "0 6px", minWidth: "32px" }}>{Math.round(zoom * 10) / 10}×</button>
            <button onClick={zoomOut}   style={zoomBtnStyle}>−</button>
          </div>
        </div>

        {/* Step strip — always visible, outside image area */}
        <div style={{ background: "#1a1a2e", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ padding: "0.35rem 0.75rem 0", fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {rowData.label}
          </div>
          <div ref={stepsScrollRef} style={{ display: "flex", gap: "0.3rem", overflowX: "auto", padding: "0.3rem 0.75rem 0.5rem", scrollbarWidth: "none" }}>
            {rowData.steps.map((step, i) => {
              const isDone    = i < currentStep;
              const isCurrent = i === currentStep;
              return (
                <button key={i} onClick={() => navigate(currentRow, i)} style={{
                  flexShrink: 0,
                  padding: "0.25rem 0.5rem",
                  borderRadius: "5px",
                  fontSize: "0.76rem",
                  fontFamily: "monospace",
                  fontWeight: isCurrent ? 700 : 400,
                  background: isCurrent ? "white" : isDone ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.15)",
                  color: isCurrent ? "#dc2626" : isDone ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.82)",
                  border: isCurrent ? "1px solid #dc2626" : "1px solid transparent",
                  textDecoration: isDone ? "line-through" : "none",
                  cursor: "pointer",
                  boxShadow: isCurrent ? "0 0 0 2px rgba(220,38,38,0.25)" : "none",
                }}>{step}</button>
              );
            })}
          </div>
        </div>

        {/* Nav buttons */}
        <div style={{ background: "#1a1a2e", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div style={{ padding: "0.5rem 0.75rem 0.5rem" }}>
            {micActive && lastCommand && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.375rem" }}>
                <span style={{ fontSize: "0.72rem", color: "#a78bfa", background: "rgba(167,139,250,0.12)", padding: "0.2rem 0.65rem", borderRadius: "99px" }}>heard: {lastCommand}</span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: micSupported ? "1fr auto 1fr" : "1fr 1fr", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <button onClick={prevStep} disabled={isAtStart} style={{ padding: "0.75rem", background: isAtStart ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)", color: isAtStart ? "rgba(255,255,255,0.25)" : "white", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 600, cursor: isAtStart ? "not-allowed" : "pointer", opacity: isAtStart ? 0.5 : 1 }}>
                ← Prev
              </button>
              {micSupported && (
                <button onClick={micActive ? stopListening : startListening} style={{ width: "52px", padding: "0.75rem 0", background: micActive ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "rgba(255,255,255,0.08)", color: "white", border: micActive ? "none" : "1px solid rgba(255,255,255,0.15)", borderRadius: "10px", fontSize: "1.25rem", cursor: "pointer", boxShadow: micActive ? "0 0 0 3px rgba(124,58,237,0.35)" : "none", transition: "all 0.2s" }}>🎤</button>
              )}
              <button onClick={isAtEnd ? restart : nextStep} style={{ padding: "0.75rem", background: isAtEnd ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "white", border: "none", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: isAtEnd ? "0 4px 12px rgba(220,38,38,0.35)" : "0 4px 12px rgba(124,58,237,0.3)" }}>
                {isAtEnd ? "↺ Restart" : "Next →"}
              </button>
            </div>
            <button onClick={restart} disabled={isAtStart} style={{ width: "100%", padding: "0.4rem", background: "transparent", color: isAtStart ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.38)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 500, cursor: isAtStart ? "not-allowed" : "pointer", letterSpacing: "0.02em" }}>
              ↺ Restart from beginning
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step mode ─────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100dvh", overflow: "hidden", background: "#f8f7ff", display: "flex", flexDirection: "column" }}>
      {header}

      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem 1.25rem", gap: "1.25rem", userSelect: "none" }}>

        <div style={{ textAlign: "center", opacity: 0.35, minHeight: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {prevStepText && (
            <><div style={{ fontSize: "0.65rem", color: "#8b5cf6", marginBottom: "0.2rem" }}>{prevRowLabel}</div>
              <div style={{ fontSize: "1rem", fontFamily: "monospace", color: "#6d28d9" }}>{prevStepText}</div></>
          )}
        </div>

        <div style={{ width: "100%", maxWidth: "480px", background: "white", borderRadius: "20px", boxShadow: "0 8px 32px rgba(124,58,237,0.18)", border: "2px solid #7c3aed", padding: "2rem 1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
            {rowData.label}
            {rowData.note && <div style={{ textTransform: "none", fontWeight: 400, fontStyle: "italic", marginTop: "0.25rem" }}>{rowData.note}</div>}
          </div>
          {isAtEnd ? (
            <>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎉</div>
              <div style={{ fontSize: "clamp(1.25rem, 5vw, 1.75rem)", fontWeight: 800, color: "#4c1d95", lineHeight: 1.3 }}>Pattern complete!</div>
              <button onClick={restart} style={{ marginTop: "1.25rem", padding: "0.75rem 1.5rem", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "white", border: "none", borderRadius: "10px", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(124,58,237,0.3)", fontFamily: "inherit" }}>
                ↺ Start over
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: "clamp(1.75rem, 6vw, 2.5rem)", fontWeight: 800, color: "#4c1d95", fontFamily: "monospace", lineHeight: 1.2, wordBreak: "break-word" }}>
                {rowData.steps[currentStep] ?? "—"}
              </div>
              <div style={{ marginTop: "1rem", fontSize: "0.78rem", color: "#c4b5fd" }}>step {currentStep + 1} of {totalSteps}</div>
            </>
          )}
        </div>

        <div style={{ textAlign: "center", opacity: 0.35, minHeight: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {nextStepText && (
            <><div style={{ fontSize: "0.65rem", color: "#8b5cf6", marginBottom: "0.2rem" }}>{nextRowLabel}</div>
              <div style={{ fontSize: "1rem", fontFamily: "monospace", color: "#6d28d9" }}>{nextStepText}</div></>
          )}
        </div>
      </div>

      <div style={{ background: "white", borderTop: "1px solid #ede9fe", boxShadow: "0 -8px 24px rgba(109,40,217,0.08)", flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0.75rem 1rem" }}>
          {micActive && lastCommand && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.625rem" }}>
              <span style={{ fontSize: "0.72rem", color: "#7c3aed", background: "#f5f3ff", padding: "0.25rem 0.75rem", borderRadius: "99px" }}>heard: {lastCommand}</span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: micSupported ? "1fr auto 1fr" : "1fr 1fr", gap: "0.625rem", marginBottom: "0.5rem" }}>
            <button onClick={prevStep} disabled={isAtStart} style={{ padding: "0.875rem", background: "white", color: "#7c3aed", border: "2px solid #ede9fe", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 600, cursor: isAtStart ? "not-allowed" : "pointer", opacity: isAtStart ? 0.4 : 1 }}>← Prev</button>
            {micSupported && (
              <button onClick={micActive ? stopListening : startListening} style={{ width: "52px", padding: "0.875rem 0", background: micActive ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "#f5f3ff", color: micActive ? "white" : "#7c3aed", border: micActive ? "none" : "2px solid #ede9fe", borderRadius: "10px", fontSize: "1.25rem", cursor: "pointer", boxShadow: micActive ? "0 0 0 4px rgba(124,58,237,0.2)" : "none", transition: "all 0.2s" }}>🎤</button>
            )}
            <button onClick={isAtEnd ? restart : nextStep} style={{ padding: "0.875rem", background: isAtEnd ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "white", border: "none", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: isAtEnd ? "0 4px 12px rgba(220,38,38,0.3)" : "0 4px 12px rgba(124,58,237,0.3)" }}>{isAtEnd ? "↺ Restart" : "Next →"}</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.625rem" }}>
            <button onClick={prevRow} disabled={currentRow === 0} style={{ padding: "0.5rem", background: "transparent", color: "#a78bfa", border: "1px solid #ede9fe", borderRadius: "8px", fontSize: "0.8rem", cursor: currentRow === 0 ? "not-allowed" : "pointer", opacity: currentRow === 0 ? 0.4 : 1 }}>↑ Prev Row</button>
            <button onClick={restart} disabled={isAtStart} style={{ padding: "0.5rem", background: "transparent", color: "#a78bfa", border: "1px solid #ede9fe", borderRadius: "8px", fontSize: "0.8rem", cursor: isAtStart ? "not-allowed" : "pointer", opacity: isAtStart ? 0.3 : 1 }}>↺ Restart</button>
            <button onClick={nextRow} disabled={currentRow === totalRows - 1} style={{ padding: "0.5rem", background: "transparent", color: "#a78bfa", border: "1px solid #ede9fe", borderRadius: "8px", fontSize: "0.8rem", cursor: currentRow === totalRows - 1 ? "not-allowed" : "pointer", opacity: currentRow === totalRows - 1 ? 0.4 : 1 }}>↓ Next Row</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: "32px", height: "32px",
  background: "rgba(0,0,0,0.55)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: "7px",
  color: "white",
  fontSize: "1.05rem",
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
