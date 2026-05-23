import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patterns = await prisma.pattern.findMany({
    where: { userId: auth.userId },
    include: { progress: true },
    orderBy: [
      { progress: { lastUsed: "desc" } },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json({ patterns });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, rows, imageData } = await req.json();
    if (!name || !rows) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const pattern = await prisma.pattern.create({
      data: {
        userId: auth.userId,
        name,
        rows,
        imageData: imageData || null,
        progress: {
          create: {
            currentRow: 0,
            currentStep: 0,
            lastUsed: new Date(),
            timePerStep: {},
          },
        },
      },
      include: { progress: true },
    });

    return NextResponse.json({ pattern }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
