import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type BboxRow = {
  label: string;
  steps: string[];
  note?: string;
  bbox?: { x: number; y: number; w: number; h: number } | null;
};

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pattern = await prisma.pattern.findFirst({ where: { id, userId: auth.userId } });
  if (!pattern) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!pattern.imageData) return NextResponse.json({ error: "No image" }, { status: 400 });

  const match = (pattern.imageData as string).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
  const [, mediaType, base64] = match;

  const rows = pattern.rows as BboxRow[];
  const labels = rows.map(r => r.label);

  try {
    // Ask for just y-center values — simpler task, more accurate than full bboxes.
    // Critically: be explicit that y=0 is the absolute top pixel of the image,
    // including any phone status bar or app UI that may appear above the pattern.
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64,
            },
          },
          {
            type: "text",
            text: `This image contains a knitting pattern. Some of the image may be taken up by a phone status bar, email app header, or other UI at the top — that is still part of the image.

COORDINATE SYSTEM:
- y = 0.0 means the very top pixel of the entire image (including any UI/header above the document)
- y = 1.0 means the very bottom pixel of the entire image
- Measure from the absolute image edges, not from the document margin

For each row label below, find that text line in the image and return its y_center: the vertical centre of that text line as a decimal fraction of the full image height (0.0 = image top, 1.0 = image bottom).

Row labels (these appear top-to-bottom in the pattern document):
${JSON.stringify(labels)}

Return ONLY this JSON, no markdown, no explanation:
{"y": [0.61, 0.64, 0.67, ...]}

Return exactly ${labels.length} values in the same order as the labels above.
Use -1 for any label you cannot locate.`,
          },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed || !Array.isArray(parsed.y) || parsed.y.length !== labels.length) {
      throw new Error("Unexpected response shape");
    }

    const rawY: number[] = parsed.y;

    // Validate: check monotonicity (rows must be top-to-bottom in the document)
    const validY = rawY.filter(v => v >= 0 && v <= 1);
    let monotonic = true;
    let prev = -1;
    for (const v of rawY) {
      if (v < 0) continue; // skip not-found rows
      if (v < prev - 0.02) { monotonic = false; break; } // allow 2% slack
      prev = v;
    }

    const validFraction = validY.length / labels.length;

    // If fewer than half the rows were located OR the order is wrong, detection failed
    if (!monotonic || validFraction < 0.5) {
      const nulledRows = rows.map(r => ({ ...r, bbox: null }));
      await prisma.pattern.update({ where: { id }, data: { rows: nulledRows } });
      return NextResponse.json({ rows: nulledRows, warning: "Detection accuracy too low" });
    }

    // Estimate a typical row height from the median gap between adjacent valid rows
    const validValues = rawY.filter(v => v >= 0);
    let rowH = 0.025; // default ~2.5% of image height
    if (validValues.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < validValues.length; i++) {
        gaps.push(validValues[i] - validValues[i - 1]);
      }
      gaps.sort((a, b) => a - b);
      const medianGap = gaps[Math.floor(gaps.length / 2)];
      if (medianGap > 0.005 && medianGap < 0.15) rowH = Math.min(medianGap * 0.9, 0.05);
    }

    // Build final rows: use detected y, fill not-found via linear interpolation
    // First pass: assign detected values
    const yArr: (number | null)[] = rawY.map(v => (v >= 0 && v <= 1 ? v : null));

    // Second pass: interpolate nulls
    for (let i = 0; i < yArr.length; i++) {
      if (yArr[i] !== null) continue;
      // find nearest valid values on each side
      let lo = i - 1;
      let hi = i + 1;
      while (lo >= 0 && yArr[lo] === null) lo--;
      while (hi < yArr.length && yArr[hi] === null) hi++;
      if (lo >= 0 && hi < yArr.length) {
        yArr[i] = yArr[lo]! + (yArr[hi]! - yArr[lo]!) * ((i - lo) / (hi - lo));
      } else if (lo >= 0) {
        yArr[i] = yArr[lo]! + (i - lo) * rowH;
      } else if (hi < yArr.length) {
        yArr[i] = yArr[hi]! - (hi - i) * rowH;
      }
    }

    const updatedRows = rows.map((r, i) => {
      const yCenter = yArr[i];
      if (yCenter === null) return { ...r, bbox: null };
      return {
        ...r,
        bbox: {
          x: 0.02,
          y: Math.max(0, yCenter - rowH / 2),
          w: 0.96,
          h: rowH,
        },
      };
    });

    await prisma.pattern.update({ where: { id }, data: { rows: updatedRows } });
    return NextResponse.json({ rows: updatedRows });
  } catch {
    return NextResponse.json({ error: "Detection failed" }, { status: 500 });
  }
}
