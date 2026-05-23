"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";
import { expandSteps, renderSwatch } from "@/lib/knittingSwatch";
import PatternVisualPreview from "@/components/PatternVisualPreview";

interface Row { label: string; steps: string[] }
interface Progress { currentRow: number; currentStep: number; lastUsed: string }
interface Pattern { id: string; name: string; rows: Row[]; imageData?: string | null; progress?: Progress | null; createdAt: string }

export default function PatternCard({ pattern, onDelete }: { pattern: Pattern; onDelete: (id: string) => void }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const rows = pattern.rows as Row[];
  const progress = pattern.progress;
  const currentRow = progress?.currentRow ?? 0;
  const currentStep = progress?.currentStep ?? 0;
  const totalRows = rows.length;
  const pct = totalRows > 0 ? Math.round((currentRow / totalRows) * 100) : 0;
  const currentStepText = rows[currentRow]?.steps?.[currentStep] ?? "—";

  // Expand pattern rows into stitch grid for the thumbnail canvas
  const grid = useMemo(() => rows.map(r => expandSteps(r.steps)), [rows]);

  useEffect(() => {
    if (canvasRef.current && grid.length > 0) renderSwatch(canvasRef.current, grid);
  }, [grid]);

  return (
    <div
      style={{ background: "white", borderRadius: "16px", overflow: "hidden", boxShadow: "0 2px 8px rgba(109,40,217,0.08)", border: "1px solid #ede9fe", transition: "box-shadow 0.2s, transform 0.2s", cursor: "default" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(109,40,217,0.16)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(109,40,217,0.08)"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
    >
      {/* Swatch thumbnail */}
      <div style={{ height: "120px", overflow: "hidden", background: "#e4e4e4" }}>
        <canvas
          ref={canvasRef}
          width={430}
          style={{ display: "block", width: "100%", imageRendering: "pixelated" }}
        />
      </div>

      <div style={{ padding: "1.25rem" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#1e1b4b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pattern.name}</h3>

        {/* Progress bar */}
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
          <button
            onClick={() => router.push(`/pattern/${pattern.id}`)}
            style={{ flex: 2, padding: "0.625rem", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }}>
            Continue →
          </button>
          <button
            onClick={() => setShowPreview(true)}
            style={{ flex: 1, padding: "0.625rem", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
            Preview
          </button>
          <button
            onClick={() => { if (confirm(`Delete "${pattern.name}"?`)) onDelete(pattern.id); }}
            style={{ flex: 1, padding: "0.625rem", background: "transparent", color: "#c4b5fd", border: "1px solid #ede9fe", borderRadius: "8px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
            onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "#fef2f2"; b.style.color = "#dc2626"; b.style.borderColor = "#fecaca"; }}
            onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.color = "#c4b5fd"; b.style.borderColor = "#ede9fe"; }}>
            Delete
          </button>
        </div>
      </div>

      {showPreview && <PatternVisualPreview rows={rows} name={pattern.name} onClose={() => setShowPreview(false)} />}
    </div>
  );
}
