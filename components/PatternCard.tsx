"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";
import PatternVisualPreview from "@/components/PatternVisualPreview";

interface Row { label: string; steps: string[] }
interface Progress { currentRow: number; currentStep: number; lastUsed: string }
interface Pattern { id: string; name: string; rows: Row[]; imageData?: string | null; progress?: Progress | null; createdAt: string }

function drawOnCanvas(canvas: HTMLCanvasElement, src: string, deg: number, onDone?: () => void) {
  const img = new Image();
  img.onload = () => {
    const swap = deg === 90 || deg === 270;
    const maxDim = 900;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    canvas.width  = swap ? h : w;
    canvas.height = swap ? w : h;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    onDone?.();
  };
  img.src = src;
}

export default function PatternCard({ pattern, onDelete }: { pattern: Pattern; onDelete: (id: string) => void }) {
  const router = useRouter();
  const [showPreview, setShowPreview] = useState(false);
  const [localImageData, setLocalImageData] = useState<string | null>(pattern.imageData ?? null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editorRotation, setEditorRotation] = useState(0);   // 0 | 90 | 180 | 270
  const [editorSaving, setEditorSaving] = useState(false);
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!showImageEditor || !localImageData || !editorCanvasRef.current) return;
    drawOnCanvas(editorCanvasRef.current, localImageData, editorRotation);
  }, [showImageEditor, editorRotation, localImageData]);

  async function saveImage() {
    if (!localImageData) return;
    setEditorSaving(true);
    try {
      const saveCanvas = document.createElement("canvas");
      await new Promise<void>(resolve => drawOnCanvas(saveCanvas, localImageData, editorRotation, resolve));
      const newData = saveCanvas.toDataURL("image/jpeg", 0.92);
      const res = await fetch(`/api/patterns/${pattern.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: newData }),
      });
      if (res.ok) {
        setLocalImageData(newData);
        setEditorRotation(0);
        setShowImageEditor(false);
      }
    } finally {
      setEditorSaving(false);
    }
  }
  const rows = pattern.rows as Row[];
  const progress = pattern.progress;
  const currentRow = progress?.currentRow ?? 0;
  const currentStep = progress?.currentStep ?? 0;
  const totalRows = rows.length;
  const pct = totalRows > 0 ? Math.round((currentRow / totalRows) * 100) : 0;
  const currentStepText = rows[currentRow]?.steps?.[currentStep] ?? "—";

  return (
    <div style={{ background: "white", borderRadius: "16px", overflow: "hidden", boxShadow: "0 2px 8px rgba(109,40,217,0.08)", border: "1px solid #ede9fe", transition: "box-shadow 0.2s, transform 0.2s", cursor: "default" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(109,40,217,0.16)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(109,40,217,0.08)"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}>

      {/* Thumbnail / header */}
      {localImageData
        ? (
          <div style={{ height: "120px", overflow: "hidden", position: "relative" }}>
            <img src={localImageData} alt={pattern.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button
              onClick={(e) => { e.stopPropagation(); setEditorRotation(0); setShowImageEditor(true); }}
              title="Rotate / set cover photo"
              style={{ position: "absolute", top: "6px", right: "6px", width: "28px", height: "28px", background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "6px", color: "white", fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >🔄</button>
          </div>
        )
        : <div style={{ height: "80px", background: "linear-gradient(135deg, #ede9fe, #ddd6fe)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🧶</div>
      }

      <div style={{ padding: "1.25rem" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#1e1b4b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pattern.name}</h3>

        {/* Progress */}
        <div style={{ marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#8b5cf6", marginBottom: "0.375rem", fontWeight: 500 }}>
            <span>Row {currentRow + 1} of {totalRows}</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: "6px", background: "#ede9fe", borderRadius: "99px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #8b5cf6, #7c3aed)", borderRadius: "99px", transition: "width 0.4s" }} />
          </div>
        </div>

        {/* Current step */}
        <p style={{ margin: "0.5rem 0 0.25rem", fontSize: "0.8rem", color: "#6d28d9", fontFamily: "monospace", background: "#f5f3ff", padding: "0.375rem 0.625rem", borderRadius: "6px", display: "inline-block" }}>{currentStepText}</p>

        {progress?.lastUsed && (
          <p style={{ margin: "0.375rem 0 0", fontSize: "0.75rem", color: "#a78bfa" }}>
            {formatRelativeTime(progress.lastUsed)}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.625rem", marginTop: "1rem" }}>
          <button onClick={() => router.push(`/pattern/${pattern.id}`)}
            style={{ flex: 1, padding: "0.625rem", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }}>
            Continue →
          </button>
          <button onClick={() => setShowPreview(true)}
            style={{ padding: "0.625rem 0.75rem", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: "8px", fontSize: "0.875rem", cursor: "pointer" }}
            title="Preview chart">
            🗺️
          </button>
          <button onClick={() => { if (confirm(`Delete "${pattern.name}"?`)) onDelete(pattern.id); }}
            style={{ padding: "0.625rem 0.75rem", background: "transparent", color: "#c4b5fd", border: "1px solid #ede9fe", borderRadius: "8px", fontSize: "0.875rem", cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2"; (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#fecaca"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#c4b5fd"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#ede9fe"; }}>
            ✕
          </button>
        </div>
      </div>

      {showPreview && <PatternVisualPreview rows={rows} name={pattern.name} onClose={() => setShowPreview(false)} />}

      {showImageEditor && localImageData && (
        <div
          onClick={(e) => e.target === e.currentTarget && setShowImageEditor(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(4px)", zIndex: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem", paddingBottom: "max(1rem, env(safe-area-inset-bottom))", gap: "1rem" }}
        >
          {/* Canvas preview */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", overflow: "hidden" }}>
            <canvas
              ref={editorCanvasRef}
              style={{ maxWidth: "100%", maxHeight: "calc(100vh - 140px)", display: "block", borderRadius: "10px", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
            />
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0 }}>
            <button onClick={() => setEditorRotation(r => (r + 270) % 360)}
              style={{ width: "48px", height: "48px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", color: "white", fontSize: "1.3rem", cursor: "pointer" }}>↺</button>
            <button onClick={() => setEditorRotation(r => (r + 90) % 360)}
              style={{ width: "48px", height: "48px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", color: "white", fontSize: "1.3rem", cursor: "pointer" }}>↻</button>
            <button onClick={saveImage} disabled={editorSaving}
              style={{ height: "48px", padding: "0 1.25rem", background: editorSaving ? "#6d28d9" : "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "none", borderRadius: "12px", color: "white", fontSize: "0.875rem", fontWeight: 700, cursor: editorSaving ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(124,58,237,0.4)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {editorSaving ? "Saving…" : "💾 Save as Cover"}
            </button>
            <button onClick={() => setShowImageEditor(false)}
              style={{ width: "48px", height: "48px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px", color: "white", fontSize: "1rem", cursor: "pointer" }}>✕</button>
          </div>

          {editorRotation !== 0 && (
            <p style={{ margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.72rem" }}>{editorRotation}° rotation</p>
          )}
        </div>
      )}
    </div>
  );
}
