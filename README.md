# 🧠📅 Mom Brain Calendar

An AI-powered **shared family calendar** for busy parents who are tired of
forgetting things (and texting each other photos of the paper calendar).

Just say or type what's happening in plain English — *"Cleveland Guardians game
July 27th at 7pm"* — and it lands on the whole family's calendar with a
heads-up reminder that actually reaches your phone.

## Why this exists

Most calendar apps make you tap through a form. This one is built around one
idea: **tell it what you need, like you'd tell a person.** The AI figures out
the date, time, who it's for, and a sensible reminder. You glance, confirm,
done.

## What it does (v1)

- 🗣️ **Natural-language entry** — type it or tap the mic and speak. Powered by
  Claude. Works without an API key too (a simpler built-in parser kicks in).
- 👨‍👩‍👧 **One shared calendar** for the family, color-coded per person. Every event
  is "dispatched" to whoever it's for.
- 🔔 **Reminders that reach you** — phone **push notifications** (free) and
  optional **SMS texts** (via Twilio). No email nagging.
- ⏰ **Smart default heads-ups** — far-out events get a 1-week + 1-day warning;
  soon events get a same-day nudge. All adjustable per event.
- 📱 **Installable PWA** — add it to your home screen and it behaves like a real
  app on your phone.

## Tech

Next.js (App Router) · TypeScript · Prisma + SQLite · Tailwind · Claude API ·
Web Push (VAPID) · Twilio · Web Speech API.

## Getting started

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
#    Fill in what you want — every section is optional except DATABASE_URL.

# 3. Create the database + a starter household (Mom & Dad)
npm run db:push
npm run db:seed

# 4. Run it
npm run dev
# open http://localhost:3000
```

The app works immediately. Add keys (below) to unlock the magic bits.

### Turn on AI parsing (recommended)

Grab a key from [console.anthropic.com](https://console.anthropic.com) and set
it in `.env`:

```env
ANTHROPIC_API_KEY="sk-ant-..."
```

Without it, a lightweight offline parser handles common phrasings like
"July 27 at 7pm" or "next Friday" — just less cleverly.

### Turn on push notifications (free)

Generate a VAPID keypair once and paste it into `.env`:

```bash
npx web-push generate-vapid-keys
```

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:you@example.com"
```

Then in the app, tap the 🔔 bell, pick whose phone it is, and allow
notifications. (Push requires HTTPS in production, or localhost in dev.)

### Turn on SMS texts (optional, paid)

Sign up at [twilio.com](https://twilio.com), buy a number, and set:

```env
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
TWILIO_FROM_NUMBER="+1..."
```

Add a phone number to each person (in the DB / future Settings screen) and
they'll get texts too. Leave these blank to keep SMS off.

## Sending reminders on a schedule

Reminders are stored with a `fireAt` time. Something needs to "tick" and send
the due ones. Two options:

```bash
# Locally / cron / Task Scheduler — run every few minutes:
npm run reminders:dispatch
```

```bash
# Or hit the protected endpoint from any cron service (set CRON_SECRET in .env):
curl "https://your-app.example.com/api/reminders/dispatch?secret=YOUR_SECRET"
```

On Vercel, add a `vercel.json` cron pointing at `/api/reminders/dispatch`.

## How a request flows

```
You speak/type  ──▶  POST /api/parse  ──▶  Claude (or fallback) returns
structured event(s)  ──▶  you confirm/tweak in the sheet  ──▶
POST /api/events  ──▶  saved + assigned to people + reminders scheduled
                                                  │
        cron ──▶ /api/reminders/dispatch ─────────┘ ──▶ push + SMS to each person
```

## Project layout

```
app/                 Next.js routes (UI + API)
  api/parse          natural-language → structured events
  api/events         CRUD for events
  api/people         family members
  api/push/subscribe save a device's push subscription
  api/reminders/dispatch  cron entrypoint to send due reminders
components/           React UI (QuickAdd, ConfirmSheet, MonthGrid, AgendaList…)
lib/                  ai parser, db, reminders, notifications, dispatch
prisma/              schema + seed
public/sw.js         service worker that shows push notifications
```

## Roadmap ideas

- Settings screen to rename people, add phones, add kids
- Recurring events ("every Tuesday")
- Two-way sync with Google/Apple Calendar
- Per-person logins
- "What's on this week?" digest text every Sunday night
```
