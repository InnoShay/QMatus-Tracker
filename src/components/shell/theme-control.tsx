"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { setTheme } from "@/features/settings/actions";
import type { ThemePreference } from "@/lib/theme";

/**
 * Applies the theme instantly by flipping the root attribute (no reload, so
 * forms, scroll, filters and open panels are untouched), then persists it.
 */
export function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `qm-theme=${theme}; path=/; max-age=31536000; samesite=lax`;
}

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function ThemeControl({ initial, compact = false }: { initial: ThemePreference; compact?: boolean }) {
  // Opened later (e.g. in the account menu) it reflects the live choice, which the
  // top bar may have changed since the page loaded.
  const [value, setValue] = useState<ThemePreference>(() =>
    typeof document === "undefined" ? initial : ((document.documentElement.dataset.theme as ThemePreference | undefined) ?? initial),
  );
  const [, startTransition] = useTransition();

  const choose = (next: ThemePreference) => {
    setValue(next);
    applyTheme(next);
    startTransition(async () => {
      const res = await setTheme(next);
      if (!res.ok) toast(res.error.message, "error");
    });
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-sm border border-line-strong bg-subtle p-0.5">
      {OPTIONS.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          tabIndex={value === v ? 0 : -1}
          onClick={() => choose(v)}
          onKeyDown={(e) => {
            // Radio-group keyboard pattern: arrows move and select, one tab stop.
            const i = OPTIONS.findIndex((o) => o.value === v);
            const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            const next = OPTIONS[(i + step + OPTIONS.length) % OPTIONS.length];
            choose(next.value);
            (e.currentTarget.parentElement?.children[OPTIONS.indexOf(next)] as HTMLElement | undefined)?.focus();
          }}
          className={cn(
            "qm-press inline-flex h-7 items-center gap-1.5 rounded-xs px-2 text-label pointer-coarse:h-9",
            value === v ? "bg-surface text-fg shadow-raised" : "text-fg-2 hover:text-fg",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          <span className={compact ? "sr-only" : undefined}>{label}</span>
        </button>
      ))}
    </div>
  );
}
