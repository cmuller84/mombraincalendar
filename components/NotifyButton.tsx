"use client";

import { useEffect, useState } from "react";
import type { Person } from "@/lib/client";
import { api } from "@/lib/client";
import { enablePush, pushSupported } from "@/lib/push-client";

const STORAGE_KEY = "mbc.personId";

export default function NotifyButton({ people }: { people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "on" | "working" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPersonId(saved);
      if (Notification?.permission === "granted") setStatus("on");
    }
  }, []);

  async function enable() {
    if (!personId) {
      setMessage("Pick who this phone belongs to first.");
      return;
    }
    if (!pushSupported()) {
      setMessage("This browser doesn't support push. Add the app to your home screen and try again.");
      setStatus("error");
      return;
    }
    setStatus("working");
    setMessage("");
    try {
      const sub = await enablePush();
      if (!sub) {
        setStatus("error");
        setMessage("Notifications were blocked. Enable them in your browser settings.");
        return;
      }
      await api.savePushSubscription(personId, sub);
      localStorage.setItem(STORAGE_KEY, personId);
      setStatus("on");
      setMessage("You're set — reminders will pop up on this phone.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 active:bg-slate-100"
        aria-label="Notification settings"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill={status === "on" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold">Reminders on this phone</p>
            <p className="mt-1 text-xs text-slate-500">
              Get a pop-up when an event is coming up. Who uses this phone?
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersonId(p.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    personId === p.id
                      ? "border-transparent text-white"
                      : "border-slate-300 text-slate-600"
                  }`}
                  style={personId === p.id ? { backgroundColor: p.color } : undefined}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <button
              onClick={enable}
              disabled={status === "working"}
              className="mt-3 w-full rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white active:bg-brand-600 disabled:opacity-50"
            >
              {status === "on"
                ? "✓ Notifications on"
                : status === "working"
                ? "Enabling…"
                : "Turn on notifications"}
            </button>

            {message && (
              <p
                className={`mt-2 text-xs ${
                  status === "error" ? "text-rose-600" : "text-slate-500"
                }`}
              >
                {message}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
