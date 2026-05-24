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

  try {
    // Ask for just two anchor points — first row Y and last row Y.
    // Asking for 28 individual positions produces compounding errors;
    // two anchors + linear interpolation is far more reliable.
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
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
            text: `This image contains a knitting pattern. It may include a phone status bar, email app header, or other UI above the actual pattern document — those are all part of the image.

COORDINATE SYSTEM:
y = 0.0 → absolute TOP pixel of the image (regardless of what is there)
y = 1.0 → absolute BOTTOM pixel of the image

Find the knitting row instructions in this image (lines like "Cast on", "Row 1", "Row 1 to 15:", "Row 16 [WS]:", etc.).

Return ONLY this JSON (no markdown, no explanation):
{ "firstRowY": 0.61, "lastRowY": 0.94 }

firstRowY = y-center of the FIRST row instruction line in the image
lastRowY  = y-center of the LAST  row instruction line in the image

Both values must be between 0.0 and 1.0, and lastRowY must be greater than firstRowY.`,
          },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const firstRowY: number = parsed?.firstRowY;
    const lastRowY:  number = parsed?.lastRowY;

    // Validate the two anchors
    if (
      typeof firstRowY !== "number" || typeof lastRowY !== "number" ||
      firstRowY < 0 || firstRowY > 1 || lastRowY < 0 || lastRowY > 1 ||
      lastRowY <= firstRowY + 0.05
    ) {
      const nulledRows = rows.map(r => ({ ...r, bbox: null }));
      await prisma.pattern.update({ where: { id }, data: { rows: nulledRows } });
      return NextResponse.json({ rows: nulledRows, warning: "Could not identify row bounds" });
    }

    // Linearly interpolate each row's Y between the two anchors
    const n = rows.length;
    const rowH = Math.min(0.05, (lastRowY - firstRowY) / Math.max(n - 1, 1) * 0.85);
    const updatedRows = rows.map((r, i) => {
      const yCenter = n === 1
        ? firstRowY
        : firstRowY + (i / (n - 1)) * (lastRowY - firstRowY);
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
