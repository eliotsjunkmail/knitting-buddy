import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface PatternRow {
  label: string;
  steps: string[];
  note?: string;
  bbox?: { x: number; y: number; w: number; h: number } | null;
}

export interface ParsedPattern {
  name: string;
  rows: PatternRow[];
}

export async function parsePatternFromImage(base64Image: string, mediaType: string): Promise<ParsedPattern> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64Image,
            },
          },
          {
            type: "text",
            text: `Analyze this knitting pattern image and extract the pattern name and ALL rows/rounds with their individual steps.

Return ONLY a valid JSON object with no markdown, no code blocks, no explanation — just the raw JSON.

Format:
{
  "name": "Pattern name (from the image title, or a short descriptive name if no title is visible)",
  "rows": [
    {
      "label": "Row 1",
      "steps": ["k2", "p2", "k2", "p2"],
      "note": "optional note about this row",
      "bbox": { "x": 0.05, "y": 0.12, "w": 0.90, "h": 0.04 }
    }
  ]
}

Rules:
- "name": use the title shown in the image; if none, infer a short name from the content (e.g. "Cable Scarf", "Lace Shawl")
- Each "step" should be the smallest meaningful instruction unit (e.g. "k2", "p3", "k2tog", "yo", "sl1", "repeat * to end")
- Split comma-separated instructions into individual steps
- Keep special instructions like "repeat from * to last 3 sts" as single steps
- Use the exact abbreviations shown in the pattern
- Include row notes/instructions as the "note" field
- "bbox": the approximate bounding box of that row's text line as normalized coordinates { "x": 0–1, "y": 0–1, "w": 0–1, "h": 0–1 } where x/y are the top-left corner measured from the image top-left and w/h are the width/height, all as fractions of image dimensions. Set to null if the row position cannot be determined.
- If there are no visible rows, use rows: [{"label": "Row 1", "steps": ["Pattern text not recognized — please enter manually"], "note": "", "bbox": null}]`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.rows)) {
      const rows = parsed.rows as PatternRow[];
      for (const row of rows) {
        const b = row.bbox;
        if (b && (typeof b.x !== "number" || typeof b.y !== "number" || typeof b.w !== "number" || typeof b.h !== "number"
            || b.x < 0 || b.x > 1 || b.y < 0 || b.y > 1 || b.w <= 0 || b.w > 1 || b.h <= 0 || b.h > 1)) {
          row.bbox = null;
        }
      }
      return { name: parsed.name || "", rows };
    }
    if (Array.isArray(parsed)) {
      return { name: "", rows: parsed as PatternRow[] };
    }
  } catch {
    // fall through to default
  }

  return { name: "", rows: [{ label: "Row 1", steps: [text.slice(0, 200)], note: "Auto-parse failed — edit manually" }] };
}
