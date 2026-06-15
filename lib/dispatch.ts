import { prisma } from "./db";
import { sendPush, sendSms, type NotifyPayload } from "./notify";

function humanWhen(start: Date, allDay: boolean): string {
  const opts: Intl.DateTimeFormatOptions = allDay
    ? { weekday: "long", month: "long", day: "numeric" }
    : {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      };
  return start.toLocaleString("en-US", opts);
}

function leadPhrase(offsetMinutes: number): string {
  if (offsetMinutes % 10080 === 0) return `in ${offsetMinutes / 10080} week(s)`;
  if (offsetMinutes % 1440 === 0) return `in ${offsetMinutes / 1440} day(s)`;
  if (offsetMinutes % 60 === 0) return `in ${offsetMinutes / 60} hour(s)`;
  return `in ${offsetMinutes} minutes`;
}

export interface DispatchSummary {
  processed: number;
  pushSent: number;
  smsSent: number;
  skipped: number;
  failed: number;
}

/**
 * Find every reminder that is now due and hasn't been sent, then notify each
 * assigned person via push (and SMS if they have a phone + Twilio is set up).
 */
export async function dispatchDueReminders(
  now: Date = new Date()
): Promise<DispatchSummary> {
  const due = await prisma.reminder.findMany({
    where: { fireAt: { lte: now }, sentAt: null },
    include: {
      event: {
        include: {
          assignees: {
            include: {
              person: { include: { pushSubscriptions: true } },
            },
          },
        },
      },
    },
    orderBy: { fireAt: "asc" },
    take: 200,
  });

  const summary: DispatchSummary = {
    processed: 0,
    pushSent: 0,
    smsSent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const reminder of due) {
    const { event } = reminder;
    const when = humanWhen(event.start, event.allDay);
    const lead = leadPhrase(reminder.offsetMinutes);
    const payload: NotifyPayload = {
      title: "📅 Reminder",
      body: `${event.title} — ${lead} (${when})`,
      url: "/",
    };

    for (const assignment of event.assignees) {
      const person = assignment.person;

      // Push to each of the person's devices.
      for (const sub of person.pushSubscriptions) {
        const outcome = await sendPush(sub, payload);
        await prisma.reminderDelivery.create({
          data: {
            reminderId: reminder.id,
            personId: person.id,
            channel: "push",
            status: outcome.status,
            detail: outcome.detail,
          },
        });
        if (outcome.status === "sent") summary.pushSent++;
        else if (outcome.status === "failed") summary.failed++;
        else summary.skipped++;

        // Prune dead subscriptions so we stop trying them.
        if (outcome.expired) {
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => undefined);
        }
      }

      // Text the person if they have a number on file.
      if (person.phone) {
        const outcome = await sendSms(
          person.phone,
          `📅 ${event.title} — ${lead} (${when})`
        );
        await prisma.reminderDelivery.create({
          data: {
            reminderId: reminder.id,
            personId: person.id,
            channel: "sms",
            status: outcome.status,
            detail: outcome.detail,
          },
        });
        if (outcome.status === "sent") summary.smsSent++;
        else if (outcome.status === "failed") summary.failed++;
        else summary.skipped++;
      }
    }

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { sentAt: now },
    });
    summary.processed++;
  }

  return summary;
}
