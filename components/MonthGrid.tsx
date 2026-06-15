"use client";

import type { CalendarEvent } from "@/lib/client";
import { dayKey, isSameDay, monthMatrix } from "@/lib/dates";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default function MonthGrid({
  anchor,
  events,
  selectedDay,
  onSelectDay,
  onShiftMonth,
}: {
  anchor: Date;
  events: CalendarEvent[];
  selectedDay: Date | null;
  onSelectDay: (d: Date) => void;
  onShiftMonth: (delta: number) => void;
}) {
  const cells = monthMatrix(anchor);
  const today = new Date();

  // Map day -> up to 3 dot colors from that day's events.
  const dotsByDay = new Map<string, string[]>();
  for (const ev of events) {
    const d = new Date(ev.start);
    const key = dayKey(d);
    const colors = dotsByDay.get(key) || [];
    const evColors = ev.assignees.map((a) => a.color);
    for (const c of evColors) {
      if (colors.length < 3 && !colors.includes(c)) colors.push(c);
    }
    dotsByDay.set(key, colors);
  }

  const monthLabel = anchor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-base font-semibold">{monthLabel}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => onShiftMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            onClick={() => onShiftMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = isSameDay(d, today);
          const isSelected = selectedDay && isSameDay(d, selectedDay);
          const dots = dotsByDay.get(dayKey(d)) || [];
          return (
            <button
              key={i}
              onClick={() => onSelectDay(d)}
              className="flex flex-col items-center py-1"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                  isSelected
                    ? "bg-brand-500 font-semibold text-white"
                    : isToday
                    ? "bg-brand-100 font-semibold text-brand-700"
                    : inMonth
                    ? "text-slate-800"
                    : "text-slate-300"
                }`}
              >
                {d.getDate()}
              </span>
              <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                {dots.map((c, di) => (
                  <span
                    key={di}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
