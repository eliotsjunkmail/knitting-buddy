"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PatternCard from "@/components/PatternCard";
import PatternUpload from "@/components/PatternUpload";

interface Row { label: string; steps: string[] }
interface Progress { currentRow: number; currentStep: number; lastUsed: string; timePerStep: Record<string, number> }
interface Pattern { id: string; name: string; rows: Row[]; imageData?: string | null; progress?: Progress | null; createdAt: string }

export default function DashboardPage() {
  const router = useRouter();
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    async function load() {
      const [meRes, patRes] = await Promise.all([fetch("/api/auth/me"), fetch("/api/patterns")]);
      if (!meRes.ok) { router.push("/"); return; }
      setUser((await meRes.json()).user);
      setPatterns((await patRes.json()).patterns);
      setLoading(false);
    }
    load();
  }, [router]);

  async function logout() {
    await fetch("/api/auth/me", { method: "DELETE" });
    router.push("/"); router.refresh();
  }

  async function handleSavePattern(name: string, rows: Row[], imageData: string) {
    const res = await fetch("/api/patterns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, rows, imageData }) });
    if (!res.ok) throw new Error("Failed to save");
    const { pattern } = await res.json();
    setPatterns((prev) => [pattern, ...prev]);
    setShowUpload(false);
    router.push(`/pattern/${pattern.id}`);
  }

  async function deletePattern(id: string) {
    await fetch(`/api/patterns/${id}`, { method: "DELETE" });
    setPatterns((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7ff" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3rem", animation: "bounce 1s infinite" }}>🧶</div>
        <p style={{ color: "#8b5cf6", marginTop: "1rem", fontSize: "0.9rem" }}>Loading your patterns…</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8f7ff" }}>
      {/* Top bar */}
      <div style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", boxShadow: "0 4px 20px rgba(76,29,149,0.3)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 1.5rem", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🧶</span>
            <div>
              <div style={{ color: "white", fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.01em" }}>Knitting Buddy</div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.75rem" }}>Hi, {user?.username}!</div>
            </div>
          </div>
          <button onClick={logout}
            style={{ padding: "0.5rem 1rem", background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 500, backdropFilter: "blur(4px)", transition: "background 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Add pattern */}
        <button onClick={() => setShowUpload(true)}
          style={{ width: "100%", marginBottom: "2rem", padding: "1.25rem", background: "white", border: "2px dashed #c4b5fd", borderRadius: "16px", color: "#7c3aed", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f5f3ff"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#7c3aed"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "white"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#c4b5fd"; }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 300 }}>+</span> Add New Pattern
        </button>

        {patterns.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🧶</div>
            <h2 style={{ color: "#4c1d95", fontWeight: 700, fontSize: "1.25rem", margin: "0 0 0.5rem" }}>No patterns yet</h2>
            <p style={{ color: "#8b5cf6", fontSize: "0.9rem" }}>Take a photo of your first knitting pattern to get started</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem" }}>
            {patterns.map((p) => <PatternCard key={p.id} pattern={p} onDelete={deletePattern} />)}
          </div>
        )}
      </div>

      {showUpload && <PatternUpload onSave={handleSavePattern} onCancel={() => setShowUpload(false)} />}
    </div>
  );
}
