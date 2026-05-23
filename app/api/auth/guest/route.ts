import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST() {
  try {
    const suffix = Math.random().toString(36).slice(2, 8);
    const username = `guest_${suffix}`;
    const password = await bcrypt.hash(Math.random().toString(36), 10);

    const user = await prisma.user.create({
      data: { username, password, isGuest: true },
    });

    const token = await signToken(user.id);
    const response = NextResponse.json({ user: { id: user.id, username: user.username, isGuest: true } });
    response.cookies.set("kb_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
