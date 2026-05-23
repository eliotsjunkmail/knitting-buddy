"use client";

interface Row { label: string; steps: string[] }

type StitchType = "k" | "p" | "dec" | "inc" | "yo" | "sl" | "special";
interface Stitch { type: StitchType; label: string }

const STITCH: Record<StitchType, { bg: string; fg: string; symbol: string; name: string }> = {
  k:       { bg: "#f5f3ff", fg: "#6d28d9", symbol: "–",  name: "Knit" },
  p:       { bg: "#7c3aed", fg: "white",   symbol: "•",  name: "Purl" },
  dec:     { bg: "#fecdd3", fg: "#be123c", symbol: "\\", name: "Decrease" },
  inc:     { bg: "#bbf7d0", fg: "#15803d", symbol: "+",  name: "Increase" },
  yo:      { bg: "#a5f3fc", fg: "#0e7490", symbol: "○",  name: "Yarn over" },
  sl:      { bg: "#e5e7eb", fg: "#4b5563", symbol: "↑",  name: "Slip" },
  special: { bg: "#ede9fe", fg: "#8b5cf6", symbol: "?",  name: "Other" },
};

function parseStep(step: string): Stitch[] {
  const s = step.toLowerCase().trim();
  if (!s) return [];

  // Long/complex instructions get a single special cell
  if (s.length > 18 || s.includes("repeat") || s.includes("*") || s.includes("from")) {
    return [{ type: "special", label: step.slice(0, 5) }];
  }

  // Decreases (must come before k/p checks)
  if (/^(k2tog|k3tog|ssk|s2kp|cdd|skp)/.test(s)) return [{ type: "dec", label: "dec" }];
  // Increases
  if (/^(m1[lr]?|kfb|pfb|kf&b)/.test(s)) return [{ type: "inc", label: "inc" }];
  // Yarn over
  if (/^yo/.test(s)) return [{ type: "yo", label: "yo" }];
  // Slip
  if (/^sl/.test(s)) return [{ type: "sl", label: "sl" }];

  // k{n} or just k
  const km = s.match(/^k(\d+)/);
  if (km) return Array(Math.min(parseInt(km[1]), 60)).fill({ type: "k", label: "k" });
  if (s === "k" || s === "knit") return [{ type: "k", label: "k" }];

  // p{n} or just p
  const pm = s.match(/^p(\d+)/);
  if (pm) return Array(Math.min(parseInt(pm[1]), 60)).fill({ type: "p", label: "p" });
  if (s === "p" || s === "purl") return [{ type: "p", label: "p" }];

  return [{ type: "special", label: step.slice(0, 4) }];
}

function rowToStitches(row: Row): { stitches: Stitch[]; overflow: number } {
  const all: Stitch[] = [];
  for (const step of row.steps) all.push(...parseStep(step));
  const MAX = 80;
  if (all.length > MAX) return { stitches: all.slice(0, MAX), overflow: all.length - MAX };
  return { stitches: all, overflow: 0 };
}

const CELL = 12; // px

export default function PatternPreview({ rows, onClose }: { rows: Row[]; onClose: () => void }) {
  const MAX_ROWS = 60;
  const displayRows = rows.slice(0, MAX_ROWS);
  const hiddenRows = rows.length - displayRows.length;

  const typesPresent = new Set<StitchType>();
  displayRows.forEach((r) => r.steps.forEach((s) => parseStep(s).forEach((st) => typesPresent.add(st.type))));

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(76,29,149,0.6)", backdropFilter: "blur(6px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <div style={{ background: "white", width: "100%", maxWidth: "600px", borderRadius: "20px", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #ede9fe", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#4c1d95" }}>Stitch Chart</h2>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#8b5cf6" }}>{rows.length} rows · each cell = 1 stitch</p>
          </div>
          <button onClick={onClose} style={{ width: "32px", height: "32px", background: "#f5f3ff", border: "none", borderRadius: "8px", color: "#8b5cf6", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>

        {/* Legend */}
        <div style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid #ede9fe", display: "flex", flexWrap: "wrap", gap: "0.625rem", flexShrink: 0 }}>
          {(Object.entries(STITCH) as [StitchType, typeof STITCH[StitchType]][])
            .filter(([type]) => typesPresent.has(type))
            .map(([type, s]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <div style={{ width: "14px", height: "14px", background: s.bg, border: `1px solid ${s.fg}`, borderRadius: "2px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: s.fg, fontWeight: 700 }}>{s.symbol}</div>
                <span style={{ fontSize: "0.72rem", color: "#6d28d9" }}>{s.name}</span>
              </div>
            ))}
        </div>

        {/* Chart */}
        <div style={{ overflowY: "auto", overflowX: "auto", padding: "1rem 1.5rem", flex: 1 }}>
          <table style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
            <tbody>
              {displayRows.map((row, ri) => {
                const { stitches, overflow } = rowToStitches(row);
                return (
                  <tr key={ri}>
                    {/* Row label */}
                    <td style={{ paddingRight: "0.5rem", whiteSpace: "nowrap", fontSize: "0.65rem", color: "#a78bfa", textAlign: "right", verticalAlign: "middle", position: "sticky", left: 0, background: "white", zIndex: 1, minWidth: "40px" }}>
                      {row.label}
                    </td>
                    {/* Stitches */}
                    {stitches.map((st, si) => {
                      const s = STITCH[st.type];
                      return (
                        <td key={si} title={`${row.label} · ${st.label}`}
                          style={{ width: `${CELL}px`, height: `${CELL}px`, background: s.bg, border: `1px solid ${s.fg}22`, padding: 0, cursor: "default" }} />
                      );
                    })}
                    {overflow > 0 && (
                      <td style={{ paddingLeft: "0.375rem", fontSize: "0.65rem", color: "#c4b5fd", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                        +{overflow}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hiddenRows > 0 && (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.78rem", color: "#a78bfa", textAlign: "center" }}>
              …and {hiddenRows} more rows
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
