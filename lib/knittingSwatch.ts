// Shared knitting-swatch rendering logic
// Used by PatternVisualPreview (full preview modal) and PatternCard (thumbnail)

export type Stitch = "knit" | "purl" | "yo" | "decrease" | "cable-hi" | "cable-lo" | "slip";

export const PALETTE: Record<Stitch, { bg: number; mark: number }> = {
  "knit":      { bg: 215, mark: 148 },
  "purl":      { bg: 155, mark: 105 },
  "yo":        { bg: 246, mark: 195 },
  "decrease":  { bg: 132, mark:  78 },
  "cable-hi":  { bg: 234, mark: 170 },
  "cable-lo":  { bg: 108, mark:  68 },
  "slip":      { bg: 192, mark: 142 },
};

// ── Step parser ───────────────────────────────────────────────────────────────
function parseCableCount(s: string): number {
  const m1 = s.match(/^c(\d+)[fb]/i);
  if (m1) return parseInt(m1[1]);
  const m2 = s.match(/^(\d+)\/(\d+)[lr]?c/i);
  if (m2) return parseInt(m2[1]) + parseInt(m2[2]);
  return 0;
}

function splitTokens(s: string): string[] {
  return s.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
}

function expandSingleStep(s: string): Stitch[] {
  const out: Stitch[] = [];
  if (!s || s === "-") { out.push("knit"); return out; }
  if (s === "yo") { out.push("yo"); return out; }
  if (/k2tog|ssk|skpo?|k3tog|s2kp|cdd|p2tog|p3tog|p2togtbl/.test(s)) { out.push("decrease"); return out; }
  const cn = parseCableCount(s);
  if (cn > 0) {
    const half = Math.floor(cn / 2);
    for (let i = 0; i < half; i++) out.push("cable-hi");
    for (let i = half; i < cn; i++) out.push("cable-lo");
    return out;
  }
  if (/^sl\d*[kwp]?$/.test(s) || s === "slk" || s === "slp") { out.push("slip"); return out; }
  const pm = s.match(/^p(\d*)(?:tbl)?$/);
  if (pm || s === "pb") {
    const n = pm ? (parseInt(pm[1] || "1") || 1) : 1;
    for (let i = 0; i < n; i++) out.push("purl");
    return out;
  }
  const km = s.match(/^k(\d*)(?:tbl|fb)?$/);
  if (km) {
    const n = parseInt(km[1] || "1") || 1;
    for (let i = 0; i < n; i++) out.push("knit");
    return out;
  }
  if (/^m1[lr]?$|^kfb$|^pfb$/.test(s)) { out.push("knit"); return out; }
  if (/^co$|^bo$|^cast|^bind/.test(s)) return out;
  out.push("knit");
  return out;
}

export function expandSteps(steps: string[]): Stitch[] {
  // Phase 1 — expand bracket/parenthesis repeats: "[k2,p2]x3", "rep [k2,p2] 4 times"
  const phase1: string[] = [];
  for (const raw of steps) {
    const s = raw.trim();
    const brm = s.match(/^(?:rep(?:eat)?\s+)?[\[(](.+?)[\])]\s*[x×*]?\s*(\d+)\s*(?:times?)?$/i);
    if (brm) {
      const inner = splitTokens(brm[1]);
      const n = parseInt(brm[2]);
      for (let i = 0; i < n; i++) phase1.push(...inner);
      continue;
    }
    phase1.push(s);
  }

  // Phase 2 — handle * anchors and rep instructions across the step array
  const out: Stitch[] = [];
  let anchor = -1;

  for (const raw of phase1) {
    const s = raw.toLowerCase().replace(/\s+/g, "").trim();
    if (!s) continue;

    // "rep * N times" / "rep from * N times" / "×N"
    const repN = s.match(/rep(?:eat)?(?:from)?\*?(\d+)(?:more)?times?/i)
              || s.match(/repfrom\*(\d+)/i)
              || s.match(/\*\s*(\d+)\s*times?/i)
              || s.match(/[×x](\d+)/i);
    if (repN && anchor >= 0) {
      const n = parseInt(repN[1]);
      const seg = out.slice(anchor);
      for (let i = 1; i < n; i++) out.push(...seg);
      anchor = -1;
      continue;
    }

    // "rep from * to end" — tile the anchored segment to fill the row
    if (/rep.*\*.*end|repfrom\*toend|reptoend|rep.*toend/.test(s) && anchor >= 0) {
      const seg = out.slice(anchor);
      if (seg.length > 0) {
        const target = Math.max(out.length + seg.length, 40);
        while (out.length < target) out.push(...seg);
        if (out.length > target) out.length = target;
      }
      anchor = -1;
      continue;
    }

    // Standalone * = start of repeat region
    if (s === "*" || s === "**") { anchor = out.length; continue; }

    // Step starting with * — marks anchor then processes the stitch
    let stepStr = s;
    if (s.startsWith("*") && s.length > 1 && !s.includes("rep")) {
      anchor = out.length;
      stepStr = s.slice(1).trim();
    }

    out.push(...expandSingleStep(stepStr));
  }

  return out.length > 0 ? out : ["knit" as Stitch];
}

