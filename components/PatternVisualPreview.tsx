"use client";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { type Stitch, expandSteps, renderSwatch, buildRotatedCanvas } from "@/lib/knittingSwatch";

interface Row { label: string; steps: string[] }

function saveImage(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL("image/png");
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    window.open(url, "_blank");
  } else {
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  }
}

export default function PatternVisualPreview({
  rows, name, onClose,
}: {
  rows: Row[];
  name: string;
  onClose: () => void;
}) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const largeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [enlarged, setEnlarged] = useState(false);
  const [rotation, setRotation] = useState(0);

  const grid = useMemo<Stitch[][]>(() => rows.map(r => expandSteps(r.steps)), [rows]);

  useEffect(() => {
    if (canvasRef.current && grid.length > 0) renderSwatch(canvasRef.current, grid);
  }, [grid]);

  useEffect(() => {
    if (!enlarged || !largeCanvasRef.current) return;
    const rotated = buildRotatedCanvas(grid, rotation, 860);
    largeCanvasRef.current.width  = rotated.width;
    largeCanvasRef.current.height = rotated.height;
    largeCanvasRef.current.getContext("2d")!.drawImage(rotated, 0, 0);
  }, [enlarged, rotation, grid]);

  const rotateLeft  = useCallback(() => setRotation(r => (r + 270) % 360), []);
  const rotateRight = useCallback(() => setRotation(r => (r + 90)  % 360), []);

  const handleSave = useCallback(() => {
    const safe = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "swatch";
    saveImage(buildRotatedCanvas(grid, rotation, 1024), `${safe}-swatch.png`);
  }, [grid, rotation, name]);

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

  return (
    <>
      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      <div
        onClick={(e) => e.target === e.currentTarget && onClose()}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(76,29,149,0.6)", backdropFilter: "blur(8px)",
          zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem", paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div style={{
          background: "white", width: "100%", maxWidth: "480px",
          borderRadius: "20px", boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
            padding: "1.25rem 1.5rem", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <h2 style={{ margin: 0, color: "white", fontWeight: 700, fontSize: "1.05rem" }}>Pattern Swatch</h2>
              <p style={{ margin: "0.2rem 0 0", color: "rgba(255,255,255,0.7)", fontSize: "0.75rem" }}>
                {rows.length} rows · {maxCols} sts · {texture}
              </p>
            </div>
            <button onClick={onClose} style={{ width: "32px", height: "32px", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "1rem" }}>✕</button>
          </div>

          {/* Body */}
          <div style={{ overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Canvas — tap to enlarge */}
            <div
              onClick={() => setEnlarged(true)}
              title="Tap to enlarge"
              style={{ position: "relative", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", cursor: "zoom-in" }}
            >
              <canvas ref={canvasRef} width={430} style={{ display: "block", width: "100%", imageRendering: "pixelated" }} />
              <div style={{ position: "absolute", bottom: "8px", right: "8px", background: "rgba(0,0,0,0.45)", color: "white", fontSize: "0.7rem", padding: "0.25rem 0.6rem", borderRadius: "99px", pointerEvents: "none" }}>
                🔍 Tap to enlarge
              </div>
            </div>

            {/* Pattern name */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <span style={{ fontSize: "1.4rem" }}>🧶</span>
              <p style={{ margin: 0, fontWeight: 700, color: "#4c1d95", fontSize: "0.9rem" }}>{name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {enlarged && (
        <div
          onClick={(e) => e.target === e.currentTarget && setEnlarged(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(4px)",
            zIndex: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "1rem", paddingBottom: "max(1rem, env(safe-area-inset-bottom))", gap: "1rem",
          }}
        >
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", overflow: "hidden" }}>
            <canvas ref={largeCanvasRef} style={{ maxWidth: "100%", maxHeight: "calc(100vh - 120px)", display: "block", imageRendering: "pixelated", borderRadius: "8px", boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }} />
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0 }}>
            <button onClick={rotateLeft}  style={{ width: "48px", height: "48px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", color: "white", fontSize: "1.3rem", cursor: "pointer" }}>↺</button>
            <button onClick={rotateRight} style={{ width: "48px", height: "48px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", color: "white", fontSize: "1.3rem", cursor: "pointer" }}>↻</button>
            <button onClick={handleSave} style={{ height: "48px", padding: "0 1.25rem", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "none", borderRadius: "12px", color: "white", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(124,58,237,0.4)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>💾</span> Save
            </button>
            <button onClick={() => setEnlarged(false)} style={{ width: "48px", height: "48px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", color: "white", fontSize: "1rem", cursor: "pointer" }}>✕</button>
          </div>
          {rotation !== 0 && <p style={{ margin: 0, color: "rgba(255,255,255,0.5)", fontSize: "0.72rem" }}>{rotation}° rotation</p>}
        </div>
      )}
    </>
  );
}
