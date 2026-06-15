import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { eventInclude, serializeEvent } from "@/lib/events";
import { fireAtFor } from "@/lib/reminders";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const start = body.start ? new Date(body.start) : existing.start;

  await prisma.event.update({
    where: { id },
    data: {
      title: body.title ?? undefined,
      start: body.start ? start : undefined,
      end: body.end !== undefined ? (body.end ? new Date(body.end) : null) : undefined,
      allDay: body.allDay ?? undefined,
      location: body.location !== undefined ? body.location : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
    },
  });

  // If the start moved, recompute pending reminders' fire times.
  if (body.start) {
    const pending = await prisma.reminder.findMany({
      where: { eventId: id, sentAt: null },
    });
    for (const r of pending) {
      await prisma.reminder.update({
        where: { id: r.id },
        data: { fireAt: fireAtFor(start, r.offsetMinutes) },
      });
    }
  }

  const updated = await prisma.event.findUnique({
    where: { id },
    include: eventInclude,
  });
  return NextResponse.json({ event: updated ? serializeEvent(updated) : null });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await prisma.event.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
