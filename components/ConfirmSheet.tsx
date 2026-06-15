"use client";

import { useMemo, useState } from "react";
import type { ParseResult, ParsedEvent } from "@/lib/types";
import type { Person } from "@/lib/client";
import { REMINDER_PRESETS, defaultReminders } from "@/lib/reminders";

interface Draft {
  title: string;
  startLocal: string; // value for <input type="datetime-local">
  allDay: boolean;
  location: string;
  notes: string;
  personIds: string[];
  reminderOffsets: number[];
}

// Convert an ISO string to the local "YYYY-MM-DDTHH:mm" a datetime-local wants.
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function matchPersonIds(names: string[], people: Person[]): string[] {
  if (names.some((n) => /^(everyone|family|all|us|both)$/i.test(n))) {
    return people.map((p) => p.id);
  }
  const ids = names
    .map((n) => people.find((p) => p.name.toLowerCase().startsWith(n.toLowerCase()))?.id)
    .filter((x): x is string => Boolean(x));
  return ids.length ? ids : people.map((p) => p.id);
}

function toDraft(e: ParsedEvent, people: Person[]): Draft {
  const start = new Date(e.start);
  const offsets =
    e.reminders.length > 0
      ? e.reminders.map((r) => r.offsetMinutes)
      : defaultReminders(start, new Date()).map((r) => r.offsetMinutes);
  return {
    title: e.title,
    startLocal: isoToLocalInput(e.start),
    allDay: e.allDay,
    location: e.location || "",
    notes: e.notes || "",
    personIds: matchPersonIds(e.assigneeNames, people),
    reminderOffsets: offsets,
  };
}

export default function ConfirmSheet({
  result,
  people,
  busy,
  onConfirm,
  onCancel,
}: {
  result: ParseResult;
  people: Person[];
  busy: boolean;
  onConfirm: (events: unknown[]) => void;
  onCancel: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    result.events.map((e) => toDraft(e, people))
  );

  const presets = useMemo(() => REMINDER_PRESETS, []);

  function update(i: number, patch: Partial<Draft>) {
    setDrafts((d) => d.map((draft, idx) => (idx === i ? { ...draft, ...patch } : draft)));
  }

  function togglePerson(i: number, id: string) {
    const draft = drafts[i];
    const has = draft.personIds.includes(id);
    update(i, {
      personIds: has
        ? draft.personIds.filter((p) => p !== id)
        : [...draft.personIds, id],
    });
  }

  function toggleReminder(i: number, offset: number) {
    const draft = drafts[i];
    const has = draft.reminderOffsets.includes(offset);
    update(i, {
      reminderOffsets: has
        ? draft.reminderOffsets.filter((o) => o !== offset)
        : [...draft.reminderOffsets, offset].sort((a, b) => b - a),
    });
  }

  function confirm() {
    const events = drafts.map((d) => {
      const start = new Date(d.startLocal);
      return {
        title: d.title.trim() || "Untitled event",
        start: start.toISOString(),
        allDay: d.allDay,
        location: d.location.trim() || null,
        notes: d.notes.trim() || null,
        sourceText: result.engine === "claude" ? undefined : undefined,
        assigneeNames: people
          .filter((p) => d.personIds.includes(p.id))
          .map((p) => p.name),
        reminders: d.reminderOffsets.map((offsetMinutes) => ({
          label: presets.find((p) => p.offsetMinutes === offsetMinutes)?.label ||
            `${offsetMinutes}m before`,
          offsetMinutes,
        })),
      };
    });
    onConfirm(events);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 sm:items-center">
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Add to calendar?</h2>
            {result.summary && (
              <p className="mt-0.5 text-sm text-slate-500">{result.summary}</p>
            )}
          </div>
          {result.engine === "fallback" && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
              basic mode
            </span>
          )}
        </div>

        <div className="space-y-5">
          {drafts.map((draft, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 p-3">
              <input
                value={draft.title}
                onChange={(e) => update(i, { title: e.target.value })}
                className="w-full border-b border-transparent pb-1 text-base font-semibold outline-none focus:border-slate-200"
              />

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  type="datetime-local"
                  value={draft.startLocal}
                  onChange={(e) => update(i, { startLocal: e.target.value })}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={draft.allDay}
                    onChange={(e) => update(i, { allDay: e.target.checked })}
                  />
                  All day
                </label>
              </div>

              <input
                value={draft.location}
                onChange={(e) => update(i, { location: e.target.value })}
                placeholder="Location (optional)"
                className="mt-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />

              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  For
                </p>
                <div className="flex flex-wrap gap-2">
                  {people.map((p) => {
                    const on = draft.personIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePerson(i, p.id)}
                        className={`rounded-full border px-3 py-1 text-sm transition ${
                          on
                            ? "border-transparent text-white"
                            : "border-slate-300 text-slate-600"
                        }`}
                        style={on ? { backgroundColor: p.color } : undefined}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Heads-up
                </p>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => {
                    const on = draft.reminderOffsets.includes(preset.offsetMinutes);
                    return (
                      <button
                        key={preset.offsetMinutes}
                        type="button"
                        onClick={() => toggleReminder(i, preset.offsetMinutes)}
                        className={`rounded-full border px-3 py-1 text-sm transition ${
                          on
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-300 text-slate-600"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-brand-500 py-3 font-medium text-white active:bg-brand-600 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add to calendar"}
          </button>
        </div>
      </div>
    </div>
  );
}
