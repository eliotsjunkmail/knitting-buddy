// Shared knitting-swatch rendering logic
// Used by PatternVisualPreview (full preview modal) and PatternCard (thumbnail)

export type Stitch = "knit" | "purl" | "yo" | "decrease" | "cable-hi" | "cable-lo" | "slip";

// Blue-and-white palette  bg/mark = [R, G, B]
export const PALETTE: Record<Stitch, { bg: [number,number,number]; mark: [number,number,number] }> = {
  "knit":      { bg: [100, 149, 220], mark: [ 45,  90, 175] }, // medium blue, V-shape
  "purl":      { bg: [180, 205, 235], mark: [110, 145, 200] }, // light blue-gray, ridge arc
  "yo":        { bg: [240, 246, 255], mark: [175, 200, 235] }, // near-white, open ring
  "decrease":  { bg: [ 50,  90, 170], mark: [ 25,  55, 135] }, // deep blue, diagonal
  "cable-hi":  { bg: [215, 230, 250], mark: [130, 165, 220] }, // pale blue (highlight)
  "cable-lo":  { bg: [ 40,  75, 155], mark: [ 20,  45, 120] }, // deep blue (shadow)
  "slip":      { bg: [145, 175, 220], mark: [ 90, 125, 185] }, // mid-blue, bar
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

    if (s === "*" || s === "**") { anchor = out.length; continue; }

    let stepStr = s;
    if (s.startsWith("*") && s.length > 1 && !s.includes("rep")) {
      anchor = out.length;
      stepStr = s.slice(1).trim();
    }

    out.push(...expandSingleStep(stepStr));
  }

  return out.length > 0 ? out : ["knit" as Stitch];
}

// ── Cell drawing (shared by static and animated renderers) ────────────────────
function clamp(v: number) { return Math.max(0, Math.min(255, Math.round(v))); }

// alpha defaults to 1 (full opacity). Pass < 1 for the washed-out light pass.
function drawCell(
  ctx: CanvasRenderingContext2D,
  stitch: Stitch,
  x: number, y: number,
  CW: number, CH: number,
  lw: number,
  r: number, c: number,
  alpha = 1,
) {
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;

  const pal = PALETTE[stitch] ?? PALETTE.knit;

  // Per-stitch brightness jitter ±4
  const j = (Math.sin(r * 6.7 + c * 3.3) * 0.5 + 0.5) * 8 - 4;
  const [br, bg, bb] = pal.bg;
  ctx.fillStyle = `rgb(${clamp(br+j)},${clamp(bg+j)},${clamp(bb+j)})`;
  ctx.fillRect(x, y, CW, CH);

  const [mr, mg, mb] = pal.mark;
  ctx.strokeStyle = `rgb(${mr},${mg},${mb})`;
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
      ctx.globalAlpha = alpha * 0.55;
      ctx.stroke();
      ctx.globalAlpha = alpha; // restore to cell alpha (not global 1)
      break;
    case "decrease":
      ctx.beginPath();
      ctx.moveTo(x + CW * 0.72, y + CH * 0.14);
      ctx.lineTo(x + CW * 0.20, y + CH * 0.86);
      ctx.stroke();
      break;
    case "cable-hi":
      ctx.beginPath();
      ctx.moveTo(x,      y + CH * 0.62);
      ctx.bezierCurveTo(x + CW * 0.33, y + CH * 0.14, x + CW * 0.67, y + CH * 0.14, x + CW, y + CH * 0.62);
      ctx.stroke();
      break;
    case "cable-lo":
      ctx.beginPath();
      ctx.moveTo(x,      y + CH * 0.38);
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

  // Hairline row divider
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  ctx.fillRect(x, y + CH - 1, CW, 1);

  ctx.globalAlpha = prevAlpha;
}

// ── Layout helper (shared setup) ─────────────────────────────────────────────
interface SwatchLayout {
  ctx: CanvasRenderingContext2D;
  rowCount: number;
  maxCols: number;
  CW: number;
  CH: number;
  lw: number;
  cells: Array<{ stitch: Stitch; x: number; y: number; r: number; c: number }>;
}

