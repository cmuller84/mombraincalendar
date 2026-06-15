import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createEvent, eventInclude, serializeEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

// List events, optionally within a [from, to] window (ISO strings).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where =
    from || to
      ? {
          start: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {};

  const events = await prisma.event.findMany({
    where,
    include: eventInclude,
    orderBy: { start: "asc" },
  });

  return NextResponse.json({ events: events.map(serializeEvent) });
}

// Create one or more events (the confirm step uses this).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body?.events) ? body.events : [body];

  const created = [];
  for (const item of items) {
    if (!item?.title || !item?.start) {
      return NextResponse.json(
        { error: "each event needs a title and start" },
        { status: 400 }
      );
    }
    const event = await createEvent({
      title: item.title,
      start: item.start,
      end: item.end ?? null,
      allDay: item.allDay ?? false,
      location: item.location ?? null,
      notes: item.notes ?? null,
      sourceText: item.sourceText ?? null,
      assigneeNames: item.assigneeNames ?? [],
      reminders: item.reminders ?? [],
    });
    created.push(serializeEvent(event));
  }

  return NextResponse.json({ events: created }, { status: 201 });
}
