"use client";
import { useEffect, useRef, useState } from "react";

interface Row { label: string; steps: string[] }
interface VisualData {
  itemType: string;
  description: string;
  grid: string[][];
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function clamp(v: number) { return Math.max(0, Math.min(255, Math.round(v))); }

function drawKnitting(canvas: HTMLCanvasElement, grid: string[][]) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return;

  const CW = Math.floor(canvas.width / cols);   // cell width
  const CH = Math.floor(CW * 0.72);              // stitch aspect ratio ~3:2
  canvas.height = CH * rows;

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const raw = grid[r]?.[c] ?? "#d4c5b0";
      const { r: pr, g: pg, b: pb } = hexToRgb(raw);

      // Subtle per-stitch brightness jitter for fabric texture
      const jitter = (Math.sin(r * 7.3 + c * 3.7) * 0.5 + 0.5) * 6 - 3;

      ctx.fillStyle = `rgb(${clamp(pr + jitter)},${clamp(pg + jitter)},${clamp(pb + jitter)})`;
      ctx.fillRect(c * CW, r * CH, CW, CH);

      // Hairline row divider for stitch-row definition
      ctx.fillStyle = `rgba(0,0,0,0.06)`;
      ctx.fillRect(c * CW, r * CH + CH - 1, CW, 1);
    }
  }
}

export default function PatternVisualPreview({ rows, name, onClose }: { rows: Row[]; name: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [visual, setVisual] = useState<VisualData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/visual-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rows }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) throw new Error(data.error ?? "Failed");
        setVisual(data);
        setStatus("done");
      })
      .catch((e) => {
        if (!cancelled) { setErrorMsg(e.message); setStatus("error"); }
      });
    return () => { cancelled = true; };
  }, [name, rows]);

  useEffect(() => {
    if (status === "done" && visual?.grid && canvasRef.current) {
      drawKnitting(canvasRef.current, visual.grid);
    }
  }, [status, visual]);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(76,29,149,0.6)", backdropFilter: "blur(8px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <div style={{ background: "white", width: "100%", maxWidth: "480px", borderRadius: "20px", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, color: "white", fontWeight: 700, fontSize: "1.05rem" }}>Finished Item Preview</h2>
            <p style={{ margin: "0.2rem 0 0", color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>AI-generated based on your pattern</p>
          </div>
          <button onClick={onClose} style={{ width: "32px", height: "32px", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ padding: "1.5rem" }}>
          {status === "loading" && (
            <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <div style={{ width: "48px", height: "48px", border: "4px solid #ede9fe", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 1rem" }} />
              <p style={{ color: "#7c3aed", fontWeight: 600, margin: 0 }}>Visualising your pattern…</p>
              <p style={{ color: "#a78bfa", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>Claude is imagining the finished item</p>
            </div>
          )}

          {status === "error" && (
            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>😔</div>
              <p style={{ color: "#dc2626", fontWeight: 600, margin: 0 }}>Couldn't generate preview</p>
              <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "0.5rem 0 1.25rem" }}>{errorMsg}</p>
              <button onClick={onClose} style={{ padding: "0.625rem 1.5rem", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Close</button>
            </div>
          )}

          {status === "done" && visual && (
            <div>
              {/* Canvas preview */}
              <div style={{ borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", marginBottom: "1rem" }}>
                <canvas ref={canvasRef} width={430} style={{ display: "block", width: "100%", imageRendering: "pixelated" }} />
              </div>

              {/* Item label */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                <span style={{ fontSize: "1.5rem", lineHeight: 1, marginTop: "0.1rem" }}>🧶</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: "#4c1d95", fontSize: "0.9rem", textTransform: "capitalize" }}>{visual.itemType}</p>
                  <p style={{ margin: "0.25rem 0 0", color: "#6d28d9", fontSize: "0.85rem", lineHeight: 1.4 }}>{visual.description}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
