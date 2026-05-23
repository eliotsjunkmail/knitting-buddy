"use client";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";

interface Row { label: string; steps: string[] }

// ── Stitch types ──────────────────────────────────────────────────────────────
type Stitch = "knit" | "purl" | "yo" | "decrease" | "cable-hi" | "cable-lo" | "slip";

const PALETTE: Record<Stitch, { bg: number; mark: number }> = {
  "knit":      { bg: 215, mark: 148 },
  "purl":      { bg: 155, mark: 105 },
  "yo":        { bg: 246, mark: 195 },
  "decrease":  { bg: 132, mark:  78 },
  "cable-hi":  { bg: 234, mark: 170 },
  "cable-lo":  { bg: 108, mark:  68 },
  "slip":      { bg: 192, mark: 142 },
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
    if (s === "yo") { out.push("yo"); continue; }
    if (/k2tog|ssk|skpo?|k3tog|s2kp|cdd|p2tog|p3tog|p2togtbl/.test(s)) { out.push("decrease"); continue; }
    const cn = parseCableCount(s);
    if (cn > 0) {
      const half = Math.floor(cn / 2);
      for (let i = 0; i < half; i++) out.push("cable-hi");
      for (let i = half; i < cn; i++) out.push("cable-lo");
      continue;
    }
    if (/^sl\d*[kwp]?$/.test(s) || s === "slk" || s === "slp") { out.push("slip"); continue; }
    const pm = s.match(/^p(\d*)(?:tbl)?$/);
    if (pm || s === "pb") {
      const n = pm ? (parseInt(pm[1] || "1") || 1) : 1;
      for (let i = 0; i < n; i++) out.push("purl");
      continue;
    }
    const km = s.match(/^k(\d*)(?:tbl|fb)?$/);
    if (km) {
      const n = parseInt(km[1] || "1") || 1;
      for (let i = 0; i < n; i++) out.push("knit");
      continue;
    }
    if (/^m1[lr]?$|^kfb$|^pfb$/.test(s)) { out.push("knit"); continue; }
    if (/^co$|^bo$|^cast|^bind/.test(s)) continue;
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

  const CW = Math.max(5, Math.floor(canvas.width / maxCols));
  const CH = Math.round(CW * 0.72);
  canvas.height = CH * rowCount;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e4e4e4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lw = Math.max(0.8, CW * 0.09);

  for (let r = 0; r < rowCount; r++) {
    const row = grid[r];
    const cols = Math.min(row.length, maxCols);
    const xOff = Math.floor((canvas.width - cols * CW) / 2);

    for (let c = 0; c < cols; c++) {
      const stitch = row[c] ?? "knit";
      const pal = PALETTE[stitch] ?? PALETTE.knit;
      const x = xOff + c * CW;
      const y = r * CH;

      const j = (Math.sin(r * 6.7 + c * 3.3) * 0.5 + 0.5) * 8 - 4;
      const bg = Math.max(0, Math.min(255, Math.round(pal.bg + j)));
      ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
      ctx.fillRect(x, y, CW, CH);

      const mk = pal.mark;
      ctx.strokeStyle = `rgb(${mk},${mk},${mk})`;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (stitch) {
        case "knit":
          ctx.beginPath();
          ctx.moveTo(x + CW * 0.12, y + CH * 0.17);
          ctx.lineTo(x + CW * 0.50, y + CH * 0.83);
          ctx.lineTo(x + CW * 0.88, y + CH * 0.17);
          ctx.stroke();
          break;
        case "purl":
          ctx.beginPath();
          ctx.arc(x + CW * 0.50, y + CH * 0.42, CW * 0.30, Math.PI, 0, false);
          ctx.stroke();
          break;
        case "yo":
          ctx.beginPath();
          ctx.arc(x + CW * 0.50, y + CH * 0.50, CW * 0.24, 0, Math.PI * 2);
          ctx.globalAlpha = 0.55;
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        case "decrease":
          ctx.beginPath();
          ctx.moveTo(x + CW * 0.72, y + CH * 0.14);
          ctx.lineTo(x + CW * 0.20, y + CH * 0.86);
          ctx.stroke();
          break;
        case "cable-hi":
          ctx.beginPath();
          ctx.moveTo(x, y + CH * 0.62);
          ctx.bezierCurveTo(x + CW * 0.33, y + CH * 0.14, x + CW * 0.67, y + CH * 0.14, x + CW, y + CH * 0.62);
          ctx.stroke();
          break;
        case "cable-lo":
          ctx.beginPath();
          ctx.moveTo(x, y + CH * 0.38);
          ctx.bezierCurveTo(x + CW * 0.33, y + CH * 0.86, x + CW * 0.67, y + CH * 0.86, x + CW, y + CH * 0.38);
          ctx.stroke();
          break;
        case "slip":
          ctx.beginPath();
          ctx.moveTo(x + CW * 0.50, y + CH * 0.10);
          ctx.lineTo(x + CW * 0.50, y + CH * 0.90);
          ctx.stroke();
          break;
      }

      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(x, y + CH - 1, CW, 1);
    }
  }
}

