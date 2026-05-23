"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Something went wrong");
      else { router.push("/dashboard"); router.refresh(); }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: "64px", height: "64px", background: "rgba(255,255,255,0.15)", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "2rem", backdropFilter: "blur(10px)" }}>🧶</div>
          <h1 style={{ color: "white", fontSize: "1.75rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Knitting Buddy</h1>
          <p style={{ color: "rgba(255,255,255,0.7)", marginTop: "0.375rem", fontSize: "0.9rem" }}>Follow your patterns, stitch by stitch</p>
        </div>

        {/* Card */}
        <div style={{ background: "white", borderRadius: "16px", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", overflow: "hidden" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid #ede9fe" }}>
            {(["login", "register"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
                style={{ flex: 1, padding: "1rem", fontSize: "0.875rem", fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.2s",
                  background: mode === m ? "white" : "#faf5ff",
                  color: mode === m ? "#7c3aed" : "#a78bfa",
                  borderBottom: mode === m ? "2px solid #7c3aed" : "2px solid transparent" }}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Username */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#6d28d9", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your_username" required autoComplete="username"
                style={{ width: "100%", padding: "0.75rem 1rem", border: "2px solid #ede9fe", borderRadius: "10px", fontSize: "0.95rem", color: "#1e1b4b", outline: "none", transition: "border 0.2s", background: "#faf5ff" }}
                onFocus={(e) => e.target.style.borderColor = "#7c3aed"}
                onBlur={(e) => e.target.style.borderColor = "#ede9fe"} />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#6d28d9", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "At least 6 characters" : "••••••••"} required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                style={{ width: "100%", padding: "0.75rem 1rem", border: "2px solid #ede9fe", borderRadius: "10px", fontSize: "0.95rem", color: "#1e1b4b", outline: "none", transition: "border 0.2s", background: "#faf5ff" }}
                onFocus={(e) => e.target.style.borderColor = "#7c3aed"}
                onBlur={(e) => e.target.style.borderColor = "#ede9fe"} />
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.875rem" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "0.875rem", background: loading ? "#a78bfa" : "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "10px", fontSize: "0.95rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s", boxShadow: "0 4px 15px rgba(124,58,237,0.4)", letterSpacing: "0.02em" }}>
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
