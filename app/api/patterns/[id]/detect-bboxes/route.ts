import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type BboxRow = { label: string; steps: string[]; note?: string; bbox?: { x: number; y: number; w: number; h: number } | null };

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
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
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
            text: `This is a knitting pattern image. Find each row label listed below and return its bounding box as normalized coordinates (fractions 0–1 of image width/height).

Labels to locate:
${JSON.stringify(labels)}

Return ONLY valid JSON with no markdown:
{
  "rows": [
    { "label": "<exact label string>", "bbox": { "x": 0.0, "y": 0.0, "w": 1.0, "h": 0.03 } }
  ]
}

bbox: x/y = top-left corner, w/h = width/height, all as fractions of image size.
Set bbox to null if a label cannot be located.`,
          },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const bboxMap: Record<string, { x: number; y: number; w: number; h: number } | null> = {};
    if (parsed && Array.isArray(parsed.rows)) {
      for (const item of parsed.rows) {
        if (!item.label) continue;
        const b = item.bbox;
        if (b && typeof b.x === "number" && typeof b.y === "number" && typeof b.w === "number" && typeof b.h === "number"
            && b.x >= 0 && b.x <= 1 && b.y >= 0 && b.y <= 1 && b.w > 0 && b.w <= 1 && b.h > 0 && b.h <= 1) {
          bboxMap[item.label] = { x: b.x, y: b.y, w: b.w, h: b.h };
        } else {
          bboxMap[item.label] = null;
        }
      }
    }

    const updatedRows = rows.map(r => ({ ...r, bbox: bboxMap[r.label] ?? null }));
    await prisma.pattern.update({ where: { id }, data: { rows: updatedRows } });
    return NextResponse.json({ rows: updatedRows });
  } catch {
    return NextResponse.json({ error: "Detection failed" }, { status: 500 });
  }
}
