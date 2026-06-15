"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (not in standard lib DOM types).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function QuickAdd({
  onSubmit,
  busy,
}: {
  onSubmit: (text: string) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setVoiceAvailable(Boolean(getRecognition()));
  }, []);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = getRecognition();
    if (!recognition) return;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setText(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function submit() {
    const value = text.trim();
    if (!value || busy) return;
    onSubmit(value);
    setText("");
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl items-end gap-2 p-3">
        {voiceAvailable && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? "Stop listening" : "Speak"}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition ${
              listening
                ? "animate-pulse bg-rose-500 text-white"
                : "bg-slate-100 text-slate-600 active:bg-slate-200"
            }`}
          >
            <MicIcon />
          </button>
        )}

        <div className="flex flex-1 items-end rounded-2xl border border-slate-300 bg-white px-3 py-2 focus-within:border-brand-500">
          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              listening ? "Listening…" : "Try: Guardians game July 27 at 7pm"
            }
            className="max-h-32 flex-1 resize-none bg-transparent text-base outline-none placeholder:text-slate-400"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy || !text.trim()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition active:bg-brand-600 disabled:opacity-40"
          aria-label="Add to calendar"
        >
          {busy ? <Spinner /> : <SendIcon />}
        </button>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
