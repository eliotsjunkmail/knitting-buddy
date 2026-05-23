"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  _count: { patterns: number };
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users").then(async (r) => {
      if (r.status === 403) { router.push("/dashboard"); return; }
      const data = await r.json();
      setUsers(data.users ?? []);
      setLoading(false);
    });
  }, [router]);

  async function deleteUser(u: UserRow) {
    if (!confirm(`Delete "${u.username}" and all their patterns? This cannot be undone.`)) return;
    setDeleting(u.id);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (res.ok) setUsers((prev) => prev.filter((x) => x.id !== u.id));
    setDeleting(null);
  }

  const totalPatterns = users.reduce((s, u) => s + u._count.patterns, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f8f7ff" }}>
      <div style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", boxShadow: "0 4px 20px rgba(76,29,149,0.3)" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 1.5rem", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <a href="/dashboard" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: "1.25rem" }}>←</a>
            <div>
              <div style={{ color: "white", fontWeight: 700, fontSize: "1rem" }}>Admin</div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.72rem" }}>Knitting Buddy</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.8)" }}>
            <span><strong style={{ color: "white" }}>{users.length}</strong> users</span>
            <span><strong style={{ color: "white" }}>{totalPatterns}</strong> patterns</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "#8b5cf6" }}>Loading…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {users.map((u) => (
              <div key={u.id} style={{ background: "white", borderRadius: "12px", border: "1px solid #ede9fe", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 700, color: "#4c1d95", fontSize: "0.95rem" }}>{u.username}</span>
                    {u.isAdmin && <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: "4px", padding: "0.1rem 0.4rem" }}>ADMIN</span>}
                    {u.username.startsWith("guest_") && <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "#fef9ee", color: "#b45309", border: "1px solid #fde68a", borderRadius: "4px", padding: "0.1rem 0.4rem" }}>GUEST</span>}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#a78bfa", marginTop: "0.2rem" }}>
                    {u._count.patterns} pattern{u._count.patterns !== 1 ? "s" : ""} · joined {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {!u.isAdmin && (
                  <button
                    onClick={() => deleteUser(u)}
                    disabled={deleting === u.id}
                    style={{ padding: "0.5rem 1rem", background: deleting === u.id ? "#fecaca" : "white", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 600, cursor: deleting === u.id ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                    {deleting === u.id ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
