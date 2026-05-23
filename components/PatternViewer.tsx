"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { stepKey, formatDuration } from "@/lib/utils";
import StatsPanel from "./StatsPanel";

interface Row { label: string; steps: string[]; note?: string }
interface Progress { currentRow: number; currentStep: number; lastUsed: string; timePerStep: Record<string, number> }
interface Pattern { id: string; name: string; rows: Row[]; imageData?: string | null; progress?: Progress | null }

const SAVE_DEBOUNCE = 1500;

export default function PatternViewer({ pattern }: { pattern: Pattern }) {
  const rows = pattern.rows as Row[];
  const init = pattern.progress;

  const [currentRow, setCurrentRow] = useState(init?.currentRow ?? 0);
  const [currentStep, setCurrentStep] = useState(init?.currentStep ?? 0);
  const [timePerStep, setTimePerStep] = useState<Record<string, number>>((init?.timePerStep as Record<string, number>) ?? {});
  const [showStats, setShowStats] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stepTimer, setStepTimer] = useState(0);

  const stepStartRef = useRef<number>(Date.now());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef(currentRow);
  const stepRef = useRef(currentStep);
  const tpsRef = useRef(timePerStep);
  const rowEls = useRef<(HTMLDivElement | null)[]>([]);

  rowRef.current = currentRow; stepRef.current = currentStep; tpsRef.current = timePerStep;

  const totalRows = rows.length;
  const rowData = rows[currentRow] ?? { label: "", steps: [] };
  const totalSteps = rowData.steps.length;
  const isAtEnd = currentRow === totalRows - 1 && currentStep === totalSteps - 1;
  const isAtStart = currentRow === 0 && currentStep === 0;

  useEffect(() => {
    const t = setInterval(() => setStepTimer(Math.floor((Date.now() - stepStartRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { rowEls.current[currentRow]?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [currentRow]);

  const scheduleSave = useCallback((r: number, s: number, tps: Record<string, number>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try { await fetch(`/api/patterns/${pattern.id}/progress`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentRow: r, currentStep: s, timePerStep: tps }) }); }
      finally { setSaving(false); }
    }, SAVE_DEBOUNCE);
  }, [pattern.id]);

  const recordTime = useCallback(() => {
    const elapsed = Math.floor((Date.now() - stepStartRef.current) / 1000);
    if (elapsed < 1) return tpsRef.current;
    const key = stepKey(rowRef.current, stepRef.current);
    const updated = { ...tpsRef.current, [key]: (tpsRef.current[key] ?? 0) + elapsed };
    setTimePerStep(updated);
    return updated;
  }, []);

  const navigate = useCallback((r: number, s: number) => {
    const tps = recordTime();
    stepStartRef.current = Date.now();
    setStepTimer(0);
    setCurrentRow(r);
    setCurrentStep(s);
    scheduleSave(r, s, tps);
  }, [recordTime, scheduleSave]);

  function nextStep() { currentStep < totalSteps - 1 ? navigate(currentRow, currentStep + 1) : currentRow < totalRows - 1 && navigate(currentRow + 1, 0); }
  function prevStep() { currentStep > 0 ? navigate(currentRow, currentStep - 1) : currentRow > 0 && navigate(currentRow - 1, (rows[currentRow - 1]?.steps?.length ?? 1) - 1); }
  function nextRow() { currentRow < totalRows - 1 && navigate(currentRow + 1, 0); }
  function prevRow() { currentRow > 0 && navigate(currentRow - 1, 0); }

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

  const overallPct = totalRows > 0 ? ((currentRow + (currentStep + 1) / (totalSteps || 1)) / totalRows) * 100 : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f8f7ff", paddingBottom: "200px" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", position: "sticky", top: 0, zIndex: 20, boxShadow: "0 4px 20px rgba(76,29,149,0.3)" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0 1rem", height: "60px", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <a href="/dashboard" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: "1.25rem", lineHeight: 1, padding: "0.25rem" }}>←</a>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pattern.name}</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.72rem" }}>
              Row {currentRow + 1}/{totalRows} · Step {currentStep + 1}/{totalSteps}
              {saving && <span style={{ marginLeft: "0.5rem", opacity: 0.7 }}>saving…</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.375rem" }}>
            {pattern.imageData && (
              <button onClick={() => setShowImage(true)} style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "white", fontSize: "1rem", cursor: "pointer" }}>📷</button>
            )}
            <button onClick={() => setShowStats(true)} style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "white", fontSize: "1rem", cursor: "pointer" }}>📊</button>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: "3px", background: "rgba(255,255,255,0.2)" }}>
          <div style={{ height: "100%", width: `${overallPct}%`, background: "rgba(255,255,255,0.9)", transition: "width 0.4s" }} />
        </div>
      </div>

      {/* Rows */}
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "1.25rem 1rem" }}>
        {rows.map((row, ri) => {
          const isCurrent = ri === currentRow;
          const isPast = ri < currentRow;
          return (
            <div key={ri} ref={(el) => { rowEls.current[ri] = el; }}
              style={{ marginBottom: "0.75rem", borderRadius: "14px", border: isCurrent ? "2px solid #7c3aed" : "1px solid #ede9fe", background: isCurrent ? "white" : isPast ? "#faf5ff" : "white", opacity: isPast ? 0.55 : 1, boxShadow: isCurrent ? "0 4px 20px rgba(124,58,237,0.12)" : "none", transition: "all 0.2s" }}>
              {/* Row header */}
              <div onClick={() => !isCurrent && navigate(ri, 0)}
                style={{ padding: "0.875rem 1rem", display: "flex", alignItems: "center", gap: "0.625rem", cursor: isCurrent ? "default" : "pointer", borderRadius: isCurrent ? "12px 12px 0 0" : "12px", background: isCurrent ? "#f5f3ff" : "transparent" }}>
                {isPast && <span style={{ color: "#10b981", fontSize: "0.9rem" }}>✓</span>}
                {isCurrent && <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#7c3aed", display: "inline-block", boxShadow: "0 0 0 3px rgba(124,58,237,0.2)", animation: "pulse 2s infinite" }} />}
                <span style={{ fontWeight: 700, fontSize: "0.875rem", color: isCurrent ? "#4c1d95" : isPast ? "#8b5cf6" : "#6d28d9" }}>{row.label}</span>
                {isCurrent && <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#8b5cf6", fontWeight: 500 }}>{currentStep + 1}/{totalSteps}</span>}
              </div>

              {row.note && isCurrent && <p style={{ margin: 0, padding: "0 1rem 0.5rem", fontSize: "0.8rem", color: "#8b5cf6", fontStyle: "italic" }}>{row.note}</p>}

              {/* Steps */}
              <div style={{ padding: isCurrent ? "0.625rem 1rem 1rem" : "0.5rem 1rem 0.875rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {(isCurrent ? row.steps : row.steps.slice(0, 5)).map((s, si) => {
                  const isActive = isCurrent && si === currentStep;
                  const isDone = isCurrent ? si < currentStep : isPast;
                  return (
                    <button key={si} onClick={() => navigate(ri, si)}
                      style={{ padding: isActive ? "0.5rem 0.875rem" : "0.375rem 0.75rem", borderRadius: "8px", fontSize: isActive ? "0.9rem" : "0.8rem", fontFamily: "monospace", fontWeight: isActive ? 700 : 500, border: "none", cursor: "pointer", transition: "all 0.15s", transform: isActive ? "scale(1.08)" : "none",
                        background: isActive ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : isDone ? "#ede9fe" : isCurrent ? "#f5f3ff" : "transparent",
                        color: isActive ? "white" : isDone ? "#8b5cf6" : "#6d28d9",
                        boxShadow: isActive ? "0 4px 12px rgba(124,58,237,0.35)" : "none",
                        textDecoration: isDone ? "line-through" : "none" }}>
                      {s}
                    </button>
                  );
                })}
                {!isCurrent && row.steps.length > 5 && <span style={{ fontSize: "0.75rem", color: "#c4b5fd", alignSelf: "center" }}>+{row.steps.length - 5}</span>}
              </div>
            </div>
          );
        })}

        {isAtEnd && (
          <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎉</div>
            <h2 style={{ color: "#4c1d95", fontWeight: 700 }}>Pattern complete!</h2>
            <p style={{ color: "#8b5cf6" }}>You finished all {totalRows} rows</p>
          </div>
        )}
      </div>

      {/* Fixed bottom controls */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, background: "white", borderTop: "1px solid #ede9fe", boxShadow: "0 -8px 24px rgba(109,40,217,0.1)" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0.875rem 1rem" }}>
          {/* Timer */}
          <div style={{ textAlign: "center", marginBottom: "0.625rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#8b5cf6", fontFamily: "monospace", background: "#f5f3ff", padding: "0.25rem 0.75rem", borderRadius: "99px" }}>⏱ {formatDuration(stepTimer)} on this step</span>
          </div>

          {/* Current step */}
          <div style={{ background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", borderRadius: "12px", padding: "0.75rem 1rem", textAlign: "center", marginBottom: "0.875rem" }}>
            <div style={{ fontSize: "0.72rem", color: "#8b5cf6", marginBottom: "0.25rem", fontWeight: 500 }}>{rowData.label}</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#4c1d95", fontFamily: "monospace", minHeight: "1.75rem" }}>{rowData.steps[currentStep] ?? "—"}</div>
          </div>

          {/* Step nav */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem", marginBottom: "0.5rem" }}>
            <button onClick={prevStep} disabled={isAtStart}
              style={{ padding: "0.75rem", background: "white", color: "#7c3aed", border: "2px solid #ede9fe", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 600, cursor: isAtStart ? "not-allowed" : "pointer", opacity: isAtStart ? 0.4 : 1, transition: "all 0.15s" }}>
              ← Prev Step
            </button>
            <button onClick={nextStep} disabled={isAtEnd}
              style={{ padding: "0.75rem", background: isAtEnd ? "#c4b5fd" : "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 600, cursor: isAtEnd ? "not-allowed" : "pointer", opacity: isAtEnd ? 0.5 : 1, boxShadow: isAtEnd ? "none" : "0 4px 12px rgba(124,58,237,0.3)", transition: "all 0.15s" }}>
              Next Step →
            </button>
          </div>

          {/* Row nav */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
            <button onClick={prevRow} disabled={currentRow === 0}
              style={{ padding: "0.5rem", background: "transparent", color: "#a78bfa", border: "1px solid #ede9fe", borderRadius: "8px", fontSize: "0.8rem", cursor: currentRow === 0 ? "not-allowed" : "pointer", opacity: currentRow === 0 ? 0.4 : 1 }}>
              ↑ Prev Row
            </button>
            <button onClick={nextRow} disabled={currentRow === totalRows - 1}
              style={{ padding: "0.5rem", background: "transparent", color: "#a78bfa", border: "1px solid #ede9fe", borderRadius: "8px", fontSize: "0.8rem", cursor: currentRow === totalRows - 1 ? "not-allowed" : "pointer", opacity: currentRow === totalRows - 1 ? 0.4 : 1 }}>
              ↓ Next Row
            </button>
          </div>
        </div>
      </div>

      {showStats && <StatsPanel rows={rows} timePerStep={timePerStep} onClose={() => setShowStats(false)} />}

      {showImage && pattern.imageData && (
        <div onClick={() => setShowImage(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <img src={pattern.imageData} alt="Pattern" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "12px", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}
