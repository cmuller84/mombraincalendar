// Run with: npm run reminders:dispatch
// Or on a schedule (cron/Task Scheduler) every few minutes. In production you
// can instead hit POST /api/reminders/dispatch with the CRON_SECRET.
import { dispatchDueReminders } from "../lib/dispatch";

async function main() {
  const summary = await dispatchDueReminders(new Date());
  console.log(
    `[reminders] processed=${summary.processed} push=${summary.pushSent} sms=${summary.smsSent} skipped=${summary.skipped} failed=${summary.failed}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit(0));
