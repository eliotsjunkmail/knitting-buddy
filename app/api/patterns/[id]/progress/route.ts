import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pattern = await prisma.pattern.findFirst({ where: { id, userId: auth.userId } });
  if (!pattern) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { currentRow, currentStep, timePerStep } = body;

  const progress = await prisma.progress.upsert({
    where: { patternId: id },
    update: {
      currentRow: currentRow ?? 0,
      currentStep: currentStep ?? 0,
      lastUsed: new Date(),
      ...(timePerStep !== undefined && { timePerStep }),
    },
    create: {
      patternId: id,
      currentRow: currentRow ?? 0,
      currentStep: currentStep ?? 0,
      lastUsed: new Date(),
      timePerStep: timePerStep ?? {},
    },
  });

  return NextResponse.json({ progress });
}
