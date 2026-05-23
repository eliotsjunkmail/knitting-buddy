"use client";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";

interface Row {
  label: string;
  steps: string[];
}

interface Progress {
  currentRow: number;
  currentStep: number;
  lastUsed: string;
}

interface Pattern {
  id: string;
  name: string;
  rows: Row[];
  imageData?: string | null;
  progress?: Progress | null;
  createdAt: string;
}

interface Props {
  pattern: Pattern;
  onDelete: (id: string) => void;
}

export default function PatternCard({ pattern, onDelete }: Props) {
  const router = useRouter();
  const progress = pattern.progress;
  const rows = pattern.rows as Row[];
  const totalRows = rows.length;
  const currentRow = progress?.currentRow ?? 0;
  const currentStep = progress?.currentStep ?? 0;
  const totalSteps = rows[currentRow]?.steps?.length ?? 0;

  const pct = totalRows > 0 ? Math.round((currentRow / totalRows) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm shadow-purple-100 border border-purple-100 overflow-hidden hover:shadow-md hover:shadow-purple-100 transition-shadow">
      {/* Image thumbnail */}
      {pattern.imageData && (
        <div className="h-32 overflow-hidden bg-purple-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pattern.imageData} alt={pattern.name} className="w-full h-full object-cover" />
        </div>
      )}
      {!pattern.imageData && (
        <div className="h-20 bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center">
          <span className="text-3xl">🧶</span>
        </div>
      )}

      <div className="p-4">
        <h3 className="font-semibold text-purple-900 text-lg leading-tight truncate">{pattern.name}</h3>

        {/* Progress bar */}
        <div className="mt-2 mb-1">
          <div className="flex justify-between text-xs text-purple-400 mb-1">
            <span>Row {currentRow + 1} of {totalRows}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-400 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Current position */}
        <p className="text-xs text-purple-500 mt-2">
          Step {currentStep + 1}/{totalSteps} · {rows[currentRow]?.steps?.[currentStep] ?? "—"}
        </p>

        {/* Last used */}
        {progress?.lastUsed && (
          <p className="text-xs text-purple-300 mt-1">
            Last used: {formatRelativeTime(progress.lastUsed)}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => router.push(`/pattern/${pattern.id}`)}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Continue
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${pattern.name}"?`)) onDelete(pattern.id);
            }}
            className="px-3 py-2 text-purple-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
