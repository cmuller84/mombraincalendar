import { NextResponse } from "next/server";
import { dispatchDueReminders } from "@/lib/dispatch";

export const dynamic = "force-dynamic";

// Triggered by a cron job (e.g. every 5 minutes) to send due reminders.
// Protect it with a shared secret so randoms can't spam your family.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // not configured -> allow (dev convenience)
  const header = req.headers.get("authorization") || "";
  const url = new URL(req.url);
  const qs = url.searchParams.get("secret");
  return header === `Bearer ${secret}` || qs === secret;
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await dispatchDueReminders(new Date());
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: Request) {
  return run(req);
}

// Allow GET too, so simple cron services that only do GET can call it.
export async function GET(req: Request) {
  return run(req);
}
