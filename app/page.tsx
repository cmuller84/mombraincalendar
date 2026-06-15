"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarEvent, Person } from "@/lib/client";
import { api } from "@/lib/client";
import type { ParseResult } from "@/lib/types";
import { isSameDay, startOfDay } from "@/lib/dates";
import MonthGrid from "@/components/MonthGrid";
import AgendaList from "@/components/AgendaList";
import QuickAdd from "@/components/QuickAdd";
import ConfirmSheet from "@/components/ConfirmSheet";
import NotifyButton from "@/components/NotifyButton";

export default function Home() {
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string>("");

  const refresh = useCallback(async () => {
    const [p, e] = await Promise.all([api.getPeople(), api.getEvents()]);
    setPeople(p);
    setEvents(e);
  }, []);

  useEffect(() => {
    refresh().catch((err) => setToast(err.message));
  }, [refresh]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  async function handleParse(text: string) {
    setParsing(true);
    try {
      const result = await api.parse(text);
      if (result.needsClarification || result.events.length === 0) {
        flash(result.clarificationQuestion || "I couldn't find an event in that.");
      } else {
        setParseResult(result);
      }
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't parse that.");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm(payload: unknown[]) {
    setCreating(true);
    try {
      await api.createEvents(payload);
      setParseResult(null);
      await refresh();
      flash("Added to the family calendar ✓");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setEvents((evs) => evs.filter((e) => e.id !== id));
    await api.deleteEvent(id).catch(() => refresh());
  }

  const visibleEvents = useMemo(() => {
    if (selectedDay) {
      return events.filter((e) => isSameDay(new Date(e.start), selectedDay));
    }
    const todayStart = startOfDay(new Date());
    return events.filter((e) => new Date(e.start) >= todayStart);
  }, [events, selectedDay]);

  return (
    <main className="mx-auto min-h-screen max-w-2xl pb-28">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-lg font-bold leading-tight">
            Mom Brain <span className="text-brand-500">Calendar</span>
          </h1>
          <p className="text-xs text-slate-400">
            {people.length
              ? people.map((p) => p.name).join(" · ")
              : "Your shared family calendar"}
          </p>
        </div>
        <NotifyButton people={people} />
      </header>

      <section className="px-4 py-4">
        <MonthGrid
          anchor={anchor}
          events={events}
          selectedDay={selectedDay}
          onSelectDay={(d) =>
            setSelectedDay((cur) => (cur && isSameDay(cur, d) ? null : d))
          }
          onShiftMonth={(delta) =>
            setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + delta, 1))
          }
        />
      </section>

      <div className="flex items-center justify-between px-4">
        <h2 className="text-sm font-semibold text-slate-500">
          {selectedDay
            ? selectedDay.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : "Upcoming"}
        </h2>
        {selectedDay && (
          <button
            onClick={() => setSelectedDay(null)}
            className="text-sm font-medium text-brand-600"
          >
            Show all
          </button>
        )}
      </div>

      <section className="mt-2">
        <AgendaList events={visibleEvents} onDelete={handleDelete} />
      </section>

      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <div className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {parseResult && (
        <ConfirmSheet
          result={parseResult}
          people={people}
          busy={creating}
          onConfirm={handleConfirm}
          onCancel={() => setParseResult(null)}
        />
      )}

      <QuickAdd onSubmit={handleParse} busy={parsing} />
    </main>
  );
}
