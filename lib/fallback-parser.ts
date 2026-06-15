import type { ParseContext } from "./ai";
import type { ParsedEvent, ParseResult } from "./types";

// A small, dependency-free natural-language date parser. It is intentionally
// modest — it handles the common phrasings a busy parent will type — and exists
// so the app is fully usable before an Anthropic API key is configured.

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const WEEKDAYS = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Offset string like "-04:00" for a given date in a timezone. */
function tzOffset(date: Date, timeZone: string): string {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    });
    const part = dtf
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value;
    // part looks like "GMT-04:00"
    const m = part?.match(/GMT([+-]\d{2}:\d{2})/);
    if (m) return m[1];
  } catch {
    /* fall through */
  }
  return "+00:00";
}

function toIso(y: number, mo: number, d: number, h: number, mi: number, tz: string): string {
  // Build a wall-clock time, then attach the timezone's offset for that date.
  const probe = new Date(Date.UTC(y, mo, d, h, mi));
  const offset = tzOffset(probe, tz);
  return `${y}-${pad(mo + 1)}-${pad(d)}T${pad(h)}:${pad(mi)}:00${offset}`;
}

interface DateGuess {
  year: number;
  month: number; // 0-based
  day: number;
}

function nextWeekday(now: Date, targetDow: number): DateGuess {
  const d = new Date(now);
  const cur = d.getDay();
  let delta = (targetDow - cur + 7) % 7;
  if (delta === 0) delta = 7; // "next Friday" means the upcoming one, not today
  d.setDate(d.getDate() + delta);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function findDate(text: string, now: Date): DateGuess | null {
  const lower = text.toLowerCase();

  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  if (/\btoday\b/.test(lower) || /\btonight\b/.test(lower)) {
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }

  // "next friday", "on monday"
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(lower)) {
      return nextWeekday(now, i);
    }
  }

  // "july 27", "july 27th", "27 july"
  for (let i = 0; i < MONTHS.length; i++) {
    const mRe = new RegExp(
      `\\b${MONTHS[i]}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTHS[i]}\\b`
    );
    const m = lower.match(mRe);
    if (m) {
      const day = parseInt(m[1] || m[2], 10);
      let year = now.getFullYear();
      // If the month/day already passed this year, assume next year.
      const candidate = new Date(year, i, day);
      if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        year += 1;
      }
      return { year, month: i, day };
    }
  }

  // "7/27" or "07/27/2026"
  const numeric = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numeric) {
    const month = parseInt(numeric[1], 10) - 1;
    const day = parseInt(numeric[2], 10);
    let year = numeric[3] ? parseInt(numeric[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    return { year, month, day };
  }

  return null;
}

function findTime(text: string): { hour: number; minute: number } | null {
  const lower = text.toLowerCase();
  // "7pm", "7:30 pm", "19:00"
  const ampm = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (ampm) {
    let hour = parseInt(ampm[1], 10) % 12;
    if (ampm[3] === "pm") hour += 12;
    const minute = ampm[2] ? parseInt(ampm[2], 10) : 0;
    return { hour, minute };
  }
  const military = lower.match(/\b(\d{1,2}):(\d{2})\b/);
  if (military) {
    return { hour: parseInt(military[1], 10), minute: parseInt(military[2], 10) };
  }
  if (/\bnoon\b/.test(lower)) return { hour: 12, minute: 0 };
  if (/\bmidnight\b/.test(lower)) return { hour: 0, minute: 0 };
  return null;
}

/** Strip date/time/reminder words to leave a reasonable title. */
function deriveTitle(text: string): string {
  let t = text
    .replace(/\b(remind me to|remind me|add|schedule|put|create|set up|book)\b/gi, "")
    .replace(/\b(on|at|this|next|the)\b/gi, " ")
    .replace(/\btomorrow|today|tonight\b/gi, "")
    .replace(new RegExp(`\\b(${MONTHS.join("|")})\\s+\\d{1,2}(?:st|nd|rd|th)?`, "gi"), "")
    .replace(new RegExp(`\\b(${WEEKDAYS.join("|")})\\b`, "gi"), "")
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, "")
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) t = "New event";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function fallbackParse(text: string, ctx: ParseContext): ParseResult {
  const dateGuess = findDate(text, ctx.now);
  const time = findTime(text);

  if (!dateGuess) {
    return {
      events: [],
      summary: "",
      needsClarification: true,
      clarificationQuestion:
        "I couldn't tell when this should happen. Try including a date like 'July 27' or 'next Friday'. (Tip: add an Anthropic API key for smarter parsing.)",
      engine: "fallback",
    };
  }

  const allDay = !time;
  const hour = time?.hour ?? 9;
  const minute = time?.minute ?? 0;
  const start = toIso(
    dateGuess.year,
    dateGuess.month,
    dateGuess.day,
    hour,
    minute,
    ctx.timezone
  );

  const event: ParsedEvent = {
    title: deriveTitle(text),
    start,
    end: null,
    allDay,
    location: null,
    notes: null,
    assigneeNames: ["everyone"],
    reminders: [],
  };

  return {
    events: [event],
    summary: `Got it — "${event.title}" on ${new Date(start).toLocaleDateString(
      "en-US",
      { weekday: "short", month: "short", day: "numeric" }
    )}.`,
    needsClarification: false,
    engine: "fallback",
  };
}
