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
    setError(""); setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Something went wrong");
      else { router.push("/dashboard"); router.refresh(); }
    } catch { setError("Network error — please try again"); }
    finally { setLoading(false); }
  }

  async function continueAsGuest() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (!res.ok) { setError("Failed to start guest session"); return; }

      // Seed the demo pattern so new guests land straight in the pattern
      const patRes = await fetch("/api/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Elephant Love Blanket (large)",
          imageData: null,
          rows: [
            { label: "Cast on", steps: ["cast on 165 stitches"] },
            { label: "Row 1 to 15", steps: ["knit across all stitches"], note: "Border rows" },
            { label: "Row 16 [WS]", steps: ["k10", "p145", "k10"], note: "Repeat every WS row" },
            { label: "Row 17 [RS]", steps: ["knit across all stitches"] },
            { label: "Row 19 [RS]", steps: ["knit across all stitches"] },
            { label: "Row 21 [RS]", steps: ["knit across all stitches"] },
            { label: "Row 23 [RS]", steps: ["k19","p3","k8","p3","k16","p3","k8","p3","k39","p3","k8","p3","k16","p3","k8","p3","k19"] },
            { label: "Row 25 [RS]", steps: ["As row 23"] },
            { label: "Row 27 [RS]", steps: ["k19","p4","k6","p4","k16","p4","k6","p4","k39","p4","k6","p4","k16","p4","k6","p4","k19"] },
            { label: "Row 29 [RS]", steps: ["k18","p16","k14","p16","k37","p16","k14","p16","k18"] },
            { label: "Row 31 [RS]", steps: ["k18","p16","k14","p16","k18","p1","k18","p16","k14","p16","k18"] },
            { label: "Row 33 [RS]", steps: ["k16","p1","k1","p16","k12","p1","k1","p16","k17","p3","k17","p16","k1","p1","k12","p16","k1","p1","k16"] },
            { label: "Row 35 [RS]", steps: ["k16","p1","k1","p17","k11","p1","k1","p17","k15","p5","k15","p17","k1","p1","k11","p17","k1","p1","k16"] },
            { label: "Row 37 [RS]", steps: ["k17","p11","k4","p6","k9","p11","k4","p6","k11","p7","k11","p6","k4","p11","k9","p6","k4","p11","k17"] },
            { label: "Row 39 [RS]", steps: ["k18","p9","k1","p4","k1","p7","k8","p9","k1","p4","k1","p7","k8","p9","k8","p7","k1","p4","k1","p9","k8","p7","k1","p4","k1","p9","k18"] },
            { label: "Row 41 [RS]", steps: ["k19","p8","k1","p13","k8","p8","k1","p13","k6","p11","k6","p13","k1","p8","k8","p13","k1","p8","k19"] },
            { label: "Row 43 [RS]", steps: ["k21","p6","k1","p8","k3","p2","k10","p6","k1","p8","k3","p2","k5","p13","k5","p2","k3","p8","k1","p6","k10","p2","k3","p8","k1","p6","k21"] },
            { label: "Row 45 [RS]", steps: ["k28","p7","k4","p2","k17","p7","k4","p2","k5","p13","k5","p2","k4","p7","k17","p2","k4","p7","k28"] },
            { label: "Row 47 [RS]", steps: ["k29","p5","k5","p3","k17","p5","k5","p3","k4","p13","k4","p3","k5","p5","k17","p3","k5","p5","k29"] },
            { label: "Row 49 [RS]", steps: ["k40","p2","k28","p2","k5","p5","k1","p5","k5","p2","k28","p2","k40"] },
            { label: "Row 51 [RS]", steps: ["k78","p3","k3","p3","k78"] },
            { label: "Row 53 [RS]", steps: ["knit across all stitches"] },
            { label: "Row 55 [RS]", steps: ["knit across all stitches"] },
            { label: "Row 57 [RS]", steps: ["knit across all stitches"] },
            { label: "Row 58 [WS]", steps: ["k10","p145","k10"] },
            { label: "Repeat rows 23–58", steps: ["repeat rows 23 to 58 six more times"], note: "7 repeats total" },
            { label: "Border", steps: ["knit 15 rows to complete the border"] },
            { label: "Cast off", steps: ["cast off all stitches", "weave in any loose ends with darning needle"] },
          ],
        }),
      });

      router.push("/dashboard");
      router.refresh();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  const input: React.CSSProperties = { width: "100%", padding: "0.75rem 1rem", border: "2px solid #ede9fe", borderRadius: "10px", fontSize: "0.95rem", color: "#1e1b4b", outline: "none", background: "#faf5ff", fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #8b5cf6 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: "64px", height: "64px", background: "rgba(255,255,255,0.15)", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "2rem", backdropFilter: "blur(10px)" }}>🧶</div>
          <h1 style={{ color: "white", fontSize: "1.75rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Knit Next</h1>
          <p style={{ color: "rgba(255,255,255,0.7)", marginTop: "0.375rem", fontSize: "0.9rem" }}>Follow your patterns, stitch by stitch</p>
        </div>

        {/* Card */}
        <div style={{ background: "white", borderRadius: "16px", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #ede9fe" }}>
            {(["login", "register"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
                style={{ flex: 1, padding: "1rem", fontSize: "0.875rem", fontWeight: 600, border: "none", cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit",
                  background: mode === m ? "white" : "#faf5ff", color: mode === m ? "#7c3aed" : "#a78bfa",
                  borderBottom: mode === m ? "2px solid #7c3aed" : "2px solid transparent" }}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <div style={{ padding: "1.75rem" }}>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#6d28d9", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. woolly_knitter" required autoComplete="username" style={input}
                  onFocus={(e) => e.target.style.borderColor = "#7c3aed"} onBlur={(e) => e.target.style.borderColor = "#ede9fe"} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#6d28d9", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "At least 6 characters" : "••••••••"} required
                  autoComplete={mode === "login" ? "current-password" : "new-password"} style={input}
                  onFocus={(e) => e.target.style.borderColor = "#7c3aed"} onBlur={(e) => e.target.style.borderColor = "#ede9fe"} />
              </div>

              {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", fontSize: "0.85rem" }}>{error}</div>}

              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: "0.875rem", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white", border: "none", borderRadius: "10px", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px rgba(124,58,237,0.4)", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
              <div style={{ flex: 1, height: "1px", background: "#ede9fe" }} />
              <span style={{ fontSize: "0.75rem", color: "#c4b5fd", fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "#ede9fe" }} />
            </div>

            {/* Guest */}
            <button onClick={continueAsGuest} disabled={loading}
              style={{ width: "100%", padding: "0.875rem", background: "#faf5ff", color: "#7c3aed", border: "2px solid #ede9fe", borderRadius: "10px", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", opacity: loading ? 0.7 : 1 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f5f3ff"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#c4b5fd"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#faf5ff"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#ede9fe"; }}>
              Continue as Guest
            </button>
            <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#c4b5fd", margin: "0.625rem 0 0" }}>Guest data is saved — create an account anytime to keep it</p>
          </div>
        </div>
      </div>
    </div>
  );
}
