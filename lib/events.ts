import { prisma } from "./db";
import type { ParsedEvent } from "./types";
import { defaultReminders, fireAtFor } from "./reminders";

export interface CreateEventInput {
  title: string;
  start: string; // ISO
  end?: string | null;
  allDay?: boolean;
  location?: string | null;
  notes?: string | null;
  sourceText?: string | null;
  assigneeNames?: string[];
  reminders?: { label: string; offsetMinutes: number }[];
}

/** Resolve human names ("Mom", "everyone") to Person ids. */
export async function resolveAssigneeIds(names: string[]): Promise<string[]> {
  const people = await prisma.person.findMany();
  const wantsEveryone =
    names.length === 0 ||
    names.some((n) => /^(everyone|family|all|us|both)$/i.test(n.trim()));
  if (wantsEveryone) return people.map((p) => p.id);

  const ids = new Set<string>();
  for (const name of names) {
    const needle = name.trim().toLowerCase();
    const match = people.find(
      (p) =>
        p.name.toLowerCase() === needle ||
        p.name.toLowerCase().startsWith(needle) ||
        needle.startsWith(p.name.toLowerCase())
    );
    if (match) ids.add(match.id);
  }
  // If nothing matched, fall back to everyone so the event isn't orphaned.
  if (ids.size === 0) return people.map((p) => p.id);
  return [...ids];
}

export async function createEvent(input: CreateEventInput) {
  const start = new Date(input.start);
  const now = new Date();

  const assigneeIds = await resolveAssigneeIds(input.assigneeNames || []);

  // Use the requested reminders, or sensible defaults; only keep ones still
  // in the future so we never "send" a reminder the moment an event is added.
  const requested =
    input.reminders && input.reminders.length
      ? input.reminders
      : defaultReminders(start, now);
  const reminders = requested
    .map((r) => ({ ...r, fireAt: fireAtFor(start, r.offsetMinutes) }))
    .filter((r) => r.fireAt.getTime() > now.getTime());

  return prisma.event.create({
    data: {
      title: input.title,
      start,
      end: input.end ? new Date(input.end) : null,
      allDay: input.allDay ?? false,
      location: input.location ?? null,
      notes: input.notes ?? null,
      sourceText: input.sourceText ?? null,
      assignees: {
        create: assigneeIds.map((personId) => ({ personId })),
      },
      reminders: {
        create: reminders.map((r) => ({
          offsetMinutes: r.offsetMinutes,
          fireAt: r.fireAt,
        })),
      },
    },
    include: eventInclude,
  });
}

export const eventInclude = {
  assignees: { include: { person: true } },
  reminders: { orderBy: { fireAt: "asc" as const } },
};

type EventWithRelations = Awaited<ReturnType<typeof createEvent>>;

/** Shape an event for the client. */
export function serializeEvent(e: EventWithRelations) {
  return {
    id: e.id,
    title: e.title,
    start: e.start.toISOString(),
    end: e.end ? e.end.toISOString() : null,
    allDay: e.allDay,
    location: e.location,
    notes: e.notes,
    sourceText: e.sourceText,
    assignees: e.assignees.map((a) => ({
      id: a.person.id,
      name: a.person.name,
      color: a.person.color,
    })),
    reminders: e.reminders.map((r) => ({
      id: r.id,
      offsetMinutes: r.offsetMinutes,
      fireAt: r.fireAt.toISOString(),
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    })),
  };
}

export type SerializedEvent = ReturnType<typeof serializeEvent>;
