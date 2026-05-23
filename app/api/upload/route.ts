import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { parsePatternFromImage } from "@/lib/claude";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;
    if (!file) return NextResponse.json({ error: "No image provided" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mediaType = file.type || "image/jpeg";

    const { name, rows } = await parsePatternFromImage(base64, mediaType);
    return NextResponse.json({ name, rows, imageData: `data:${mediaType};base64,${base64}` });
  } catch (err) {
    console.error("Upload error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    const friendly = msg.includes("API key") || msg.includes("auth") || msg.includes("401")
      ? "Anthropic API key is invalid or has no credits — update ANTHROPIC_API_KEY in Railway"
      : msg.includes("Could not process image") || msg.includes("invalid_request")
      ? "Could not read the image — try a clearer photo"
      : msg.includes("overloaded") || msg.includes("529")
      ? "AI is overloaded — please try again in a moment"
      : "Failed to process image — please try again";
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
