"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PatternCard from "@/components/PatternCard";
import PatternUpload from "@/components/PatternUpload";

interface Row { label: string; steps: string[]; }
interface Progress { currentRow: number; currentStep: number; lastUsed: string; timePerStep: Record<string,number>; }
interface Pattern {
  id: string; name: string; rows: Row[]; imageData?: string | null;
  progress?: Progress | null; createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    async function load() {
      const [meRes, patRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/patterns"),
      ]);
      if (!meRes.ok) { router.push("/"); return; }
      const { user } = await meRes.json();
      const { patterns } = await patRes.json();
      setUser(user);
      setPatterns(patterns);
      setLoading(false);
    }
    load();
  }, [router]);

  async function logout() {
    await fetch("/api/auth/me", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  async function handleSavePattern(name: string, rows: Row[], imageData: string) {
    const res = await fetch("/api/patterns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rows, imageData }),
    });
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

  if (loading) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-3">🧶</div>
          <p className="text-purple-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-purple-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧶</span>
            <div>
              <h1 className="font-bold text-purple-900 leading-tight">Knitting Buddy</h1>
              <p className="text-xs text-purple-400">Hi, {user?.username}!</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-purple-300 hover:text-purple-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-purple-50"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Add pattern button */}
        <button
          onClick={() => setShowUpload(true)}
          className="w-full mb-6 py-4 border-2 border-dashed border-purple-300 hover:border-purple-500 rounded-2xl text-purple-500 hover:text-purple-700 font-medium transition-colors flex items-center justify-center gap-2 hover:bg-purple-50/50 bg-white"
        >
          <span className="text-xl">+</span> Add New Pattern
        </button>

        {/* Pattern grid */}
        {patterns.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🧶</div>
            <p className="text-purple-700 font-semibold text-lg">No patterns yet</p>
            <p className="text-purple-400 text-sm mt-1">Take a photo of your first pattern to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {patterns.map((p) => (
              <PatternCard key={p.id} pattern={p} onDelete={deletePattern} />
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <PatternUpload
          onSave={handleSavePattern}
          onCancel={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
