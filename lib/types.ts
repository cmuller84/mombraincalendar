// Shared types for the AI parser and the API layer.

export interface ParsedReminder {
  /** Human label, e.g. "1 week before". */
  label: string;
  /** Minutes before the event start that this reminder fires. */
  offsetMinutes: number;
}

export interface ParsedEvent {
  title: string;
  /** ISO 8601 with timezone offset, e.g. "2026-07-27T19:10:00-04:00". */
  start: string;
  /** ISO 8601 end, or null if unknown. */
  end: string | null;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  /** Names of people this should be dispatched to. "everyone" => all family. */
  assigneeNames: string[];
  reminders: ParsedReminder[];
}

export interface ParseResult {
  events: ParsedEvent[];
  /** A short, friendly confirmation message to show the user. */
  summary: string;
  /** True when the model needs more info (e.g. ambiguous date). */
  needsClarification: boolean;
  clarificationQuestion?: string;
  /** Which engine produced this: the LLM or the offline fallback. */
  engine: "claude" | "fallback";
}
