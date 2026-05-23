import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pattern = await prisma.pattern.findFirst({
    where: { id, userId: auth.userId },
    include: { progress: true },
  });
  if (!pattern) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ pattern });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const pattern = await prisma.pattern.findFirst({ where: { id, userId: auth.userId } });
  if (!pattern) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.pattern.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
