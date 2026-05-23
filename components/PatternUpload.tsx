"use client";
import { useState, useRef } from "react";

interface Row {
  label: string;
  steps: string[];
  note?: string;
}

interface Props {
  onSave: (name: string, rows: Row[], imageData: string) => Promise<void>;
  onCancel: () => void;
}

export default function PatternUpload({ onSave, onCancel }: Props) {
  const [step, setStep] = useState<"upload" | "review" | "name">("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [patternName, setPatternName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    // Compress image on client side
    const compressed = await compressImage(file, 1200);
    setImagePreview(compressed.dataUrl);

    // Upload for OCR
    setLoading(true);
    setStep("review");
    try {
      const formData = new FormData();
      // Convert dataUrl back to blob for upload
      const blob = await fetch(compressed.dataUrl).then((r) => r.blob());
      formData.append("image", blob, file.name);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setRows(data.rows as Row[]);
      setImageData(data.imageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function updateStep(rowIdx: number, stepIdx: number, val: string) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], steps: [...next[rowIdx].steps] };
      next[rowIdx].steps[stepIdx] = val;
      return next;
    });
  }

  function addStep(rowIdx: number) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], steps: [...next[rowIdx].steps, ""] };
      return next;
    });
  }

  function removeStep(rowIdx: number, stepIdx: number) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], steps: next[rowIdx].steps.filter((_, i) => i !== stepIdx) };
      return next;
    });
  }

  function updateRowLabel(rowIdx: number, label: string) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], label };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, { label: `Row ${prev.length + 1}`, steps: [""] }]);
  }

  function removeRow(rowIdx: number) {
    setRows((prev) => prev.filter((_, i) => i !== rowIdx));
  }

  async function handleSave() {
    if (!patternName.trim()) return;
    setLoading(true);
    try {
      await onSave(patternName.trim(), rows, imageData);
    } catch {
      setError("Failed to save pattern");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-purple-950/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl shadow-purple-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-100">
          <h2 className="text-lg font-semibold text-purple-900">
            {step === "upload" ? "Add Pattern" : step === "review" ? "Review Pattern" : "Name Your Pattern"}
          </h2>
          <button onClick={onCancel} className="text-purple-300 hover:text-purple-500 text-xl">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {/* STEP 1: Upload */}
          {step === "upload" && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-2xl p-10 text-center cursor-pointer transition-colors bg-purple-50/50 hover:bg-purple-50"
              >
                <div className="text-4xl mb-3">📷</div>
                <p className="text-purple-700 font-medium">Take a photo or upload an image</p>
                <p className="text-purple-400 text-sm mt-1">JPG, PNG, WebP — Claude will extract the pattern</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {/* Manual entry option */}
              <button
                onClick={() => { setRows([{ label: "Row 1", steps: ["k1"] }]); setStep("review"); }}
                className="w-full mt-3 py-2.5 text-purple-500 hover:text-purple-700 text-sm border border-purple-200 hover:border-purple-300 rounded-xl transition-colors"
              >
                Enter pattern manually
              </button>
            </div>
          )}

          {/* STEP 2: Review & Edit */}
          {step === "review" && (
            <div>
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="Pattern" className="w-full rounded-xl mb-4 max-h-40 object-cover" />
              )}

              {loading && (
                <div className="text-center py-8">
                  <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3" />
                  <p className="text-purple-500 text-sm">Analysing pattern with Claude…</p>
                </div>
              )}

              {error && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>
              )}

              {!loading && rows.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs text-purple-400">Review and edit the extracted rows below:</p>

                  {rows.map((row, ri) => (
                    <div key={ri} className="border border-purple-100 rounded-xl p-3 bg-purple-50/30">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          value={row.label}
                          onChange={(e) => updateRowLabel(ri, e.target.value)}
                          className="font-semibold text-purple-800 text-sm bg-transparent border-b border-purple-200 focus:outline-none focus:border-purple-400 flex-1"
                        />
                        <button onClick={() => removeRow(ri)} className="text-purple-300 hover:text-red-400 text-xs">✕</button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {row.steps.map((step, si) => (
                          <div key={si} className="flex items-center bg-white border border-purple-200 rounded-lg overflow-hidden">
                            <input
                              value={step}
                              onChange={(e) => updateStep(ri, si, e.target.value)}
                              className="text-xs text-purple-700 px-2 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-purple-300"
                            />
                            <button
                              onClick={() => removeStep(ri, si)}
                              className="px-1.5 text-purple-200 hover:text-red-400 transition-colors"
                            >×</button>
                          </div>
                        ))}
                        <button
                          onClick={() => addStep(ri)}
                          className="text-xs text-purple-400 hover:text-purple-600 border border-dashed border-purple-200 rounded-lg px-2 py-1"
                        >+ step</button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addRow}
                    className="w-full py-2 text-sm text-purple-400 hover:text-purple-600 border border-dashed border-purple-200 rounded-xl transition-colors"
                  >+ Add Row</button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Name */}
          {step === "name" && (
            <div>
              <label className="block text-sm font-medium text-purple-800 mb-2">Pattern name</label>
              <input
                type="text"
                value={patternName}
                onChange={(e) => setPatternName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                placeholder="e.g. Cosy Winter Scarf"
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 text-purple-900 placeholder-purple-200"
              />
              <p className="text-xs text-purple-400 mt-2">{rows.length} row{rows.length !== 1 ? "s" : ""} detected</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-purple-100 flex gap-3">
          {step === "review" && !loading && rows.length > 0 && (
            <>
              <button onClick={onCancel} className="flex-1 py-2.5 border border-purple-200 text-purple-500 rounded-xl text-sm hover:bg-purple-50 transition-colors">Cancel</button>
              <button
                onClick={() => setStep("name")}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Next →
              </button>
            </>
          )}
          {step === "name" && (
            <>
              <button onClick={() => setStep("review")} className="flex-1 py-2.5 border border-purple-200 text-purple-500 rounded-xl text-sm hover:bg-purple-50 transition-colors">← Back</button>
              <button
                onClick={handleSave}
                disabled={!patternName.trim() || loading}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {loading ? "Saving…" : "Save Pattern"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

async function compressImage(file: File, maxWidth: number): Promise<{ dataUrl: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.85) });
    };
    img.src = url;
  });
}
