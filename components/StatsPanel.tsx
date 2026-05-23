"use client";
import { formatDuration } from "@/lib/utils";

interface Row { label: string; steps: string[] }

export default function StatsPanel({ rows, timePerStep, onClose }: { rows: Row[]; timePerStep: Record<string, number>; onClose: () => void }) {
  const entries = Object.entries(timePerStep).map(([key, secs]) => {
    const [ri, si] = key.split("-").map(Number);
    return { key, step: rows[ri]?.steps?.[si] ?? "?", label: rows[ri]?.label ?? `Row ${ri + 1}`, secs };
  }).sort((a, b) => b.secs - a.secs);

  const total = entries.reduce((s, e) => s + e.secs, 0);
  const totalSteps = rows.reduce((s, r) => s + r.steps.length, 0);
  const max = entries[0]?.secs || 1;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(76,29,149,0.5)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "1rem" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "white", width: "100%", maxWidth: "480px", borderRadius: "20px 20px 16px 16px", boxShadow: "0 -8px 40px rgba(0,0,0,0.2)", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #ede9fe", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#4c1d95" }}>Time Stats</h2>
          <button onClick={onClose} style={{ width: "32px", height: "32px", background: "#f5f3ff", border: "none", borderRadius: "8px", color: "#8b5cf6", fontSize: "1rem", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Total time", value: formatDuration(total) },
              { label: "Steps timed", value: String(entries.length) },
              { label: "Avg / step", value: entries.length > 0 ? formatDuration(Math.round(total / entries.length)) : "—" },
            ].map((s) => (
              <div key={s.label} style={{ background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", borderRadius: "12px", padding: "1rem 0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#4c1d95" }}>{s.value}</div>
                <div style={{ fontSize: "0.7rem", color: "#8b5cf6", marginTop: "0.25rem", fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#8b5cf6", marginBottom: "0.5rem", fontWeight: 500 }}>
              <span>Pattern progress</span>
              <span>{entries.length}/{totalSteps} steps visited</span>
            </div>
            <div style={{ height: "8px", background: "#ede9fe", borderRadius: "99px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${totalSteps > 0 ? (entries.length / totalSteps) * 100 : 0}%`, background: "linear-gradient(90deg, #8b5cf6, #7c3aed)", borderRadius: "99px" }} />
            </div>
          </div>

          {entries.length > 0 ? (
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>Time per step</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {entries.slice(0, 20).map(({ key, label, step, secs }) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.72rem", color: "#a78bfa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#4c1d95", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right", minWidth: "60px" }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#7c3aed", fontFamily: "monospace" }}>{formatDuration(secs)}</div>
                      <div style={{ height: "4px", background: "#ede9fe", borderRadius: "99px", marginTop: "4px", width: "60px" }}>
                        <div style={{ height: "100%", width: `${(secs / max) * 100}%`, background: "linear-gradient(90deg, #a78bfa, #7c3aed)", borderRadius: "99px" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "#c4b5fd", fontSize: "0.875rem", padding: "2rem 0" }}>No timing data yet — start navigating steps to track time</p>
          )}
        </div>
      </div>
    </div>
  );
}
