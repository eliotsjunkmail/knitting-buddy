import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface PatternRow {
  label: string;
  steps: string[];
  note?: string;
}

export async function parsePatternFromImage(base64Image: string, mediaType: string): Promise<PatternRow[]> {
  const response = await client.messages.create({
    model: "claude-opus-4-7",
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
            text: `Analyze this knitting pattern image and extract ALL rows/rounds with their individual steps.

Return ONLY a valid JSON array with no markdown, no code blocks, no explanation — just the raw JSON.

Format:
[
  {
    "label": "Row 1",
    "steps": ["k2", "p2", "k2", "p2"],
    "note": "optional note about this row"
  }
]

Rules:
- Each "step" should be the smallest meaningful instruction unit (e.g. "k2", "p3", "k2tog", "yo", "sl1", "repeat * to end")
- Split comma-separated instructions into individual steps
- Keep special instructions like "repeat from * to last 3 sts" as single steps
- Use the exact abbreviations shown in the pattern
- Include row notes/instructions as the "note" field
- If there are no visible rows, return [{"label": "Row 1", "steps": ["Pattern text not recognized — please enter manually"], "note": ""}]`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // Strip any accidental markdown code fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as PatternRow[];
  } catch {
    // If parsing fails, return a single row with the raw text split by commas/newlines
  }

  return [{ label: "Row 1", steps: [text.slice(0, 200)], note: "Auto-parse failed — edit manually" }];
}
