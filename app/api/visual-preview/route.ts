import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, rows } = await req.json();

    const summary = (rows as { label: string; steps: string[] }[])
      .slice(0, 60)
      .map((r) => `${r.label}: ${r.steps.join(" ")}`)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: `You are a knitting expert creating a pixel-art preview of a finished knitted item.

Pattern name: "${name}"
Pattern rows:
${summary}

Analyze the pattern and produce a pixel grid showing what the FINISHED KNITTED ITEM looks like — the actual fabric, not a chart.

Return ONLY valid JSON, no markdown:
{
  "itemType": "blanket|scarf|sweater|hat|socks|shawl|etc",
  "description": "Vivid one-sentence description of the finished item (colours, motifs, texture)",
  "grid": [["#rrggbb", ...], ...]
}

Grid rules (IMPORTANT):
- Exactly 40 columns × 50 rows
- Each hex represents one stitch area's colour as it would appear in real knitted fabric
- Knit stitches: use the yarn colour, purl stitches: 10-15% darker shade of the same yarn
- If the pattern has colourwork (two yarns, fair-isle): show the actual motif — elephants, stripes, geometric shapes, etc.
- If cables: show the rope-twist look by alternating light/shadow colours in a diagonal
- If lace (yo/k2tog): show open holes as a very light/white colour against the yarn colour
- Make it look like real knitting: slight stitch-by-stitch colour variation (±3% brightness) for texture
- Use realistic yarn colours — natural cream, grey, navy, etc. unless the pattern implies specific colours
- The grid reads top-to-bottom (first row = top of item), left-to-right`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const data = JSON.parse(cleaned);

    return NextResponse.json(data);
  } catch (err) {
    console.error("Visual preview error:", err);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
