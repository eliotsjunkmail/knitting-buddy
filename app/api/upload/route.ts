import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { parsePatternFromImage } from "@/lib/claude";

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

    const rows = await parsePatternFromImage(base64, mediaType);
    return NextResponse.json({ rows, imageData: `data:${mediaType};base64,${base64}` });
  } catch (err) {
    console.error("Upload error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    const friendly = msg.includes("API key") || msg.includes("auth")
      ? "API key not configured — contact the app owner"
      : msg.includes("Could not process image") || msg.includes("invalid")
      ? "Could not read the image — try a clearer photo"
      : "Failed to process image";
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
