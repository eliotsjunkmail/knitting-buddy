"use client";
import { useEffect, useRef, useMemo } from "react";

interface Row { label: string; steps: string[] }

// ── Stitch types ──────────────────────────────────────────────────────────────
type Stitch = "knit" | "purl" | "yo" | "decrease" | "cable-hi" | "cable-lo" | "slip";

// Grayscale palette: bg = cell brightness (0–255), mark = symbol brightness
const PALETTE: Record<Stitch, { bg: number; mark: number }> = {
  "knit":      { bg: 215, mark: 148 },  // light grey  – V shape
  "purl":      { bg: 155, mark: 105 },  // medium grey – horizontal ridge arc
  "yo":        { bg: 246, mark: 195 },  // near-white  – open hole ring
  "decrease":  { bg: 132, mark:  78 },  // dark grey   – diagonal bar
  "cable-hi":  { bg: 234, mark: 170 },  // lightest    – strand raised to front
  "cable-lo":  { bg: 108, mark:  68 },  // darkest     – strand pushed behind
  "slip":      { bg: 192, mark: 142 },  // mid-light   – elongated bar
};

// ── Step parser ───────────────────────────────────────────────────────────────
function parseCableCount(s: string): number {
  const m1 = s.match(/^c(\d+)[fb]/i);
  if (m1) return parseInt(m1[1]);
  const m2 = s.match(/^(\d+)\/(\d+)[lr]?c/i);
  if (m2) return parseInt(m2[1]) + parseInt(m2[2]);
  return 0;
}

function expandSteps(steps: string[]): Stitch[] {
  const out: Stitch[] = [];
  for (const raw of steps) {
    const s = raw.toLowerCase().replace(/\s+/g, "").trim();
    if (!s || s === "-") { out.push("knit"); continue; }

    // Yarn over → open hole
    if (s === "yo") { out.push("yo"); continue; }

    // Decreases
    if (/k2tog|ssk|skpo?|k3tog|s2kp|cdd|p2tog|p3tog|p2togtbl/.test(s)) {
      out.push("decrease"); continue;
    }

    // Cables: C4F/B, 2/2LC, 2/2RC, etc.
    const cn = parseCableCount(s);
    if (cn > 0) {
      const half = Math.floor(cn / 2);
      for (let i = 0; i < half; i++) out.push("cable-hi");
      for (let i = half; i < cn; i++) out.push("cable-lo");
      continue;
    }

    // Slip stitches
    if (/^sl\d*[kwp]?$/.test(s) || s === "slk" || s === "slp") {
      out.push("slip"); continue;
    }

    // Purl: p, p2, p3, ptbl
    const pm = s.match(/^p(\d*)(?:tbl)?$/);
    if (pm || s === "pb") {
      const n = pm ? (parseInt(pm[1] || "1") || 1) : 1;
      for (let i = 0; i < n; i++) out.push("purl");
      continue;
    }

    // Knit: k, k2, ktbl, kfb
    const km = s.match(/^k(\d*)(?:tbl|fb)?$/);
    if (km) {
      const n = parseInt(km[1] || "1") || 1;
      for (let i = 0; i < n; i++) out.push("knit");
      continue;
    }
    if (/^m1[lr]?$|^kfb$|^pfb$/.test(s)) { out.push("knit"); continue; }

    // Skip cast-on / bind-off markers
    if (/^co$|^bo$|^cast|^bind/.test(s)) continue;

    // Default → knit
    out.push("knit");
  }
  return out.length > 0 ? out : ["knit"];
}