function buildLayout(canvas: HTMLCanvasElement, grid: Stitch[][]): SwatchLayout | null {
  const rowCount = Math.min(grid.length, 80);
  if (!rowCount) return null;
  const maxCols = Math.min(Math.max(...grid.slice(0, rowCount).map(r => r.length)), 80);
  if (!maxCols) return null;

  const CW = Math.max(5, Math.floor(canvas.width / maxCols));
  const CH = Math.round(CW * 0.72);
  canvas.height = CH * rowCount;

  const ctx = canvas.getContext("2d")!;
  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lw = Math.max(0.8, CW * 0.09);

  // Pre-build flat ordered cell list (rows flipped: last pattern row at top)
  const cells: SwatchLayout["cells"] = [];
  for (let r = 0; r < rowCount; r++) {
    const row = grid[rowCount - 1 - r];
    const cols = Math.min(row.length, maxCols);
    const xOff = Math.floor((canvas.width - cols * CW) / 2);
    for (let c = 0; c < cols; c++) {
      cells.push({ stitch: row[c] ?? "knit", x: xOff + c * CW, y: r * CH, r, c });
    }
  }

  return { ctx, rowCount, maxCols, CW, CH, lw, cells };
}

// ── Static renderer (used for rotation / save snapshots) ─────────────────────
export function renderSwatch(canvas: HTMLCanvasElement, grid: Stitch[][]): void {
  const layout = buildLayout(canvas, grid);
  if (!layout) return;
  const { ctx, CW, CH, lw, cells } = layout;
  for (const { stitch, x, y, r, c } of cells) {
    drawCell(ctx, stitch, x, y, CW, CH, lw, r, c);
  }
}

// ── Animated renderer — two-phase typewriter animation ───────────────────────
//
// Phase 1: entire grid drawn washed-out (α≈0.3), left→right top→bottom
// Phase 2: rows the user has already worked (bottom of canvas) redrawn at full
//          opacity on top of the light layer, left→right top→bottom
//
// currentRow: 0-based pattern row index (from progress). Rows 0..currentRow are
//             considered "done" and get the dark overlay in phase 2.
//
// Returns a cancel function; call it on component unmount.
export function animateSwatch(
  canvas: HTMLCanvasElement,
  grid: Stitch[][],
  opts?: { currentRow?: number; onDone?: () => void },
): () => void {
  const layout = buildLayout(canvas, grid);
  if (!layout) return () => {};
  const { ctx, CW, CH, lw, cells, rowCount } = layout;

  const total = cells.length;
  if (total === 0) return () => {};

  // Which visual row corresponds to the user's current pattern row?
  // Pattern row 0 = visual row rowCount-1 (bottom); pattern row rowCount-1 = visual row 0 (top).
  const currentRow = Math.min(opts?.currentRow ?? 0, rowCount - 1);
  const visualProgressRow = rowCount - 1 - currentRow;

  // First cell in the flat array that belongs to the completed section
  // (visual rows >= visualProgressRow, i.e. current row and all rows below it)
  let progressStart = cells.findIndex(cell => cell.r >= visualProgressRow);
  if (progressStart < 0) progressStart = total;

  const completedCells = total - progressStart;
  const completedFrac  = completedCells / Math.max(1, total);

  // Timing: phase 1 covers whole grid; phase 2 is proportional to completion
  const p1Duration = Math.min(2000, Math.max(400, rowCount * 30));
  const p2Duration = completedCells > 0
    ? Math.max(300, completedFrac * Math.min(1500, Math.max(300, rowCount * 25)))
    : 0;

  let drawn     = 0;
  let cancelled = false;

  function runPhase1(t0: number, now: number) {
    if (cancelled) return;
    const p      = Math.min((now - t0) / p1Duration, 1);
    const target = Math.floor(p * total);
    while (drawn < target) {
      const { stitch, x, y, r, c } = cells[drawn];
      drawCell(ctx, stitch, x, y, CW, CH, lw, r, c, 0.28); // washed-out light pass
      drawn++;
    }
    if (p < 1) {
      requestAnimationFrame(t => runPhase1(t0, t));
    } else if (completedCells > 0) {
      drawn = progressStart;
      requestAnimationFrame(t => runPhase2(t, t));
    } else {
      opts?.onDone?.();
    }
  }

  function runPhase2(t0: number, now: number) {
    if (cancelled) return;
    const p      = Math.min((now - t0) / p2Duration, 1);
    const target = progressStart + Math.floor(p * completedCells);
    while (drawn < target) {
      const { stitch, x, y, r, c } = cells[drawn];
      drawCell(ctx, stitch, x, y, CW, CH, lw, r, c, 1); // full-color overlay
      drawn++;
    }
    if (p < 1) {
      requestAnimationFrame(t => runPhase2(t0, t));
    } else {
      opts?.onDone?.();
    }
  }

  requestAnimationFrame(t => runPhase1(t, t));
  return () => { cancelled = true; };
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