// ── Canvas renderer ───────────────────────────────────────────────────────────
export function renderSwatch(canvas: HTMLCanvasElement, grid: Stitch[][]): void {
  const rowCount = Math.min(grid.length, 80);
  if (!rowCount) return;
  const maxCols = Math.min(Math.max(...grid.slice(0, rowCount).map(r => r.length)), 80);
  if (!maxCols) return;

  const CW = Math.max(5, Math.floor(canvas.width / maxCols));
  const CH = Math.round(CW * 0.72);
  canvas.height = CH * rowCount;

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e4e4e4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lw = Math.max(0.8, CW * 0.09);

  for (let r = 0; r < rowCount; r++) {
    const row = grid[r];
    const cols = Math.min(row.length, maxCols);
    const xOff = Math.floor((canvas.width - cols * CW) / 2);

    for (let c = 0; c < cols; c++) {
      const stitch = row[c] ?? "knit";
      const pal = PALETTE[stitch] ?? PALETTE.knit;
      const x = xOff + c * CW;
      const y = r * CH;

      const j = (Math.sin(r * 6.7 + c * 3.3) * 0.5 + 0.5) * 8 - 4;
      const bg = Math.max(0, Math.min(255, Math.round(pal.bg + j)));
      ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
      ctx.fillRect(x, y, CW, CH);

      const mk = pal.mark;
      ctx.strokeStyle = `rgb(${mk},${mk},${mk})`;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (stitch) {
        case "knit":
          ctx.beginPath();
          ctx.moveTo(x + CW * 0.12, y + CH * 0.17);
          ctx.lineTo(x + CW * 0.50, y + CH * 0.83);
          ctx.lineTo(x + CW * 0.88, y + CH * 0.17);
          ctx.stroke();
          break;
        case "purl":
          ctx.beginPath();
          ctx.arc(x + CW * 0.50, y + CH * 0.42, CW * 0.30, Math.PI, 0, false);
          ctx.stroke();
          break;
        case "yo":
          ctx.beginPath();
          ctx.arc(x + CW * 0.50, y + CH * 0.50, CW * 0.24, 0, Math.PI * 2);
          ctx.globalAlpha = 0.55;
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        case "decrease":
          ctx.beginPath();
          ctx.moveTo(x + CW * 0.72, y + CH * 0.14);
          ctx.lineTo(x + CW * 0.20, y + CH * 0.86);
          ctx.stroke();
          break;
        case "cable-hi":
          ctx.beginPath();
          ctx.moveTo(x, y + CH * 0.62);
          ctx.bezierCurveTo(x + CW * 0.33, y + CH * 0.14, x + CW * 0.67, y + CH * 0.14, x + CW, y + CH * 0.62);
          ctx.stroke();
          break;
        case "cable-lo":
          ctx.beginPath();
          ctx.moveTo(x, y + CH * 0.38);
          ctx.bezierCurveTo(x + CW * 0.33, y + CH * 0.86, x + CW * 0.67, y + CH * 0.86, x + CW, y + CH * 0.38);
          ctx.stroke();
          break;
        case "slip":
          ctx.beginPath();
          ctx.moveTo(x + CW * 0.50, y + CH * 0.10);
          ctx.lineTo(x + CW * 0.50, y + CH * 0.90);
          ctx.stroke();
          break;
      }

      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(x, y + CH - 1, CW, 1);
    }
  }
}

// ── Rotation helpers ──────────────────────────────────────────────────────────
export function applyRotation(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  const sw = src.width, sh = src.height;
  const swap = deg === 90 || deg === 270;
  out.width  = swap ? sh : sw;
  out.height = swap ? sw : sh;
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -sw / 2, -sh / 2);
  return out;
}

export function buildRotatedCanvas(grid: Stitch[][], deg: number, width: number): HTMLCanvasElement {
  const tmp = document.createElement("canvas");
  tmp.width = width;
  renderSwatch(tmp, grid);
  return applyRotation(tmp, deg);
}
