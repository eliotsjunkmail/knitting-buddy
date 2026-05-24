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
    // Ask Claude to:
    // 1. Count total distinct row-instruction lines visible in the image
    // 2. Give the ordinal position (1 = topmost) of each label we care about
    // 3. Give y-position of the very first and very last row instruction line
    //
    // We then compute each row's y from its ordinal, avoiding the mismatch
    // between extracted-row count and image-row count.
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
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
            text: `This image contains a knitting pattern. It may be a photo of a printed page or a screenshot.

COORDINATE SYSTEM:
y = 0.0 → very top pixel of the image
y = 1.0 → very bottom pixel of the image
(Include any background, phone UI, or margins — measure from the absolute image edges.)

Tasks:
1. Scan the image top-to-bottom and count every distinct row instruction line you can see (e.g. "Cast on", "Row 1 to 15", "Row 16 [WS]", "Row 17 [RS]", etc.).
2. For each label listed below, give its ORDINAL POSITION among all row instructions (1 = first/topmost line, 2 = second, etc.).
3. Give the y-center of the FIRST row instruction line (y=0 is image top).
4. Give the y-center of the LAST row instruction line visible.

Labels to find:
${JSON.stringify(labels)}

Return ONLY this JSON (no markdown):
{
  "firstRowY": 0.60,
  "lastRowY": 0.93,
  "totalLines": 28,
  "ordinals": [1, 2, 3, 4, 5, 6, 7, 8, 9]
}

ordinals: one integer per label in the same order as the input list. Use -1 if a label cannot be found.`,
          },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const firstRowY: number = parsed?.firstRowY;
    const lastRowY:  number = parsed?.lastRowY;
    const totalLines: number = parsed?.totalLines;
    const ordinals: number[] = parsed?.ordinals;

    // Validate
    if (
      typeof firstRowY !== "number" || typeof lastRowY !== "number" ||
      typeof totalLines !== "number" || !Array.isArray(ordinals) ||
      ordinals.length !== labels.length ||
      firstRowY < 0 || firstRowY > 1 || lastRowY < 0 || lastRowY > 1 ||
      lastRowY <= firstRowY + 0.05 || totalLines < 1
    ) {
      const nulledRows = rows.map(r => ({ ...r, bbox: null }));
      await prisma.pattern.update({ where: { id }, data: { rows: nulledRows } });
      return NextResponse.json({ rows: nulledRows, warning: "Could not identify row bounds" });
    }

    // Validate ordinals are roughly monotonically increasing
    let lastOrdinal = -1;
    let badCount = 0;
    for (const o of ordinals) {
      if (o < 0) continue;
      if (o < lastOrdinal) badCount++;
      else lastOrdinal = o;
    }
    if (badCount > ordinals.length * 0.2) {
      const nulledRows = rows.map(r => ({ ...r, bbox: null }));
      await prisma.pattern.update({ where: { id }, data: { rows: nulledRows } });
      return NextResponse.json({ rows: nulledRows, warning: "Row order inconsistent" });
    }

    const rowH = Math.min(0.05, (lastRowY - firstRowY) / Math.max(totalLines - 1, 1) * 0.85);

    // For rows with ordinal=-1, interpolate from surrounding valid ordinals
    const finalOrdinals: (number | null)[] = ordinals.map(o => o >= 1 ? o : null);
    for (let i = 0; i < finalOrdinals.length; i++) {
      if (finalOrdinals[i] !== null) continue;
      let lo = i - 1, hi = i + 1;
      while (lo >= 0 && finalOrdinals[lo] === null) lo--;
      while (hi < finalOrdinals.length && finalOrdinals[hi] === null) hi++;
      if (lo >= 0 && hi < finalOrdinals.length) {
        finalOrdinals[i] = finalOrdinals[lo]! + (finalOrdinals[hi]! - finalOrdinals[lo]!) * ((i - lo) / (hi - lo));
      } else if (lo >= 0) {
        finalOrdinals[i] = finalOrdinals[lo]! + (i - lo);
      } else if (hi < finalOrdinals.length) {
        finalOrdinals[i] = finalOrdinals[hi]! - (hi - i);
      }
    }

    const updatedRows = rows.map((r, i) => {
      const ord = finalOrdinals[i];
      if (ord === null) return { ...r, bbox: null };
      const yCenter = firstRowY + ((ord - 1) / Math.max(totalLines - 1, 1)) * (lastRowY - firstRowY);
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