// ── Rotation helper ───────────────────────────────────────────────────────────
function applyRotation(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  const sw = src.width, sh = src.height;
  const swap = deg === 90 || deg === 270;
  out.width  = swap ? sh : sw;
  out.height = swap ? sw : sh;
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -sw / 2, -sh / 2);
  return out;
}

// Build a rotated canvas at a given pixel width (for display or save)
function buildCanvas(grid: Stitch[][], deg: number, width: number): HTMLCanvasElement {
  const tmp = document.createElement("canvas");
  tmp.width = width;
  renderSwatch(tmp, grid);
  return applyRotation(tmp, deg);
}

// ── Save helper ───────────────────────────────────────────────────────────────
function saveImage(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL("image/png");
  // iOS Safari doesn't honour <a download> — open in new tab so user can long-press save
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) {
    window.open(url, "_blank");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
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
  const canvasRef     = useRef<HTMLCanvasElement>(null);  // thumbnail in modal
  const largeCanvasRef = useRef<HTMLCanvasElement>(null); // enlarged in lightbox
  const [enlarged, setEnlarged] = useState(false);
  const [rotation, setRotation] = useState(0);           // 0 | 90 | 180 | 270

  const grid = useMemo<Stitch[][]>(() => rows.map(r => expandSteps(r.steps)), [rows]);

  // Render thumbnail
  useEffect(() => {
    if (canvasRef.current && grid.length > 0) renderSwatch(canvasRef.current, grid);
  }, [grid]);

  // Render / re-render enlarged canvas whenever it's open or rotation changes
  useEffect(() => {
    if (!enlarged || !largeCanvasRef.current) return;
    const rotated = buildCanvas(grid, rotation, 860);
    largeCanvasRef.current.width  = rotated.width;
    largeCanvasRef.current.height = rotated.height;
    largeCanvasRef.current.getContext("2d")!.drawImage(rotated, 0, 0);
  }, [enlarged, rotation, grid]);

  const rotateLeft  = useCallback(() => setRotation(r => (r + 270) % 360), []);
  const rotateRight = useCallback(() => setRotation(r => (r + 90)  % 360), []);

  const handleSave = useCallback(() => {
    const safe = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "swatch";
    saveImage(buildCanvas(grid, rotation, 1024), `${safe}-swatch.png`);
  }, [grid, rotation, name]);

  // Detect characteristics for subtitle
  const { maxCols, texture } = useMemo(() => {
    let hasLace = false, hasCables = false, hasPurl = false, maxCols = 0;
    for (const row of grid) {
      maxCols = Math.max(maxCols, row.length);
      for (const s of row) {
        if (s === "yo") hasLace = true;
        if (s === "cable-hi" || s === "cable-lo") hasCables = true;
        if (s === "purl") hasPurl = true;
      }
    }
    return { maxCols, texture: hasCables ? "Cable" : hasLace ? "Lace" : hasPurl ? "Knit / Purl" : "Stockinette" };
  }, [grid]);

  const legend: { stitch: Stitch; label: string }[] = [
    { stitch: "knit",     label: "Knit" },
    { stitch: "purl",     label: "Purl" },
    { stitch: "yo",       label: "Yarn over" },
    { stitch: "decrease", label: "Decrease" },
    { stitch: "cable-hi", label: "Cable ↑" },
    { stitch: "cable-lo", label: "Cable ↓" },
    { stitch: "slip",     label: "Slip" },
  ];

  return (
    <>
      {/* ── Main modal ────────────────────────────────────────────────────── */}
      <div
        onClick={(e) => e.target === e.currentTarget && onClose()}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(76,29,149,0.6)", backdropFilter: "blur(8px)",
          zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem", paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div style={{
          background: "white", width: "100%", maxWidth: "480px",
          borderRadius: "20px", boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          overflow: "hidden", maxHeight: "90vh",
          display: "flex", flexDirection: "column",
        }}>

          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
            padding: "1.25rem 1.5rem",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div>
              <h2 style={{ margin: 0, color: "white", fontWeight: 700, fontSize: "1.05rem" }}>Pattern Swatch</h2>
              <p style={{ margin: "0.2rem 0 0", color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>
                {rows.length} rows · {maxCols} sts · {texture}
              </p>
            </div>
            <button onClick={onClose} style={{ width: "32px", height: "32px", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "1rem" }}>✕</button>
          </div>

          {/* Scrollable body */}
          <div style={{ overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Thumbnail — click to enlarge */}
            <div
              onClick={() => setEnlarged(true)}
              title="Tap to enlarge"
              style={{ position: "relative", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", cursor: "zoom-in" }}
            >
              <canvas ref={canvasRef} width={430} style={{ display: "block", width: "100%", imageRendering: "pixelated" }} />
              {/* Hover hint */}
              <div style={{
                position: "absolute", bottom: "8px", right: "8px",
                background: "rgba(0,0,0,0.45)", color: "white",
                fontSize: "0.7rem", padding: "0.25rem 0.6rem", borderRadius: "99px",
                pointerEvents: "none",
              }}>
                🔍 Tap to enlarge
              </div>
            </div>

            {/* Pattern name */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <span style={{ fontSize: "1.4rem" }}>🧶</span>
              <p style={{ margin: 0, fontWeight: 700, color: "#4c1d95", fontSize: "0.9rem" }}>{name}</p>
            </div>

            {/* Stitch key */}
            <div style={{ borderTop: "1px solid #ede9fe", paddingTop: "0.875rem" }}>
              <p style={{ margin: "0 0 0.625rem", fontSize: "0.72rem", fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.05em" }}>Stitch Key</p>
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

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {enlarged && (
        <div
          onClick={(e) => e.target === e.currentTarget && setEnlarged(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.92)", backdropFilter: "blur(4px)",
            zIndex: 60,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "1rem",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            gap: "1rem",
          }}
        >
          {/* Canvas — fills available space */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", overflow: "hidden" }}>
            <canvas
              ref={largeCanvasRef}
              style={{
                maxWidth: "100%",
                maxHeight: "calc(100vh - 120px)",
                display: "block",
                imageRendering: "pixelated",
                borderRadius: "8px",
                boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
              }}
            />
          </div>

          {/* Controls bar */}
          <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0 }}>
            {/* Rotate left */}
            <button
              onClick={rotateLeft}
              title="Rotate left"
              style={{ width: "48px", height: "48px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", color: "white", fontSize: "1.3rem", cursor: "pointer" }}
            >↺</button>

            {/* Rotate right */}
            <button
              onClick={rotateRight}
              title="Rotate right"
              style={{ width: "48px", height: "48px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", color: "white", fontSize: "1.3rem", cursor: "pointer" }}
            >↻</button>

            {/* Save */}
            <button
              onClick={handleSave}
              title="Save image"
              style={{ height: "48px", padding: "0 1.25rem", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: "12px", color: "white", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(124,58,237,0.4)", display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span>💾</span> Save
            </button>

            {/* Close lightbox */}
            <button
              onClick={() => setEnlarged(false)}
              title="Close"
              style={{ width: "48px", height: "48px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", color: "white", fontSize: "1rem", cursor: "pointer" }}
            >✕</button>
          </div>

          {/* Rotation label */}
          {rotation !== 0 && (
            <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" }}>{rotation}° rotation</p>
          )}
        </div>
      )}
    </>
  );
}