// ── Canvas renderer ───────────────────────────────────────────────────────────
function renderSwatch(canvas: HTMLCanvasElement, grid: Stitch[][]): void {
  const rowCount = Math.min(grid.length, 80);
  if (!rowCount) return;

  const maxCols = Math.min(Math.max(...grid.slice(0, rowCount).map(r => r.length)), 80);
  if (!maxCols) return;

  const CW = Math.max(5, Math.floor(canvas.width / maxCols)); // cell width px
  const CH = Math.round(CW * 0.72);                           // stitch aspect ~3:2
  canvas.height = CH * rowCount;

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Canvas background
  ctx.fillStyle = "#e4e4e4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lw = Math.max(0.8, CW * 0.09);

  for (let r = 0; r < rowCount; r++) {
    const row = grid[r];
    const cols = Math.min(row.length, maxCols);
    const rowPx = cols * CW;
    const xOff = Math.floor((canvas.width - rowPx) / 2);

    for (let c = 0; c < cols; c++) {
      const stitch = row[c] ?? "knit";
      const pal = PALETTE[stitch] ?? PALETTE.knit;
      const x = xOff + c * CW;
      const y = r * CH;

      // Deterministic per-stitch brightness jitter ±4 for fabric texture
      const j = (Math.sin(r * 6.7 + c * 3.3) * 0.5 + 0.5) * 8 - 4;
      const bg = Math.max(0, Math.min(255, Math.round(pal.bg + j)));

      // Cell fill
      ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
      ctx.fillRect(x, y, CW, CH);

      // Stitch symbol
      const mk = pal.mark;
      ctx.strokeStyle = `rgb(${mk},${mk},${mk})`;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (stitch) {
        case "knit": {
          // Classic V
          ctx.beginPath();
          ctx.moveTo(x + CW * 0.12, y + CH * 0.17);
          ctx.lineTo(x + CW * 0.50, y + CH * 0.83);
          ctx.lineTo(x + CW * 0.88, y + CH * 0.17);
          ctx.stroke();
          break;
        }
        case "purl": {
          // Horizontal ridge arc (bump)
          ctx.beginPath();
          ctx.arc(x + CW * 0.50, y + CH * 0.42, CW * 0.30, Math.PI, 0, false);
          ctx.stroke();
          break;
        }
        case "yo": {
          // Open ring (hole)
          ctx.beginPath();
          ctx.arc(x + CW * 0.50, y + CH * 0.50, CW * 0.24, 0, Math.PI * 2);
          ctx.globalAlpha = 0.55;
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case "decrease": {
          // Left-leaning diagonal bar
          ctx.beginPath();
          ctx.moveTo(x + CW * 0.72, y + CH * 0.14);
          ctx.lineTo(x + CW * 0.20, y + CH * 0.86);
          ctx.stroke();
          break;
        }
        case "cable-hi": {
          // Strand curving upward (front)
          ctx.beginPath();
          ctx.moveTo(x,          y + CH * 0.62);
          ctx.bezierCurveTo(
            x + CW * 0.33, y + CH * 0.14,
            x + CW * 0.67, y + CH * 0.14,
            x + CW,        y + CH * 0.62,
          );
          ctx.stroke();
          break;
        }
        case "cable-lo": {
          // Strand curving downward (behind)
          ctx.beginPath();
          ctx.moveTo(x,          y + CH * 0.38);
          ctx.bezierCurveTo(
            x + CW * 0.33, y + CH * 0.86,
            x + CW * 0.67, y + CH * 0.86,
            x + CW,        y + CH * 0.38,
          );
          ctx.stroke();
          break;
        }
        case "slip": {
          // Elongated vertical bar
          ctx.beginPath();
          ctx.moveTo(x + CW * 0.50, y + CH * 0.10);
          ctx.lineTo(x + CW * 0.50, y + CH * 0.90);
          ctx.stroke();
          break;
        }
      }

      // Hairline row divider
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(x, y + CH - 1, CW, 1);
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PatternVisualPreview({
  rows, name, onClose,
}: {
  rows: Row[];
  name: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const grid = useMemo<Stitch[][]>(() => rows.map(r => expandSteps(r.steps)), [rows]);

  useEffect(() => {
    if (canvasRef.current && grid.length > 0) {
      renderSwatch(canvasRef.current, grid);
    }
  }, [grid]);

  // Derive description from what stitches appear
  const { maxCols, texture } = useMemo(() => {
    let hasLace = false, hasCables = false, hasPurl = false;
    let maxCols = 0;
    for (const row of grid) {
      maxCols = Math.max(maxCols, row.length);
      for (const s of row) {
        if (s === "yo") hasLace = true;
        if (s === "cable-hi" || s === "cable-lo") hasCables = true;
        if (s === "purl") hasPurl = true;
      }
    }
    const texture = hasCables ? "Cable" : hasLace ? "Lace" : hasPurl ? "Knit / Purl" : "Stockinette";
    return { maxCols, texture };
  }, [grid]);

  // Stitch key
  const legend: { stitch: Stitch; label: string }[] = [
    { stitch: "knit",      label: "Knit" },
    { stitch: "purl",      label: "Purl" },
    { stitch: "yo",        label: "Yarn over" },
    { stitch: "decrease",  label: "Decrease" },
    { stitch: "cable-hi",  label: "Cable ↑" },
    { stitch: "cable-lo",  label: "Cable ↓" },
    { stitch: "slip",      label: "Slip" },
  ];

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(76,29,149,0.6)",
        backdropFilter: "blur(8px)",
        zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div style={{
        background: "white", width: "100%", maxWidth: "480px",
        borderRadius: "20px",
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        overflow: "hidden",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
          padding: "1.25rem 1.5rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, color: "white", fontWeight: 700, fontSize: "1.05rem" }}>
              Pattern Swatch
            </h2>
            <p style={{ margin: "0.2rem 0 0", color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>
              {rows.length} rows · {maxCols} sts · {texture}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: "32px", height: "32px", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "1rem" }}
          >✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Canvas */}
          <div style={{ borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
            <canvas
              ref={canvasRef}
              width={430}
              style={{ display: "block", width: "100%", imageRendering: "pixelated" }}
            />
          </div>

          {/* Pattern name */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <span style={{ fontSize: "1.4rem" }}>🧶</span>
            <p style={{ margin: 0, fontWeight: 700, color: "#4c1d95", fontSize: "0.9rem" }}>{name}</p>
          </div>

          {/* Stitch key */}
          <div style={{ borderTop: "1px solid #ede9fe", paddingTop: "0.875rem" }}>
            <p style={{ margin: "0 0 0.625rem", fontSize: "0.72rem", fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Stitch Key
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {legend.map(({ stitch, label }) => {
                const v = PALETTE[stitch].bg;
                return (
                  <div key={stitch} style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: "#faf5ff", border: "1px solid #ede9fe", borderRadius: "8px", padding: "0.3rem 0.625rem" }}>
                    <div style={{ width: "20px", height: "14px", background: `rgb(${v},${v},${v})`, borderRadius: "3px", border: "1px solid rgba(0,0,0,0.1)", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.75rem", color: "#6d28d9", whiteSpace: "nowrap" }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
