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
  const [pageCount, setPageCount] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [showAgreementHint, setShowAgreementHint] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const addPageRef = useRef<HTMLInputElement>(null);
  const agreementRef = useRef<HTMLLabelElement>(null);

  function retryUpload() {
    setStep("upload");
    setError("");
    setImagePreview(null);
    setRows([]);
    setPageCount(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function processImage(file: File, append: boolean) {
    setError(""); setLoading(true);
    if (!append) setStep("review");
    const compressed = await compressImage(file, 1200);
    const toStore = append ? compressed : await rotateDataUrl(compressed, 180);
    if (!append) setImagePreview(toStore);
    try {
      const blob = dataURLToBlob(compressed);
      const fd = new FormData();
      fd.append("image", blob, file.name);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.status === 401) { router.push("/"); return; }
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (append) {
        setRows((prev) => [...prev, ...(data.rows as Row[])]);
        setPageCount((n) => n + 1);
      } else {
        setRows(data.rows as Row[]);
        setImageData(toStore);
        if (data.name) setPatternName(data.name);
        setPageCount(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image");
    } finally { setLoading(false); }
  }

  function requireAgreement(): boolean {
    if (agreed) return true;
    setShowAgreementHint(true);
    agreementRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setShowAgreementHint(false), 2200);
    return false;
  }

  function handleFile(file: File) { processImage(file, false); }
  function handleAddPage(file: File) { processImage(file, true); }

  function updateStep(ri: number, si: number, val: string) {
    setRows((p) => { const n = [...p]; n[ri] = { ...n[ri], steps: n[ri].steps.map((s, i) => i === si ? val : s) }; return n; });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(76,29,149,0.55)", backdropFilter: "blur(6px)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "1rem", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
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

        {/* Always-mounted file inputs */}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        <input ref={addPageRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddPage(f); e.target.value = ""; }} />

        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {/* Upload */}
          {step === "upload" && (
            <div>
              {/* Agreement checkbox */}
              <label
                ref={agreementRef}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "0.75rem",
                  cursor: "pointer", marginBottom: "1rem",
                  background: agreed ? "#f5f3ff" : showAgreementHint ? "#fff7ed" : "#faf5ff",
                  border: `2px solid ${agreed ? "#a78bfa" : showAgreementHint ? "#fb923c" : "#ede9fe"}`,
                  borderRadius: "12px", padding: "0.875rem 1rem",
                  transition: "border-color 0.2s, background 0.2s",
                  boxShadow: showAgreementHint ? "0 0 0 3px rgba(251,146,60,0.25)" : "none",
                }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  style={{ marginTop: "0.15rem", width: "18px", height: "18px", accentColor: "#7c3aed", flexShrink: 0, cursor: "pointer" }}
                />
                <span style={{ fontSize: "0.825rem", color: "#4c1d95", lineHeight: 1.5 }}>
                  I confirm that I have the right to upload this pattern — I created it, own it, or have the copyright holder&apos;s permission to digitise and store it.
                </span>
              </label>

              {showAgreementHint && (
                <p style={{ margin: "-0.5rem 0 0.875rem", fontSize: "0.8rem", color: "#ea580c", fontWeight: 600 }}>
                  ☝️ Please confirm the agreement above first.
                </p>
              )}

              {/* Drop zone */}
              <div
                onClick={() => { if (!requireAgreement()) return; fileRef.current?.click(); }}
                style={{
                  border: "2px dashed #c4b5fd", borderRadius: "16px", padding: "3rem 2rem",
                  textAlign: "center", cursor: agreed ? "pointer" : "not-allowed",
                  background: "#faf5ff", transition: "all 0.2s",
                  opacity: agreed ? 1 : 0.55,
                }}
                onMouseEnter={(e) => { if (!agreed) return; (e.currentTarget as HTMLDivElement).style.borderColor = "#7c3aed"; (e.currentTarget as HTMLDivElement).style.background = "#f5f3ff"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#c4b5fd"; (e.currentTarget as HTMLDivElement).style.background = "#faf5ff"; }}>
                <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📷</div>
                <p style={{ margin: 0, fontWeight: 600, color: "#4c1d95" }}>Take a photo or upload an image</p>
                <p style={{ margin: "0.375rem 0 0", fontSize: "0.8rem", color: "#8b5cf6" }}>Claude AI will extract your pattern automatically</p>
              </div>

              <button
                onClick={() => { if (!requireAgreement()) return; setRows([{ label: "Row 1", steps: ["k1"] }]); setStep("review"); }}
                style={{ width: "100%", marginTop: "0.875rem", padding: "0.75rem", background: "transparent", color: agreed ? "#8b5cf6" : "#c4b5fd", border: "1px solid #ede9fe", borderRadius: "10px", cursor: agreed ? "pointer" : "not-allowed", fontSize: "0.875rem" }}>
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#8b5cf6" }}>Review and edit the extracted steps:</p>
                    {pageCount > 0 && <span style={{ fontSize: "0.75rem", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: "99px", padding: "0.2rem 0.6rem", fontWeight: 600 }}>{pageCount} page{pageCount !== 1 ? "s" : ""}</span>}
                  </div>
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
          {step === "review" && rows.length > 0 && (
            <>
              <button onClick={() => !loading && addPageRef.current?.click()} disabled={loading}
                style={{ flex: 1, padding: "0.75rem", background: "transparent", color: loading ? "#c4b5fd" : "#7c3aed", border: `2px dashed ${loading ? "#ede9fe" : "#c4b5fd"}`, borderRadius: "10px", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
                {loading ? "Processing…" : "+ Add Page"}
              </button>
              <button onClick={() => !loading && setStep("name")} disabled={loading}
                style={{ flex: 1, padding: "0.75rem", background: loading ? "#c4b5fd" : "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "10px", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, boxShadow: loading ? "none" : "0 4px 12px rgba(124,58,237,0.3)" }}>
                Next →
              </button>
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

async function rotateDataUrl(dataUrl: string, deg: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const swap = deg === 90 || deg === 270;
      const canvas = document.createElement("canvas");
      canvas.width  = swap ? img.height : img.width;
      canvas.height = swap ? img.width  : img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.src = dataUrl;
  });
}
