import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth) return null;
  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { isAdmin: true } });
  return user?.isAdmin ? auth : null;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { isAdmin: true } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.isAdmin) return NextResponse.json({ error: "Cannot delete admin accounts" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
