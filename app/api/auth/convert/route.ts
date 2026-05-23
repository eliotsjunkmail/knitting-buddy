import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, password } = await req.json();
  if (!username || !password) return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  if (username.length < 3) return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && existing.id !== auth.userId) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: { username, password: hashed },
  });

  return NextResponse.json({ user: { id: user.id, username: user.username, isGuest: false } });
}
