import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const auth = await getAuthUser();
  if (!auth) return null;
  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { isAdmin: true } });
  return user?.isAdmin ? auth : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      isAdmin: true,
      createdAt: true,
      _count: { select: { patterns: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}
