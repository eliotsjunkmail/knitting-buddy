export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (d >= todayStart) return `Today at ${timeStr}`;
  if (d >= yesterdayStart) return `Yesterday at ${timeStr}`;
  if (d >= weekStart) {
    const day = d.toLocaleDateString("en-US", { weekday: "long" });
    return `${day} at ${timeStr}`;
  }
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${dateStr} at ${timeStr}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export function stepKey(row: number, step: number): string {
  return `${row}-${step}`;
}
