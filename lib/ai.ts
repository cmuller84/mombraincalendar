import Anthropic from "@anthropic-ai/sdk";
import type { ParsedEvent, ParseResult } from "./types";
import { fallbackParse } from "./fallback-parser";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export interface ParseContext {
  /** Current moment as an ISO string, in the user's timezone. */
  now: Date;
  timezone: string;
  /** Known family member names, so the model can route assignments. */
  peopleNames: string[];
}

// JSON Schema describing exactly what we want back. Using a tool forces the
// model to return well-formed, structured data instead of prose.
const EVENT_TOOL: Anthropic.Tool = {
  name: "save_events",
  description:
    "Record one or more calendar events parsed from the user's request.",
  input_schema: {
    type: "object",
    properties: {
      events: {
        type: "array",
        description: "The events extracted from the message.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description:
                "Short, clean event title, e.g. 'Cleveland Guardians game'. Do not include the date or reminder phrasing.",
            },
            start: {
              type: "string",
              description:
                "Event start as ISO 8601 WITH the correct UTC offset for the user's timezone and date (account for daylight saving), e.g. '2026-07-27T19:10:00-04:00'. For all-day events use midnight local time.",
            },
            end: {
              type: ["string", "null"],
              description: "ISO 8601 end with offset, or null if unknown.",
            },
            allDay: { type: "boolean" },
            location: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            assigneeNames: {
              type: "array",
              items: { type: "string" },
              description:
                "Family member names this event is for. Use the special value 'everyone' if it is for the whole family or unspecified.",
            },
            reminders: {
              type: "array",
              description:
                "Heads-up reminders. If the user does not specify, leave empty and the app will apply sensible defaults.",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  offsetMinutes: {
                    type: "integer",
                    description: "Minutes before start. 1 week = 10080, 1 day = 1440, 1 hour = 60.",
                  },
                },
                required: ["label", "offsetMinutes"],
              },
            },
          },
          required: ["title", "start", "allDay", "assigneeNames"],
        },
      },
      summary: {
        type: "string",
        description:
          "One friendly sentence confirming what you scheduled, in plain language.",
      },
      needsClarification: { type: "boolean" },
      clarificationQuestion: {
        type: ["string", "null"],
        description: "If something is ambiguous (e.g. unclear date), ask here.",
      },
    },
    required: ["events", "summary", "needsClarification"],
  },
};

function systemPrompt(ctx: ParseContext): string {
  return [
    "You are the scheduling brain of a shared family calendar app for busy parents.",
    "Turn the user's natural-language request (typed or spoken) into structured calendar events.",
    "",
    `The current date and time is ${ctx.now.toString()} (timezone: ${ctx.timezone}).`,
    "Resolve relative dates like 'next Friday', 'tomorrow', 'in two weeks' against that.",
    "Pick reasonable default times when only a date is given (e.g. a kid's game at 6pm, a dinner at 6:30pm) but prefer all-day if it is clearly a whole-day thing.",
    "",
    `Known family members: ${ctx.peopleNames.join(", ") || "(none yet)"}.`,
    "Match assignees to those names when the user mentions someone. If unspecified or 'the family', use 'everyone'.",
    "",
    "Always call the save_events tool. Keep titles concise. Never invent reminders the user didn't ask for — leave reminders empty and let the app apply defaults.",
  ].join("\n");
}

/**
 * Parse a natural-language scheduling request into structured events.
 * Falls back to a lightweight offline parser when no API key is configured
 * or the API call fails, so the app is always usable.
 */
export async function parseRequest(
  text: string,
  ctx: ParseContext
): Promise<ParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallbackParse(text, ctx);
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(ctx),
      tools: [EVENT_TOOL],
      tool_choice: { type: "tool", name: "save_events" },
      messages: [{ role: "user", content: text }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (!toolUse) {
      return fallbackParse(text, ctx);
    }

    const data = toolUse.input as {
      events: ParsedEvent[];
      summary: string;
      needsClarification: boolean;
      clarificationQuestion?: string | null;
    };

    return {
      events: (data.events || []).map(normalizeEvent),
      summary: data.summary || "Here's what I scheduled.",
      needsClarification: Boolean(data.needsClarification),
      clarificationQuestion: data.clarificationQuestion || undefined,
      engine: "claude",
    };
  } catch (err) {
    console.error("Claude parse failed, using fallback:", err);
    return fallbackParse(text, ctx);
  }
}

function normalizeEvent(e: ParsedEvent): ParsedEvent {
  return {
    title: e.title?.trim() || "Untitled event",
    start: e.start,
    end: e.end ?? null,
    allDay: Boolean(e.allDay),
    location: e.location?.trim() || null,
    notes: e.notes?.trim() || null,
    assigneeNames:
      Array.isArray(e.assigneeNames) && e.assigneeNames.length
        ? e.assigneeNames
        : ["everyone"],
    reminders: Array.isArray(e.reminders) ? e.reminders : [],
  };
}
