import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseRequest } from "@/lib/ai";

export const dynamic = "force-dynamic";

// Parse a natural-language request into proposed events WITHOUT saving them,
// so the user can confirm/tweak before it lands on the calendar.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text: string = (body?.text || "").toString().trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const tz = process.env.DEFAULT_TIMEZONE || "America/New_York";
  const people = await prisma.person.findMany();

  const result = await parseRequest(text, {
    now: new Date(),
    timezone: tz,
    peopleNames: people.map((p) => p.name),
  });

  return NextResponse.json(result);
}
