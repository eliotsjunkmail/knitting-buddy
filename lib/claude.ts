import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface PatternRow {
  label: string;
  steps: string[];
  note?: string;
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
      "note": "optional note about this row"
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
- If there are no visible rows, use rows: [{"label": "Row 1", "steps": ["Pattern text not recognized — please enter manually"], "note": ""}]`,
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
      return { name: parsed.name || "", rows: parsed.rows as PatternRow[] };
    }
    if (Array.isArray(parsed)) {
      return { name: "", rows: parsed as PatternRow[] };
    }
  } catch {
    // fall through to default
  }

  return { name: "", rows: [{ label: "Row 1", steps: [text.slice(0, 200)], note: "Auto-parse failed — edit manually" }] };
}
