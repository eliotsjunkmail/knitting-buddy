"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { stepKey, formatDuration } from "@/lib/utils";
import StatsPanel from "./StatsPanel";

interface Row {
  label: string;
  steps: string[];
  note?: string;
}

interface Progress {
  currentRow: number;
  currentStep: number;
  lastUsed: string;
  timePerStep: Record<string, number>;
}

interface Pattern {
  id: string;
  name: string;
  rows: Row[];
  imageData?: string | null;
  progress?: Progress | null;
}

interface Props {
  pattern: Pattern;
}

const SAVE_DEBOUNCE = 1500;

export default function PatternViewer({ pattern }: Props) {
  const rows = pattern.rows as Row[];
  const initProgress = pattern.progress;

  const [currentRow, setCurrentRow] = useState(initProgress?.currentRow ?? 0);
  const [currentStep, setCurrentStep] = useState(initProgress?.currentStep ?? 0);
  const [timePerStep, setTimePerStep] = useState<Record<string, number>>(
    (initProgress?.timePerStep as Record<string, number>) ?? {}
  );
  const [showStats, setShowStats] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stepTimer, setStepTimer] = useState(0);

  const stepStartRef = useRef<number>(Date.now());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRowRef = useRef(currentRow);
  const currentStepRef = useRef(currentStep);
  const timePerStepRef = useRef(timePerStep);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  currentRowRef.current = currentRow;
  currentStepRef.current = currentStep;
  timePerStepRef.current = timePerStep;

  const totalRows = rows.length;
  const currentRowData = rows[currentRow] ?? { label: "", steps: [] };
  const totalSteps = currentRowData.steps.length;

  // Tick the step timer every second
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setStepTimer(Math.floor((Date.now() - stepStartRef.current) / 1000));
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // Scroll current row into view
  useEffect(() => {
    rowRefs.current[currentRow]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentRow]);

  // Save progress with debounce
  const scheduleSave = useCallback(
    (row: number, step: number, tps: Record<string, number>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch(`/api/patterns/${pattern.id}/progress`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentRow: row, currentStep: step, timePerStep: tps }),
          });
        } finally {
          setSaving(false);
        }
      }, SAVE_DEBOUNCE);
    },
    [pattern.id]
  );

  // Record time on current step, then move
  const recordCurrentStepTime = useCallback(() => {
    const elapsed = Math.floor((Date.now() - stepStartRef.current) / 1000);
    if (elapsed < 1) return timePerStepRef.current;
    const key = stepKey(currentRowRef.current, currentStepRef.current);
    const updated = {
      ...timePerStepRef.current,
      [key]: (timePerStepRef.current[key] ?? 0) + elapsed,
    };
    setTimePerStep(updated);
    return updated;
  }, []);

  const navigate = useCallback(
    (newRow: number, newStep: number) => {
      const tps = recordCurrentStepTime();
      stepStartRef.current = Date.now();
      setStepTimer(0);
      setCurrentRow(newRow);
      setCurrentStep(newStep);
      scheduleSave(newRow, newStep, tps);
    },
    [recordCurrentStepTime, scheduleSave]
  );

  function nextStep() {
    if (currentStep < totalSteps - 1) {
      navigate(currentRow, currentStep + 1);
    } else if (currentRow < totalRows - 1) {
      navigate(currentRow + 1, 0);
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      navigate(currentRow, currentStep - 1);
    } else if (currentRow > 0) {
      const prevRowSteps = rows[currentRow - 1]?.steps?.length ?? 1;
      navigate(currentRow - 1, prevRowSteps - 1);
    }
  }

  function nextRow() {
    if (currentRow < totalRows - 1) navigate(currentRow + 1, 0);
  }

  function prevRow() {
    if (currentRow > 0) navigate(currentRow - 1, 0);
  }

  function goToStep(ri: number, si: number) {
    navigate(ri, si);
  }

  // Keyboard navigation
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "l") nextStep();
      else if (e.key === "ArrowLeft" || e.key === "h") prevStep();
      else if (e.key === "ArrowDown" || e.key === "j") nextRow();
      else if (e.key === "ArrowUp" || e.key === "k") prevRow();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const isAtEnd = currentRow === totalRows - 1 && currentStep === totalSteps - 1;
  const isAtStart = currentRow === 0 && currentStep === 0;

  return (
    <div className="min-h-screen bg-purple-50 pb-36">
      {/* Header */}
      <div className="bg-white border-b border-purple-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/dashboard" className="text-purple-400 hover:text-purple-600 text-xl leading-none">←</a>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-purple-900 truncate">{pattern.name}</h1>
            <p className="text-xs text-purple-400">
              Row {currentRow + 1}/{totalRows} · Step {currentStep + 1}/{totalSteps}
              {saving && <span className="ml-2 text-purple-300">saving…</span>}
            </p>
          </div>
          <div className="flex gap-2">
            {pattern.imageData && (
              <button
                onClick={() => setShowImage(true)}
                className="text-purple-400 hover:text-purple-600 text-lg"
                title="View original image"
              >📷</button>
            )}
            <button
              onClick={() => setShowStats(true)}
              className="text-purple-400 hover:text-purple-600 text-lg"
              title="View stats"
            >📊</button>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="h-1 bg-purple-100">
          <div
            className="h-full bg-purple-400 transition-all"
            style={{
              width: `${totalRows > 0 ? ((currentRow + (currentStep + 1) / (totalSteps || 1)) / totalRows) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Pattern rows */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {rows.map((row, ri) => {
          const isCurrentRow = ri === currentRow;
          const isPastRow = ri < currentRow;

          return (
            <div
              key={ri}
              ref={(el) => { rowRefs.current[ri] = el; }}
              className={`rounded-2xl border transition-all ${
                isCurrentRow
                  ? "border-purple-300 bg-white shadow-md shadow-purple-100"
                  : isPastRow
                  ? "border-purple-100 bg-purple-50/40 opacity-50"
                  : "border-purple-100 bg-white/60 opacity-70"
              }`}
            >
              {/* Row header */}
              <div
                className={`px-4 py-3 flex items-center justify-between cursor-pointer rounded-t-2xl ${
                  isCurrentRow ? "bg-purple-50" : ""
                }`}
                onClick={() => !isCurrentRow && goToStep(ri, 0)}
              >
                <div className="flex items-center gap-2">
                  {isPastRow && <span className="text-green-400 text-sm">✓</span>}
                  {isCurrentRow && (
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse inline-block" />
                  )}
                  <span
                    className={`font-semibold text-sm ${
                      isCurrentRow ? "text-purple-800" : isPastRow ? "text-purple-400" : "text-purple-600"
                    }`}
                  >
                    {row.label}
                  </span>
                </div>
                {isCurrentRow && (
                  <span className="text-xs text-purple-400">
                    {currentStep + 1}/{totalSteps}
                  </span>
                )}
              </div>

              {/* Row note */}
              {row.note && isCurrentRow && (
                <p className="px-4 pb-1 text-xs text-purple-400 italic">{row.note}</p>
              )}

              {/* Steps — show in current row, abbreviated otherwise */}
              <div className={`px-4 pb-4 ${isCurrentRow ? "" : "pb-3"}`}>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(isCurrentRow ? row.steps : row.steps.slice(0, 4)).map((step, si) => {
                    const isCurrent = isCurrentRow && si === currentStep;
                    const isPastStep = isCurrentRow ? si < currentStep : isPastRow;
                    return (
                      <button
                        key={si}
                        onClick={() => goToStep(ri, si)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-mono transition-all ${
                          isCurrent
                            ? "bg-purple-600 text-white shadow-lg shadow-purple-200 scale-110 ring-2 ring-purple-300 ring-offset-1"
                            : isPastStep
                            ? "bg-purple-100 text-purple-400 line-through"
                            : isCurrentRow
                            ? "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                            : "bg-purple-50/50 text-purple-400 text-xs"
                        }`}
                      >
                        {step}
                      </button>
                    );
                  })}
                  {!isCurrentRow && row.steps.length > 4 && (
                    <span className="text-xs text-purple-300 self-center">+{row.steps.length - 4} more</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isAtEnd && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-purple-700 font-semibold text-lg">Pattern complete!</p>
            <p className="text-purple-400 text-sm mt-1">You finished all {totalRows} rows</p>
          </div>
        )}
      </div>

      {/* Fixed bottom controls */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-purple-100 shadow-lg shadow-purple-100">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* Step timer */}
          <div className="flex items-center justify-center mb-2">
            <span className="text-xs text-purple-400 font-mono">
              ⏱ {formatDuration(stepTimer)} on this step
            </span>
          </div>

          {/* Current step display */}
          <div className="bg-purple-50 rounded-xl px-4 py-2 text-center mb-3">
            <p className="text-xs text-purple-400 mb-0.5">{currentRowData.label}</p>
            <p className="text-lg font-mono font-semibold text-purple-900 min-h-[1.75rem]">
              {currentRowData.steps[currentStep] ?? "—"}
            </p>
          </div>

          {/* Navigation */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={prevStep}
              disabled={isAtStart}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-purple-200 text-purple-600 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              ← Prev Step
            </button>
            <button
              onClick={nextStep}
              disabled={isAtEnd}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors text-sm font-medium"
            >
              Next Step →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={prevRow}
              disabled={currentRow === 0}
              className="py-2 rounded-xl border border-purple-100 text-purple-400 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
            >
              ↑ Prev Row
            </button>
            <button
              onClick={nextRow}
              disabled={currentRow === totalRows - 1}
              className="py-2 rounded-xl border border-purple-100 text-purple-400 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
            >
              ↓ Next Row
            </button>
          </div>
        </div>
      </div>

      {/* Stats modal */}
      {showStats && (
        <StatsPanel
          rows={rows}
          timePerStep={timePerStep}
          onClose={() => setShowStats(false)}
        />
      )}

      {/* Image lightbox */}
      {showImage && pattern.imageData && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImage(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pattern.imageData}
            alt="Pattern"
            className="max-w-full max-h-full rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
}
