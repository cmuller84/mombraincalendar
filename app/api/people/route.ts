import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const people = await prisma.person.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ people });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, color, isAdult, phone } = body || {};
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const person = await prisma.person.create({
    data: {
      name: name.trim(),
      color: color || "#7c4dff",
      isAdult: isAdult ?? true,
      phone: phone || null,
    },
  });
  return NextResponse.json({ person }, { status: 201 });
}
