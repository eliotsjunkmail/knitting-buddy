"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Row { label: string; steps: string[]; note?: string }

export default function PatternUpload({ onSave, onCancel }: { onSave: (name: string, rows: Row[], imageData: string) => Promise<void>; onCancel: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "review" | "name">("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [patternName, setPatternName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function retryUpload() {
    setStep("upload");
    setError("");
    setImagePreview(null);
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    setError(""); setLoading(true); setStep("review");
    const compressed = await compressImage(file, 1200);
    setImagePreview(compressed);
    try {
      const blob = dataURLToBlob(compressed);
      const fd = new FormData();
      fd.append("image", blob, file.name);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.status === 401) { router.push("/"); return; }
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setRows(data.rows as Row[]);
      setImageData(data.imageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image");
    } finally { setLoading(false); }
  }

  function updateStep(ri: number, si: number, val: string) {
    setRows((p) => { const n = [...p]; n[ri] = { ...n[ri], steps: n[ri].steps.map((s, i) => i === si ? val : s) }; return n; });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(76,29,149,0.55)", backdropFilter: "blur(6px)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "1rem" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: "white", width: "100%", maxWidth: "520px", borderRadius: "20px 20px 16px 16px", boxShadow: "0 -8px 40px rgba(0,0,0,0.25)", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #ede9fe", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#4c1d95" }}>
              {step === "upload" ? "Add Pattern" : step === "review" ? "Review Pattern" : "Name Your Pattern"}
            </h2>
            <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.5rem" }}>
              {["upload", "review", "name"].map((s, i) => (
                <div key={s} style={{ width: "24px", height: "4px", borderRadius: "2px", background: ["upload", "review", "name"].indexOf(step) >= i ? "#7c3aed" : "#ede9fe", transition: "background 0.3s" }} />
              ))}
            </div>
          </div>
          <button onClick={onCancel} style={{ width: "32px", height: "32px", background: "#f5f3ff", border: "none", borderRadius: "8px", color: "#8b5cf6", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {/* Upload */}
          {step === "upload" && (
            <div>
              <div onClick={() => fileRef.current?.click()}
                style={{ border: "2px dashed #c4b5fd", borderRadius: "16px", padding: "3rem 2rem", textAlign: "center", cursor: "pointer", background: "#faf5ff", transition: "all 0.2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#7c3aed"; (e.currentTarget as HTMLDivElement).style.background = "#f5f3ff"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#c4b5fd"; (e.currentTarget as HTMLDivElement).style.background = "#faf5ff"; }}>
                <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📷</div>
                <p style={{ margin: 0, fontWeight: 600, color: "#4c1d95" }}>Take a photo or upload an image</p>
                <p style={{ margin: "0.375rem 0 0", fontSize: "0.8rem", color: "#8b5cf6" }}>Claude AI will extract your pattern automatically</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <button onClick={() => { setRows([{ label: "Row 1", steps: ["k1"] }]); setStep("review"); }}
                style={{ width: "100%", marginTop: "0.875rem", padding: "0.75rem", background: "transparent", color: "#8b5cf6", border: "1px solid #ede9fe", borderRadius: "10px", cursor: "pointer", fontSize: "0.875rem" }}>
                Enter manually instead
              </button>
            </div>
          )}

          {/* Review */}
          {step === "review" && (
            <div>
              {imagePreview && <img src={imagePreview} alt="Pattern" style={{ width: "100%", borderRadius: "12px", marginBottom: "1rem", maxHeight: "150px", objectFit: "cover" }} />}
              {loading && (
                <div style={{ textAlign: "center", padding: "3rem 0" }}>
                  <div style={{ width: "40px", height: "40px", border: "4px solid #ede9fe", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 1rem" }} />
                  <p style={{ color: "#8b5cf6", fontSize: "0.875rem" }}>Claude is reading your pattern…</p>
                </div>
              )}
              {error && (
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{error}</div>
                  <button onClick={retryUpload}
                    style={{ width: "100%", padding: "0.75rem", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
                    Try a Different Photo
                  </button>
                </div>
              )}
              {!loading && rows.length > 0 && (
                <div>
                  <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: "#8b5cf6" }}>Review and edit the extracted steps:</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    {rows.map((row, ri) => (
                      <div key={ri} style={{ border: "1px solid #ede9fe", borderRadius: "12px", padding: "0.875rem", background: "#faf5ff" }}>
                        <input value={row.label} onChange={(e) => setRows((p) => p.map((r, i) => i === ri ? { ...r, label: e.target.value } : r))}
                          style={{ display: "block", width: "100%", fontWeight: 700, fontSize: "0.875rem", color: "#4c1d95", background: "transparent", border: "none", borderBottom: "1px solid #ede9fe", outline: "none", marginBottom: "0.75rem", paddingBottom: "0.375rem" }} />
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                          {row.steps.map((s, si) => (
                            <div key={si} style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid #ddd6fe", borderRadius: "8px", overflow: "hidden" }}>
                              <input value={s} onChange={(e) => updateStep(ri, si, e.target.value)}
                                style={{ padding: "0.375rem 0.5rem", fontSize: "0.8rem", fontFamily: "monospace", color: "#4c1d95", border: "none", outline: "none", width: "72px", background: "transparent" }} />
                            </div>
                          ))}
                          <button onClick={() => setRows((p) => p.map((r, i) => i === ri ? { ...r, steps: [...r.steps, ""] } : r))}
                            style={{ padding: "0.375rem 0.75rem", background: "transparent", border: "1px dashed #c4b5fd", borderRadius: "8px", color: "#8b5cf6", cursor: "pointer", fontSize: "0.8rem" }}>+ step</button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setRows((p) => [...p, { label: `Row ${p.length + 1}`, steps: [""] }])}
                      style={{ padding: "0.75rem", background: "transparent", border: "1px dashed #c4b5fd", borderRadius: "10px", color: "#8b5cf6", cursor: "pointer", fontSize: "0.875rem" }}>+ Add Row</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Name */}
          {step === "name" && (
            <div>
              {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.875rem", marginBottom: "1rem" }}>{error}</div>}
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#6d28d9", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Pattern Name</label>
              <input type="text" value={patternName} onChange={(e) => setPatternName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && patternName.trim()) onSave(patternName.trim(), rows, imageData); }}
                placeholder="e.g. Cosy Winter Scarf" autoFocus
                style={{ width: "100%", padding: "0.875rem 1rem", border: "2px solid #ede9fe", borderRadius: "12px", fontSize: "1rem", color: "#1e1b4b", outline: "none", background: "#faf5ff" }}
                onFocus={(e) => e.target.style.borderColor = "#7c3aed"}
                onBlur={(e) => e.target.style.borderColor = "#ede9fe"} />
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#a78bfa" }}>{rows.length} row{rows.length !== 1 ? "s" : ""} · {rows.reduce((s, r) => s + r.steps.length, 0)} steps total</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #ede9fe", display: "flex", gap: "0.75rem" }}>
          {step === "review" && !loading && rows.length > 0 && (
            <>
              <button onClick={onCancel} style={{ flex: 1, padding: "0.75rem", background: "transparent", color: "#8b5cf6", border: "1px solid #ede9fe", borderRadius: "10px", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={() => setStep("name")} style={{ flex: 1, padding: "0.75rem", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>Next →</button>
            </>
          )}
          {step === "name" && (
            <>
              <button onClick={() => setStep("review")} disabled={loading} style={{ flex: 1, padding: "0.75rem", background: "transparent", color: "#8b5cf6", border: "1px solid #ede9fe", borderRadius: "10px", cursor: "pointer", fontWeight: 600 }}>← Back</button>
              <button
                onClick={async () => {
                  setError(""); setLoading(true);
                  try { await onSave(patternName.trim(), rows, imageData); }
                  catch (err) { setError(err instanceof Error ? err.message : "Failed to save"); setLoading(false); }
                }}
                disabled={!patternName.trim() || loading}
                style={{ flex: 1, padding: "0.75rem", background: !patternName.trim() || loading ? "#c4b5fd" : "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "10px", cursor: !patternName.trim() || loading ? "not-allowed" : "pointer", fontWeight: 700, boxShadow: patternName.trim() && !loading ? "0 4px 12px rgba(124,58,237,0.3)" : "none" }}>
                {loading ? "Saving…" : "Save Pattern"}
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function dataURLToBlob(dataURL: string): Blob {
  const [header, b64] = dataURL.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function compressImage(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = url;
  });
}
