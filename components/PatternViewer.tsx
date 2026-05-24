"use client";
import { useEffect, useRef, useCallback, useState } from "react";

interface Row { label: string; steps: string[]; note?: string }
interface Progress { currentRow: number; currentStep: number; lastUsed: string }
interface Pattern { id: string; name: string; rows: Row[]; imageData?: string | null; progress?: Progress | null }

const SAVE_DEBOUNCE = 1500;
const HL_W = 220;
const HL_H = 44;

export default function PatternViewer({ pattern }: { pattern: Pattern }) {
  const rows = pattern.rows as Row[];
  const init = pattern.progress;

  const [currentRow, setCurrentRow] = useState(init?.currentRow ?? 0);
  const [currentStep, setCurrentStep] = useState(init?.currentStep ?? 0);
  const [paperMode, setPaperMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [hlX, setHlX] = useState(20);
  const [hlY, setHlY] = useState(80);
  const [saving, setSaving] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [lastCommand, setLastCommand] = useState("");

  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef       = useRef(currentRow);
  const stepRef      = useRef(currentStep);
  const recognitionRef  = useRef<any>(null);
  const micActiveRef    = useRef(false);
  const touchStartX     = useRef<number | null>(null);
  const nextStepRef     = useRef<() => void>(() => {});
  const prevStepRef     = useRef<() => void>(() => {});
  const lastPinchDist   = useRef<number | null>(null);
  const lastPanPos      = useRef<{ x: number; y: number } | null>(null);
  const paperContainerRef = useRef<HTMLDivElement>(null);
  const stepsScrollRef    = useRef<HTMLDivElement>(null);
  const hlDragRef = useRef<{ sx: number; sy: number; shx: number; shy: number } | null>(null);

  rowRef.current  = currentRow;
  stepRef.current = currentStep;

  const totalRows = rows.length;
  const rowData   = rows[currentRow] ?? { label: "", steps: [] };
  const totalSteps = rowData.steps.length;
  const isAtEnd   = currentRow === totalRows - 1 && currentStep === totalSteps - 1;
  const isAtStart = currentRow === 0 && currentStep === 0;

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setMicSupported(!!SR);
  }, []);

  // Prevent native scroll/zoom inside paper mode container
  useEffect(() => {
    const el = paperContainerRef.current;
    if (!el || !paperMode) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, [paperMode]);

  // Scroll current step chip into view
  useEffect(() => {
    if (!paperMode || !stepsScrollRef.current) return;
    const chip = stepsScrollRef.current.children[currentStep] as HTMLElement | undefined;
    chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentStep, paperMode]);

  // Reset pan when zoom bottoms out
  useEffect(() => {
    if (zoom <= 1) { setPanX(0); setPanY(0); }
  }, [zoom]);

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
    setCurrentRow(r);
    setCurrentStep(s);
    scheduleSave(r, s);
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
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e: any) => {
      const t = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
      if (t.includes("next row")) { nextRow(); setLastCommand("next row"); }
      else if (t.includes("prev row") || t.includes("previous row")) { prevRow(); setLastCommand("prev row"); }
      else if (t.includes("next") || t.includes("forward")) { nextStepRef.current(); setLastCommand("next step"); }
      else if (t.includes("back") || t.includes("prev") || t.includes("previous")) { prevStepRef.current(); setLastCommand("prev step"); }
    };
    recognition.onend = () => { if (micActiveRef.current) { try { recognition.start(); } catch {} } };
    recognition.onerror = (e: any) => { if (e.error === "not-allowed") { micActiveRef.current = false; setMicActive(false); } };
    recognitionRef.current = recognition;
    micActiveRef.current = true;
    setMicActive(true);
    setLastCommand("");
    try { recognition.start(); } catch {}
  }
  function stopListening() {
    micActiveRef.current = false;
    setMicActive(false);
    setLastCommand("");
    try { recognitionRef.current?.stop(); } catch {}
  }

  // Step mode swipe
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) { dx < 0 ? nextStep() : prevStep(); }
    touchStartX.current = null;
  }

  // Paper mode: image pan/pinch
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
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      setZoom(z => Math.min(6, Math.max(1, z * d / lastPinchDist.current!)));
      lastPinchDist.current = d;
    } else if (e.touches.length === 1 && lastPanPos.current) {
      const dx = e.touches[0].clientX - lastPanPos.current.x;
      const dy = e.touches[0].clientY - lastPanPos.current.y;
      setPanX(x => x + dx);
      setPanY(y => y + dy);
      lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }
  function onPaperTouchEnd() { lastPinchDist.current = null; lastPanPos.current = null; }

  // Highlight box drag (stopPropagation keeps pan from firing)
  function onHLTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
    hlDragRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, shx: hlX, shy: hlY };
  }
  function onHLTouchMove(e: React.TouchEvent) {
    e.stopPropagation();
    if (!hlDragRef.current || !paperContainerRef.current) return;
    const dx = e.touches[0].clientX - hlDragRef.current.sx;
    const dy = e.touches[0].clientY - hlDragRef.current.sy;
    const { width, height } = paperContainerRef.current.getBoundingClientRect();
    setHlX(Math.max(0, Math.min(width  - HL_W, hlDragRef.current.shx + dx)));
    setHlY(Math.max(0, Math.min(height - HL_H, hlDragRef.current.shy + dy)));
  }
  function onHLTouchEnd(e: React.TouchEvent) { e.stopPropagation(); hlDragRef.current = null; }

  function zoomIn()    { setZoom(z => Math.min(6, z * 1.4)); }
  function zoomOut()   { setZoom(z => { const n = z / 1.4; return n < 1.1 ? 1 : n; }); }
  function zoomReset() { setZoom(1); setPanX(0); setPanY(0); }

  const overallPct = totalRows > 0 ? ((currentRow + (currentStep + 1) / (totalSteps || 1)) / totalRows) * 100 : 0;
  const prevStepText = currentStep > 0 ? rowData.steps[currentStep - 1] : currentRow > 0 ? rows[currentRow - 1]?.steps?.at(-1) : null;
  const nextStepText = currentStep < totalSteps - 1 ? rowData.steps[currentStep + 1] : currentRow < totalRows - 1 ? rows[currentRow + 1]?.steps?.[0] : null;
  const prevRowLabel = currentStep > 0 ? rowData.label : currentRow > 0 ? rows[currentRow - 1]?.label : null;
  const nextRowLabel = currentStep < totalSteps - 1 ? rowData.label : currentRow < totalRows - 1 ? rows[currentRow + 1]?.label : null;

  const hasPaper = !!pattern.imageData;

  return (
    <div style={{ minHeight: "100vh", background: paperMode ? "#111" : "#f8f7ff", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", position: "sticky", top: 0, zIndex: 20, boxShadow: "0 4px 20px rgba(76,29,149,0.3)", flexShrink: 0 }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0 1rem", height: "60px", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <a href="/dashboard" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "1.25rem", lineHeight: 1, padding: "0.25rem" }}>←</a>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pattern.name}</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.72rem" }}>
              Row {currentRow + 1}/{totalRows} · Step {currentStep + 1}/{totalSteps}
              {saving && <span style={{ marginLeft: "0.5rem", opacity: 0.7 }}>saving…</span>}
            </div>
          </div>

          {/* Step / Paper toggle */}
          {hasPaper && (
            <div style={{ display: "flex", background: "rgba(0,0,0,0.25)", borderRadius: "20px", padding: "3px", gap: "2px" }}>
              <button
                onClick={() => setPaperMode(false)}
                style={{ padding: "5px 12px", borderRadius: "16px", background: !paperMode ? "white" : "transparent", color: !paperMode ? "#4c1d95" : "rgba(255,255,255,0.75)", border: "none", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", transition: "all 0.18s" }}>
                Step
              </button>
              <button
                onClick={() => { setZoom(1); setPanX(0); setPanY(0); setPaperMode(true); }}
                style={{ padding: "5px 12px", borderRadius: "16px", background: paperMode ? "white" : "transparent", color: paperMode ? "#4c1d95" : "rgba(255,255,255,0.75)", border: "none", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", transition: "all 0.18s" }}>
                Paper
              </button>
            </div>
          )}
        </div>
        <div style={{ height: "3px", background: "rgba(255,255,255,0.2)" }}>
          <div style={{ height: "100%", width: `${overallPct}%`, background: "rgba(255,255,255,0.9)", transition: "width 0.4s" }} />
        </div>
      </div>

      {/* ── Paper mode body ── */}
      {paperMode && hasPaper ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Zoom bar */}
          <div style={{ background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.375rem 1rem", flexShrink: 0 }}>
            <button onClick={zoomOut} style={{ width: "30px", height: "30px", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "6px", color: "white", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}>−</button>
            <button onClick={zoomReset} style={{ height: "30px", padding: "0 0.75rem", background: zoom !== 1 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)", border: "none", borderRadius: "6px", color: "white", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", minWidth: "44px" }}>{Math.round(zoom * 10) / 10}×</button>
            <button onClick={zoomIn}  style={{ width: "30px", height: "30px", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "6px", color: "white", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}>+</button>
          </div>

          {/* Image + highlight */}
          <div
            ref={paperContainerRef}
            onTouchStart={onPaperTouchStart}
            onTouchMove={onPaperTouchMove}
            onTouchEnd={onPaperTouchEnd}
            style={{ flex: 1, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}
          >
            <img
              src={pattern.imageData!}
              alt="Pattern"
              draggable={false}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                display: "block",
                objectFit: "contain",
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                transformOrigin: "center center",
                userSelect: "none",
                touchAction: "none",
                pointerEvents: "none",
              }}
            />

            {/* Draggable highlight box */}
            <div
              onTouchStart={onHLTouchStart}
              onTouchMove={onHLTouchMove}
              onTouchEnd={onHLTouchEnd}
              style={{
                position: "absolute",
                left: hlX,
                top: hlY,
                width: HL_W,
                height: HL_H,
                border: "2.5px solid #dc2626",
                borderRadius: "6px",
                background: "rgba(255, 252, 150, 0.38)",
                boxShadow: "0 0 0 1.5px rgba(220,38,38,0.45), 0 2px 10px rgba(0,0,0,0.35)",
                cursor: "move",
                touchAction: "none",
                zIndex: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "0 6px",
              }}
            >
              {/* drag handle dots */}
              <span style={{ fontSize: "0.9rem", color: "rgba(220,38,38,0.55)", pointerEvents: "none", letterSpacing: "-1px" }}>⠿</span>
            </div>

            {/* Step strip */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)", paddingBottom: "0.625rem", paddingTop: "2rem", zIndex: 10 }}>
              <div style={{ paddingLeft: "0.75rem", marginBottom: "0.35rem", fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {rowData.label}
              </div>
              <div ref={stepsScrollRef} style={{ display: "flex", gap: "0.35rem", overflowX: "auto", padding: "0 0.75rem", scrollbarWidth: "none" }}>
                {rowData.steps.map((step, i) => {
                  const isDone    = i < currentStep;
                  const isCurrent = i === currentStep;
                  return (
                    <button key={i} onClick={() => navigate(currentRow, i)} style={{
                      flexShrink: 0,
                      padding: "0.28rem 0.55rem",
                      borderRadius: "6px",
                      fontSize: "0.77rem",
                      fontFamily: "monospace",
                      fontWeight: isCurrent ? 700 : 400,
                      background: isCurrent ? "white" : isDone ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.18)",
                      color: isCurrent ? "#dc2626" : isDone ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.82)",
                      border: isCurrent ? "2px solid #dc2626" : "2px solid transparent",
                      textDecoration: isDone ? "line-through" : "none",
                      cursor: "pointer",
                      boxShadow: isCurrent ? "0 0 0 3px rgba(220,38,38,0.28)" : "none",
                    }}>{step}</button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Step mode body ── */
        <div
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem 1.25rem", gap: "1.25rem", userSelect: "none" }}>

          <div style={{ textAlign: "center", opacity: 0.35, minHeight: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            {prevStepText && (
              <>
                <div style={{ fontSize: "0.65rem", color: "#8b5cf6", marginBottom: "0.2rem" }}>{prevRowLabel}</div>
                <div style={{ fontSize: "1rem", fontFamily: "monospace", color: "#6d28d9" }}>{prevStepText}</div>
              </>
            )}
          </div>

          <div style={{ width: "100%", maxWidth: "480px", background: "white", borderRadius: "20px", boxShadow: "0 8px 32px rgba(124,58,237,0.18)", border: "2px solid #7c3aed", padding: "2rem 1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
              {rowData.label}
              {rowData.note && <div style={{ textTransform: "none", fontWeight: 400, fontStyle: "italic", marginTop: "0.25rem" }}>{rowData.note}</div>}
            </div>
            <div style={{ fontSize: "clamp(1.75rem, 6vw, 2.5rem)", fontWeight: 800, color: "#4c1d95", fontFamily: "monospace", lineHeight: 1.2, wordBreak: "break-word" }}>
              {isAtEnd ? "🎉 Done!" : (rowData.steps[currentStep] ?? "—")}
            </div>
            <div style={{ marginTop: "1rem", fontSize: "0.78rem", color: "#c4b5fd" }}>
              step {currentStep + 1} of {totalSteps}
            </div>
          </div>

          <div style={{ textAlign: "center", opacity: 0.35, minHeight: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            {nextStepText && (
              <>
                <div style={{ fontSize: "0.65rem", color: "#8b5cf6", marginBottom: "0.2rem" }}>{nextRowLabel}</div>
                <div style={{ fontSize: "1rem", fontFamily: "monospace", color: "#6d28d9" }}>{nextStepText}</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom controls ── */}
      <div style={{ background: paperMode ? "#1a1a2e" : "white", borderTop: `1px solid ${paperMode ? "rgba(255,255,255,0.08)" : "#ede9fe"}`, boxShadow: paperMode ? "none" : "0 -8px 24px rgba(109,40,217,0.08)", flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0.75rem 1rem" }}>

          {!paperMode && micActive && lastCommand && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.625rem" }}>
              <span style={{ fontSize: "0.72rem", color: "#7c3aed", background: "#f5f3ff", padding: "0.25rem 0.75rem", borderRadius: "99px" }}>heard: {lastCommand}</span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: (!paperMode && micSupported) ? "1fr auto 1fr" : "1fr 1fr", gap: "0.625rem", marginBottom: paperMode ? 0 : "0.5rem" }}>
            <button onClick={prevStep} disabled={isAtStart} style={{ padding: "0.875rem", background: paperMode ? (isAtStart ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)") : "white", color: paperMode ? (isAtStart ? "rgba(255,255,255,0.25)" : "white") : "#7c3aed", border: paperMode ? "1px solid rgba(255,255,255,0.12)" : "2px solid #ede9fe", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 600, cursor: isAtStart ? "not-allowed" : "pointer", opacity: isAtStart ? 0.4 : 1 }}>
              ← Prev
            </button>
            {!paperMode && micSupported && (
              <button onClick={micActive ? stopListening : startListening} style={{ width: "52px", padding: "0.875rem 0", background: micActive ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "#f5f3ff", color: micActive ? "white" : "#7c3aed", border: micActive ? "none" : "2px solid #ede9fe", borderRadius: "10px", fontSize: "1.25rem", cursor: "pointer", boxShadow: micActive ? "0 0 0 4px rgba(124,58,237,0.2)" : "none", transition: "all 0.2s" }}>
                🎤
              </button>
            )}
            <button onClick={nextStep} disabled={isAtEnd} style={{ padding: "0.875rem", background: isAtEnd ? (paperMode ? "rgba(124,58,237,0.3)" : "#c4b5fd") : "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 600, cursor: isAtEnd ? "not-allowed" : "pointer", opacity: isAtEnd ? 0.5 : 1, boxShadow: isAtEnd ? "none" : "0 4px 12px rgba(124,58,237,0.3)" }}>
              Next →
            </button>
          </div>

          {!paperMode && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
              <button onClick={prevRow} disabled={currentRow === 0} style={{ padding: "0.5rem", background: "transparent", color: "#a78bfa", border: "1px solid #ede9fe", borderRadius: "8px", fontSize: "0.8rem", cursor: currentRow === 0 ? "not-allowed" : "pointer", opacity: currentRow === 0 ? 0.4 : 1 }}>↑ Prev Row</button>
              <button onClick={nextRow} disabled={currentRow === totalRows - 1} style={{ padding: "0.5rem", background: "transparent", color: "#a78bfa", border: "1px solid #ede9fe", borderRadius: "8px", fontSize: "0.8rem", cursor: currentRow === totalRows - 1 ? "not-allowed" : "pointer", opacity: currentRow === totalRows - 1 ? 0.4 : 1 }}>↓ Next Row</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
