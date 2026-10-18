"use client";

import { Bell, ChevronRight, Menu as MenuIcon, Moon, Search, Sun, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { IntentLink } from "@/components/nav/intent-link";
import { cn } from "@/components/ui/cn";
import { Tip } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { setTheme } from "@/features/settings/actions";
import type { ThemePreference } from "@/lib/theme";
import { applyTheme, useThemePreference } from "./theme-control";

export type Crumbs = {
  team: { name: string; href: string } | null;
  page: { label: string; href: string; Icon: LucideIcon } | null;
};

/** Round, glassy control used for every icon action in the bar. */
const iconButton =
  "qm-press group relative grid size-10 place-items-center rounded-full border border-line/80 bg-surface/50 text-fg-2 " +
  "hover:border-line-strong hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function TopBar({
  crumbs,
  unread,
  timerRunning,
  theme,
  onOpenNav,
  onOpenCommand,
  account,
}: {
  crumbs: Crumbs;
  unread: number;
  timerRunning: boolean;
  theme: ThemePreference;
  onOpenNav: () => void;
  onOpenCommand: () => void;
  account: ReactNode;
}) {
  // The bar gains depth once content scrolls beneath it (observer, not a scroll listener).
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} className="pointer-events-none absolute top-0 h-px w-px" aria-hidden />
      <header
        data-scrolled={scrolled || undefined}
        className="qm-glass qm-topbar sticky top-0 z-30 flex h-16 items-center gap-2 px-3 sm:px-4 lg:gap-4 lg:px-8"
      >
        <button
          type="button"
          onClick={onOpenNav}
          className={cn(iconButton, "border-transparent bg-transparent lg:hidden")}
          aria-label="Open navigation"
        >
          <MenuIcon className="size-5" aria-hidden />
        </button>
        <Link href="/my-work" className="rounded-xs lg:hidden" aria-label="QMatus home">
          <Wordmark />
        </Link>

        <Breadcrumbs crumbs={crumbs} />

        <button
          type="button"
          onClick={onOpenCommand}
          aria-label="Search and commands"
          aria-keyshortcuts="Meta+K Control+K"
          className={cn(
            "qm-press qm-search group ml-auto flex h-10 items-center gap-2.5 rounded-full border border-line/80 bg-surface/50 px-3.5 text-body text-fg-3",
            "hover:border-line-strong hover:text-fg-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            "sm:px-4 lg:ml-0 lg:w-[min(420px,36vw)] lg:flex-none",
          )}
        >
          <Search className="size-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:text-accent" aria-hidden />
          <span className="hidden flex-1 truncate text-left sm:inline">Search or jump to…</span>
          <kbd className="hidden items-center gap-0.5 rounded-full border border-line bg-subtle px-2 py-0.5 font-mono text-[11px] leading-none text-fg-3 lg:inline-flex">
            ⌘K
          </kbd>
        </button>

        <div className="flex items-center gap-1.5 lg:ml-auto">
          {timerRunning && (
            <IntentLink
              href="/my-time"
              className="qm-press hidden h-8 items-center gap-2 rounded-full border border-success/30 bg-success-bg px-3 text-label font-medium text-success hover:border-success/60 md:inline-flex"
            >
              <span className="relative grid size-2 place-items-center" aria-hidden>
                <span className="absolute size-2 animate-ping rounded-full bg-success/60 motion-reduce:animate-none" />
                <span className="size-2 rounded-full bg-success" />
              </span>
              Timer running
            </IntentLink>
          )}

          <ThemeToggle initial={theme} />

          <Tip label={unread ? `Inbox · ${unread} unread` : "Inbox"} side="bottom" shortcut={["G", "I"]}>
            <IntentLink
              href="/inbox"
              className={cn(iconButton, "hidden md:grid")}
              aria-label={unread ? `Inbox, ${unread} unread` : "Inbox"}
            >
              <Bell className="qm-bell size-[18px]" aria-hidden />
              {unread > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ember px-1 text-[10px] leading-none font-semibold text-on-ember tabular ring-2 ring-canvas"
                  aria-hidden
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </IntentLink>
          </Tip>

          <span className="mx-1 hidden h-6 w-px bg-line md:block" aria-hidden />
          {account}
        </div>
      </header>
    </>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: Crumbs }) {
  const { team, page } = crumbs;
  if (!team && !page) return null;
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-label lg:flex">
      {team && (
        <>
          <IntentLink
            href={team.href}
            className="flex min-w-0 items-center gap-2 rounded-full py-1 pr-2 pl-1 text-fg-2 transition-colors hover:bg-hover hover:text-fg"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
              {team.name.charAt(0)}
            </span>
            <span className="truncate">{team.name}</span>
          </IntentLink>
          {page && <ChevronRight className="size-3.5 shrink-0 text-fg-3" aria-hidden />}
        </>
      )}
      {page && (
        <span aria-current="page" className="flex items-center gap-1.5 rounded-full px-2 py-1 font-medium text-fg">
          <page.Icon className="size-4 text-accent" aria-hidden />
          {page.label}
        </span>
      )}
    </nav>
  );
}

const DARK_QUERY = () => window.matchMedia("(prefers-color-scheme: dark)");
function subscribeScheme(cb: () => void) {
  const mq = DARK_QUERY();
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** One click between dark and light; the full choice (incl. System) lives in the account menu. */
function ThemeToggle({ initial }: { initial: ThemePreference }) {
  const value = useThemePreference(initial);
  const [, startTransition] = useTransition();
  const osDark = useSyncExternalStore(
    subscribeScheme,
    () => DARK_QUERY().matches,
    () => true,
  );
  const isDark = value === "system" ? osDark : value === "dark";
  const next: ThemePreference = isDark ? "light" : "dark";
  return (
    <Tip label={isDark ? "Light theme" : "Dark theme"} side="bottom">
      <button
        type="button"
        className={iconButton}
        aria-label={`Switch to ${next} theme`}
        onClick={() => {
          applyTheme(next);
          startTransition(async () => {
            const res = await setTheme(next);
            if (!res.ok) toast(res.error.message, "error");
          });
        }}
      >
        <Sun className={cn("qm-theme-icon size-[18px]", isDark ? "qm-theme-icon-out" : "qm-theme-icon-in")} aria-hidden />
        <Moon className={cn("qm-theme-icon absolute size-[18px]", isDark ? "qm-theme-icon-in" : "qm-theme-icon-out")} aria-hidden />
      </button>
    </Tip>
  );
}
