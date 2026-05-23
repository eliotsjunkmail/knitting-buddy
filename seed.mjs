import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!existing) {
    const hashed = await bcrypt.hash("admin", 10);
    await prisma.user.create({ data: { username: "admin", password: hashed, isAdmin: true } });
    console.log("✓ Admin user created");
  } else if (!existing.isAdmin) {
    await prisma.user.update({ where: { username: "admin" }, data: { isAdmin: true } });
    console.log("✓ Admin user granted isAdmin");
  } else {
    console.log("✓ Admin user already exists");
  }
} catch (e) {
  console.error("Seed error:", e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
