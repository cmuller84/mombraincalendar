// Browser-side helpers for enabling Web Push notifications.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js");
}

/**
 * Ask permission and create a push subscription. Returns the subscription JSON
 * to send to the server, or null if unsupported / denied / no VAPID key.
 */
export async function enablePush(): Promise<PushSubscriptionJSON | null> {
  if (!pushSupported()) return null;
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    throw new Error(
      "Push isn't set up yet. Add VAPID keys to your .env (npx web-push generate-vapid-keys)."
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const reg = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    }));

  return subscription.toJSON();
}
