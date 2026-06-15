"use client";

import type { CalendarEvent } from "@/lib/client";
import {
  formatDayHeading,
  formatTime,
  relativeLead,
  startOfDay,
} from "@/lib/dates";

function groupByDay(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const groups = new Map<string, { date: Date; items: CalendarEvent[] }>();
  for (const ev of events) {
    const d = startOfDay(new Date(ev.start));
    const key = d.toISOString();
    if (!groups.has(key)) groups.set(key, { date: d, items: [] });
    groups.get(key)!.items.push(ev);
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
    .map(([, v]) => [v.date.toISOString(), v.items] as [string, CalendarEvent[]]);
}

export default function AgendaList({
  events,
  onDelete,
}: {
  events: CalendarEvent[];
  onDelete: (id: string) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-5xl">🗓️</p>
        <p className="mt-3 font-medium text-slate-600">Nothing scheduled</p>
        <p className="mt-1 text-sm text-slate-400">
          Tap the mic or type below — e.g. &ldquo;Soccer practice Saturday 9am&rdquo;.
        </p>
      </div>
    );
  }

  const groups = groupByDay(events);

  return (
    <div className="space-y-6 px-4 pb-4">
      {groups.map(([key, items]) => (
        <div key={key}>
          <h3 className="sticky top-0 z-10 bg-slate-50/95 py-1 text-sm font-semibold text-slate-500 backdrop-blur">
            {formatDayHeading(new Date(key))}
          </h3>
          <div className="mt-1 space-y-2">
            {items.map((ev) => (
              <EventRow key={ev.id} event={ev} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventRow({
  event,
  onDelete,
}: {
  event: CalendarEvent;
  onDelete: (id: string) => void;
}) {
  const start = new Date(event.start);
  const accent = event.assignees[0]?.color || "#7c4dff";
  const pendingReminders = event.reminders.filter((r) => !r.sentAt);

  return (
    <div className="group relative flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <div
        className="w-1 shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-medium text-slate-900">{event.title}</p>
          <span className="shrink-0 text-sm text-slate-500">
            {event.allDay ? "All day" : formatTime(start)}
          </span>
        </div>

        {event.location && (
          <p className="mt-0.5 truncate text-sm text-slate-500">📍 {event.location}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {event.assignees.map((a) => (
            <span
              key={a.id}
              className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: a.color }}
            >
              {a.name}
            </span>
          ))}
          {pendingReminders.slice(0, 1).map((r) => (
            <span
              key={r.id}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500"
            >
              🔔 {relativeLead(r.offsetMinutes)}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={() => onDelete(event.id)}
        aria-label="Delete event"
        className="shrink-0 self-start rounded-full p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}
