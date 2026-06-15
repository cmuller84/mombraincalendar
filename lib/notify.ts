import webpush from "web-push";

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface NotifyPayload {
  title: string;
  body: string;
  /** Deep link to open when the notification is tapped. */
  url?: string;
}

export type SendOutcome = {
  status: "sent" | "failed" | "skipped";
  detail?: string;
  /** Set when the subscription is gone (410/404) so the caller can prune it. */
  expired?: boolean;
};

export async function sendPush(
  target: PushTarget,
  payload: NotifyPayload
): Promise<SendOutcome> {
  if (!ensureVapid()) {
    return { status: "skipped", detail: "VAPID keys not configured" };
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(payload)
    );
    return { status: "sent" };
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    const expired = statusCode === 404 || statusCode === 410;
    return {
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
      expired,
    };
  }
}

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

export async function sendSms(
  to: string,
  body: string
): Promise<SendOutcome> {
  if (!smsConfigured()) {
    return { status: "skipped", detail: "Twilio not configured" };
  }
  try {
    // Imported lazily so the app builds/runs even if twilio isn't installed.
    const twilio = (await import("twilio")).default;
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
    await client.messages.create({
      to,
      from: process.env.TWILIO_FROM_NUMBER!,
      body,
    });
    return { status: "sent" };
  } catch (err) {
    return {
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
