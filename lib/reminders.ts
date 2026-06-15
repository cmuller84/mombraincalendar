import type { ParsedReminder } from "./types";

export const MINUTE = 1;
export const HOUR = 60;
export const DAY = 60 * 24;
export const WEEK = DAY * 7;

/** Handy presets for the UI (label -> minutes before). */
export const REMINDER_PRESETS: ParsedReminder[] = [
  { label: "1 week before", offsetMinutes: WEEK },
  { label: "3 days before", offsetMinutes: DAY * 3 },
  { label: "1 day before", offsetMinutes: DAY },
  { label: "morning of (3h)", offsetMinutes: HOUR * 3 },
  { label: "1 hour before", offsetMinutes: HOUR },
];

/**
 * Sensible default reminders when the user didn't ask for any. The idea: a far-out
 * event gets a week's heads-up plus a day-before nudge; a soon event just gets
 * a same-day nudge. Keeps things simple, like the user asked.
 */
export function defaultReminders(start: Date, now: Date): ParsedReminder[] {
  const minutesAway = (start.getTime() - now.getTime()) / 60000;
  const reminders: ParsedReminder[] = [];

  if (minutesAway > WEEK + DAY) {
    reminders.push({ label: "1 week before", offsetMinutes: WEEK });
  }
  if (minutesAway > DAY + HOUR) {
    reminders.push({ label: "1 day before", offsetMinutes: DAY });
  }
  if (reminders.length === 0 && minutesAway > HOUR * 3) {
    reminders.push({ label: "3 hours before", offsetMinutes: HOUR * 3 });
  }
  if (reminders.length === 0 && minutesAway > HOUR) {
    reminders.push({ label: "1 hour before", offsetMinutes: HOUR });
  }
  return reminders;
}

/** Compute the absolute fire time for a reminder, given the event start. */
export function fireAtFor(start: Date, offsetMinutes: number): Date {
  return new Date(start.getTime() - offsetMinutes * 60000);
}
