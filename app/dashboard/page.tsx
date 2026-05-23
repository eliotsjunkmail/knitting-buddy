"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PatternCard from "@/components/PatternCard";
import PatternUpload from "@/components/PatternUpload";

interface Row { label: string; steps: string[] }
interface Progress { currentRow: number; currentStep: number; lastUsed: string; timePerStep: Record<string, number> }
interface Pattern { id: string; name: string; rows: Row[]; imageData?: string | null; progress?: Progress | null; createdAt: string }
interface User { username: string; isGuest: boolean }

function ConvertModal({ onClose, onConverted }: { onClose: () => void; onConverted: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Something went wrong");
      else onConverted(data.user);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  const input: React.CSSProperties = { width: "100%", padding: "0.75rem 1rem", border: "2px solid #ede9fe", borderRadius: "10px", fontSize: "0.9rem", color: "#1e1b4b", outline: "none", background: "#faf5ff", fontFamily: "inherit" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(76,29,149,0.55)", backdropFilter: "blur(6px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "white", width: "100%", maxWidth: "400px", borderRadius: "20px", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", padding: "1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🧶</div>
          <h2 style={{ color: "white", margin: 0, fontWeight: 700, fontSize: "1.2rem" }}>Save Your Progress</h2>
          <p style={{ color: "rgba(255,255,255,0.75)", margin: "0.375rem 0 0", fontSize: "0.85rem" }}>Create an account to keep your patterns forever</p>
        </div>
        <form onSubmit={submit} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#6d28d9", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Choose a username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your_username" required autoComplete="username" style={input}
              onFocus={(e) => e.target.style.borderColor = "#7c3aed"} onBlur={(e) => e.target.style.borderColor = "#ede9fe"} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#6d28d9", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Choose a password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required autoComplete="new-password" style={input}
              onFocus={(e) => e.target.style.borderColor = "#7c3aed"} onBlur={(e) => e.target.style.borderColor = "#ede9fe"} />
          </div>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem", color: "#dc2626", fontSize: "0.85rem" }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ padding: "0.875rem", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "10px", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 15px rgba(124,58,237,0.4)", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Saving…" : "Create Account & Save"}
          </button>
          <button type="button" onClick={onClose}
            style={{ padding: "0.75rem", background: "transparent", color: "#8b5cf6", border: "none", borderRadius: "10px", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}>
            Maybe later
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

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
        <div style={{ fontSize: "3rem" }}>🧶</div>
        <p style={{ color: "#8b5cf6", marginTop: "1rem", fontSize: "0.9rem" }}>Loading…</p>
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
              <div style={{ color: "white", fontWeight: 700, fontSize: "1rem" }}>Knitting Buddy</div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.72rem" }}>
                {user?.isGuest ? "Browsing as guest" : `Hi, ${user?.username}!`}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {user?.isGuest && (
              <button onClick={() => setShowConvert(true)}
                style={{ padding: "0.5rem 0.875rem", background: "white", color: "#7c3aed", border: "none", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
                Save Progress
              </button>
            )}
            <button onClick={logout}
              style={{ padding: "0.5rem 1rem", background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 500, fontFamily: "inherit" }}>
              {user?.isGuest ? "Exit" : "Sign out"}
            </button>
          </div>
        </div>
      </div>

      {/* Guest banner */}
      {user?.isGuest && (
        <div style={{ background: "linear-gradient(135deg, #faf5ff, #f5f3ff)", borderBottom: "1px solid #ede9fe", padding: "0.75rem 1.5rem" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#6d28d9" }}>
              <strong>You&apos;re browsing as a guest.</strong> Your patterns are saved on this device session.
            </p>
            <button onClick={() => setShowConvert(true)}
              style={{ padding: "0.5rem 1rem", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", boxShadow: "0 2px 8px rgba(124,58,237,0.3)", whiteSpace: "nowrap" }}>
              Create free account →
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <button onClick={() => setShowUpload(true)}
          style={{ width: "100%", marginBottom: "2rem", padding: "1.25rem", background: "white", border: "2px dashed #c4b5fd", borderRadius: "16px", color: "#7c3aed", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.625rem", fontFamily: "inherit", transition: "all 0.2s" }}
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
      {showConvert && (
        <ConvertModal
          onClose={() => setShowConvert(false)}
          onConverted={(u) => { setUser(u); setShowConvert(false); }}
        />
      )}
    </div>
  );
}
