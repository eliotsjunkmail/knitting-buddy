"use client";
import { formatDuration } from "@/lib/utils";

interface Row {
  label: string;
  steps: string[];
}

interface Props {
  rows: Row[];
  timePerStep: Record<string, number>;
  onClose: () => void;
}

export default function StatsPanel({ rows, timePerStep, onClose }: Props) {
  const allEntries = Object.entries(timePerStep)
    .map(([key, secs]) => {
      const [ri, si] = key.split("-").map(Number);
      const row = rows[ri];
      const step = row?.steps?.[si] ?? "?";
      return { key, ri, si, step, label: row?.label ?? `Row ${ri + 1}`, secs };
    })
    .sort((a, b) => b.secs - a.secs);

  const totalTime = allEntries.reduce((s, e) => s + e.secs, 0);
  const stepsVisited = allEntries.length;
  const totalSteps = rows.reduce((s, r) => s + r.steps.length, 0);

  return (
    <div className="fixed inset-0 bg-purple-950/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl shadow-purple-200 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-100">
          <h2 className="text-lg font-semibold text-purple-900">Time Stats</h2>
          <button onClick={onClose} className="text-purple-300 hover:text-purple-500 text-xl">✕</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-purple-700">{formatDuration(totalTime)}</p>
              <p className="text-xs text-purple-400 mt-0.5">Total time</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-purple-700">{stepsVisited}</p>
              <p className="text-xs text-purple-400 mt-0.5">Steps timed</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-purple-700">
                {stepsVisited > 0 ? formatDuration(Math.round(totalTime / stepsVisited)) : "—"}
              </p>
              <p className="text-xs text-purple-400 mt-0.5">Avg per step</p>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-5">
            <div className="flex justify-between text-xs text-purple-400 mb-1">
              <span>Pattern progress</span>
              <span>{stepsVisited}/{totalSteps} steps visited</span>
            </div>
            <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-400 rounded-full"
                style={{ width: `${totalSteps > 0 ? (stepsVisited / totalSteps) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Slowest steps */}
          {allEntries.length > 0 && (
            <div>
              <p className="text-xs font-medium text-purple-500 uppercase tracking-wide mb-3">Time per step</p>
              <div className="space-y-2">
                {allEntries.slice(0, 20).map(({ key, label, step, secs }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-purple-400 truncate">{label}</p>
                      <p className="text-sm text-purple-800 font-medium truncate">{step}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-sm font-mono text-purple-600">{formatDuration(secs)}</span>
                      {/* Bar */}
                      <div className="h-1 bg-purple-100 rounded-full mt-1 w-20">
                        <div
                          className="h-full bg-purple-400 rounded-full"
                          style={{ width: `${Math.min(100, (secs / (allEntries[0]?.secs || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allEntries.length === 0 && (
            <p className="text-center text-purple-300 text-sm py-8">
              No timing data yet — start navigating steps to track time
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
