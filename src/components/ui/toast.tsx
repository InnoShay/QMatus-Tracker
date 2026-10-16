"use client";

import { CircleCheck, CircleAlert, X } from "lucide-react";
import { useSyncExternalStore } from "react";

type Toast = { id: number; tone: "success" | "error"; message: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Confirms completed actions. Durable events belong in the Inbox, not here. */
export function toast(message: string, tone: Toast["tone"] = "success") {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, tone, message }];
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4000);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => toasts;
const EMPTY: Toast[] = [];
const getServerSnapshot = () => EMPTY;

export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:items-end md:pb-4"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className="qm-toast qm-glass-panel pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg px-3.5 py-3 text-body text-fg"
        >
          {t.tone === "success" ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          )}
          <p className="flex-1">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="-m-1 grid size-6 place-items-center pointer-coarse:size-10 rounded-xs text-fg-3 hover:bg-hover hover:text-fg"
            aria-label="Dismiss notification"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
