// Tiny typed client for the browser to talk to our API routes.
import type { ParseResult } from "./types";

export interface Person {
  id: string;
  name: string;
  color: string;
  isAdult: boolean;
  phone: string | null;
}

export interface EventAssignee {
  id: string;
  name: string;
  color: string;
}

export interface EventReminder {
  id: string;
  offsetMinutes: number;
  fireAt: string;
  sentAt: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  sourceText: string | null;
  assignees: EventAssignee[];
  reminders: EventReminder[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  async getPeople(): Promise<Person[]> {
    const data = await json<{ people: Person[] }>(await fetch("/api/people"));
    return data.people;
  },

  async getEvents(): Promise<CalendarEvent[]> {
    const data = await json<{ events: CalendarEvent[] }>(
      await fetch("/api/events", { cache: "no-store" })
    );
    return data.events;
  },

  async parse(text: string): Promise<ParseResult> {
    return json<ParseResult>(
      await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
    );
  },

  async createEvents(events: unknown[]): Promise<{ events: CalendarEvent[] }> {
    return json(
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      })
    );
  },

  async deleteEvent(id: string): Promise<void> {
    await fetch(`/api/events/${id}`, { method: "DELETE" });
  },

  async updatePerson(): Promise<void> {
    /* reserved for future settings UI wiring */
  },

  async savePushSubscription(
    personId: string,
    subscription: PushSubscriptionJSON
  ): Promise<void> {
    await json(
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, subscription }),
      })
    );
  },
};
