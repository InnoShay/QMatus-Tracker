"use client";

import {
  Bell,
  ChevronDown,
  Check,
  Inbox,
  KeyRound,
  Kanban,
  LayoutDashboard,
  Library,
  Lightbulb,
  ListTodo,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Search,
  Send,
  Settings,
  Timer,
  FolderKanban,
  Users,
  Rows3,
  X,
  type LucideIcon,
} from "lucide-react";
import { Dialog } from "radix-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { LogoMark, Wordmark } from "@/components/brand/wordmark";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Tip, TooltipProvider } from "@/components/ui/overlays";
import { signOut } from "@/features/auth/actions";
import type { ThemePreference } from "@/lib/theme";
import { CommandMenu, type Command } from "./command-menu";
import { ThemeControl } from "./theme-control";

export type ShellTeam = { slug: string; name: string; access: string; acceptsRequests: boolean };

type ShellProps = {
  user: { name: string; email: string; title: string | null };
  theme: ThemePreference;
  teams: ShellTeam[];
  summaryTeams: ShellTeam[];
  isAdmin: boolean;
  isLead: boolean;
  unread: number;
  /** The viewer's own timer is running (shown as a dot on My Time). */
  timerRunning: boolean;
  children: ReactNode;
};

type NavItem = { href: string; label: string; Icon: LucideIcon; badge?: number; exact?: boolean; live?: boolean };

const SIDEBAR_KEY = "qm-sidebar-collapsed";
const TEAM_KEY = "qm-last-team";

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
const LOCAL_EVENT = "qm-local-pref";
function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the preference just isn't remembered */
  }
  window.dispatchEvent(new Event(LOCAL_EVENT));
}
function subscribeLocal(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(LOCAL_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(LOCAL_EVENT, cb);
  };
}
/** Per-viewer convenience preference; absent on the server and in private windows. */
function useLocalPref(key: string): string | null {
  return useSyncExternalStore(
    subscribeLocal,
    () => readLocal(key),
    () => null,
  );
}

export function AppShell({ user, theme, teams, summaryTeams, isAdmin, isLead, unread, timerRunning, children }: ShellProps) {
  const pathname = usePathname();
  const collapsed = useLocalPref(SIDEBAR_KEY) === "1";
  const lastTeam = useLocalPref(TEAM_KEY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setDrawerOpen(false);
  }

  const urlTeam = pathname.match(/^\/t\/([^/]+)/)?.[1] ?? null;
  const allTeams = [...teams, ...summaryTeams];
  const currentSlug =
    (urlTeam && allTeams.some((t) => t.slug === urlTeam) ? urlTeam : null) ??
    (lastTeam && allTeams.some((t) => t.slug === lastTeam) ? lastTeam : null) ??
    teams[0]?.slug ??
    summaryTeams[0]?.slug ??
    null;
  const current = allTeams.find((t) => t.slug === currentSlug) ?? null;

  useEffect(() => {
    if (urlTeam && readLocal(TEAM_KEY) !== urlTeam) writeLocal(TEAM_KEY, urlTeam);
  }, [urlTeam]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () => writeLocal(SIDEBAR_KEY, collapsed ? "0" : "1");

  const globalNav: NavItem[] = [
    { href: "/my-work", label: "My Work", Icon: ListTodo },
    { href: "/my-time", label: "My Time", Icon: Timer, live: timerRunning },
    { href: "/inbox", label: "Inbox", Icon: Inbox, badge: unread },
    { href: "/requests", label: "Requests", Icon: Send },
  ];

  const teamNav: NavItem[] = current
    ? current.access === "summary"
      ? [{ href: `/t/${current.slug}`, label: "Summary", Icon: LayoutDashboard, exact: true }]
      : [
          { href: `/t/${current.slug}`, label: "Dashboard", Icon: LayoutDashboard, exact: true },
          { href: `/t/${current.slug}/board`, label: "Board", Icon: Kanban },
          { href: `/t/${current.slug}/list`, label: "List", Icon: Rows3 },
          { href: `/t/${current.slug}/projects`, label: "Projects", Icon: FolderKanban },
          ...(current.acceptsRequests ? [{ href: `/t/${current.slug}/intake`, label: "Work Requests", Icon: Send }] : []),
          { href: `/t/${current.slug}/ideas`, label: "Parking Lot", Icon: Lightbulb },
          { href: `/t/${current.slug}/library`, label: "Library", Icon: Library },
        ]
    : [];

  const adminNav: NavItem[] = [
    ...(isAdmin ? [{ href: "/admin", label: "Members", Icon: Users, exact: true }] : []),
    ...(isAdmin || isLead
      ? [
          { href: "/admin/access", label: "Access", Icon: KeyRound },
          { href: "/admin/audit", label: "Audit log", Icon: ScrollText },
        ]
      : []),
  ];

  const commands: Command[] = [
    { id: "my-work", label: "My Work", href: "/my-work" },
    { id: "my-time", label: "My Time", href: "/my-time" },
    { id: "inbox", label: "Inbox", href: "/inbox" },
    { id: "new-request", label: "New work request", href: "/requests/new" },
    ...teams.flatMap((t) => [
      { id: `board-${t.slug}`, label: `${t.name} board`, href: `/t/${t.slug}/board` },
      { id: `list-${t.slug}`, label: `${t.name} list`, href: `/t/${t.slug}/list` },
    ]),
    { id: "settings", label: "Settings", href: "/settings" },
  ];

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const navLink = (item: NavItem, compact: boolean) => {
    const active = isActive(item);
    const link = (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-body transition-colors duration-[120ms] pointer-coarse:h-10",
          active ? "bg-selected font-medium text-fg" : "text-fg-2 hover:bg-hover hover:text-fg",
          compact && "justify-center px-0",
        )}
      >
        <item.Icon className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-fg-3 group-hover:text-fg-2")} aria-hidden />
        <span className={cn("flex-1 truncate", compact && "sr-only")}>{item.label}</span>
        {active && !item.badge && !item.live && <span className={cn("qm-notch", compact && "absolute top-1.5 right-1.5")} aria-hidden />}
        {item.live &&
          (compact ? (
            <span className="sr-only">Timer running</span>
          ) : (
            <span className="flex items-center gap-1.5 text-meta text-fg-3">
              <span className="size-2 animate-pulse rounded-full bg-success motion-reduce:animate-none" aria-hidden />
              Running
            </span>
          ))}
        {!!item.badge && !compact && (
          <span className="tabular rounded-full bg-ember-soft px-1.5 text-meta font-semibold text-ember-ink">
            {item.badge > 99 ? "99+" : item.badge}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </Link>
    );
    return compact ? (
      <Tip
        key={item.href}
        label={item.badge ? `${item.label} (${item.badge})` : item.live ? `${item.label} (timer running)` : item.label}
        side="right"
      >
        {link}
      </Tip>
    ) : (
      <div key={item.href}>{link}</div>
    );
  };

  const teamSwitcher = (compact: boolean) =>
    allTeams.length > 0 && current ? (
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-surface shadow-panel px-2 text-left shadow-panel hover:border-line-strong hover:bg-hover pointer-coarse:h-12",
              compact && "justify-center border-transparent bg-transparent px-0 shadow-none",
            )}
            aria-label={`Current team: ${current.name}. Switch team`}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-accent-soft text-label font-semibold text-accent">
              {current.name.charAt(0)}
            </span>
            {!compact && (
              <>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body leading-5 font-medium text-fg">{current.name}</span>
                  <span className="truncate text-meta text-fg-3">{current.access === "summary" ? "Summary access" : "Team workspace"}</span>
                </span>
                <ChevronDown className="size-4 text-fg-3" aria-hidden />
              </>
            )}
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="w-60">
          <MenuLabel>Your teams</MenuLabel>
          {teams.map((t) => (
            <MenuItem key={t.slug} asChild>
              <Link href={`/t/${t.slug}`}>
                <span className="flex-1 truncate">{t.name}</span>
                {t.slug === current.slug && <Check className="size-4 text-accent" aria-label="Current" />}
              </Link>
            </MenuItem>
          ))}
          {summaryTeams.length > 0 && (
            <>
              <MenuSeparator />
              <MenuLabel>Summary access</MenuLabel>
              {summaryTeams.map((t) => (
                <MenuItem key={t.slug} asChild>
                  <Link href={`/t/${t.slug}`}>
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="text-meta text-fg-3">Summary</span>
                  </Link>
                </MenuItem>
              ))}
            </>
          )}
        </MenuContent>
      </Menu>
    ) : null;

  const sidebarBody = (compact: boolean) => (
    <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pt-1 pb-3">
      <div className="flex flex-col gap-0.5">
        {!compact && <p className="px-2.5 pb-1.5 text-meta font-medium text-fg-3">Workspace</p>}
        {globalNav.map((i) => navLink(i, compact))}
      </div>
      {current && (
        <div className="flex flex-col gap-0.5">
          {teamSwitcher(compact)}
          <div className="mt-2 flex flex-col gap-0.5">{teamNav.map((i) => navLink(i, compact))}</div>
        </div>
      )}
      {allTeams.length === 0 && !compact && (
        <p className="px-2 text-meta text-fg-3">You aren’t on a team yet. A workspace admin can add you.</p>
      )}
      {adminNav.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {!compact && <p className="px-2.5 pb-1.5 text-meta font-medium text-fg-3">Administration</p>}
          {adminNav.map((i) => navLink(i, compact))}
        </div>
      )}
      <div className="mt-auto flex flex-col gap-0.5">{navLink({ href: "/settings", label: "Settings", Icon: Settings }, compact)}</div>
    </nav>
  );

  const userMenu = (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full hover:bg-hover pointer-coarse:size-11"
          aria-label="Account menu"
        >
          <Avatar name={user.name} />
        </button>
      </MenuTrigger>
      <MenuContent className="w-64">
        <div className="px-2 py-2">
          <p className="truncate text-body font-medium text-fg">{user.name}</p>
          <p className="truncate text-meta text-fg-3">{user.email}</p>
        </div>
        <div className="px-2 pb-2">
          <ThemeControl initial={theme} />
        </div>
        <MenuSeparator />
        <MenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4 text-fg-3" aria-hidden /> Settings
          </Link>
        </MenuItem>
        <MenuItem onSelect={() => void signOut()}>
          <LogOut className="size-4 text-fg-3" aria-hidden /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );

  const bottomNav: NavItem[] = [
    { href: "/my-work", label: "My Work", Icon: ListTodo },
    ...(current && current.access !== "summary" ? [{ href: `/t/${current.slug}/board`, label: "Board", Icon: Kanban }] : []),
    { href: "/requests", label: "Requests", Icon: Send },
    { href: "/inbox", label: "Inbox", Icon: Bell, badge: unread },
  ];

  return (
    <TooltipProvider>
      <a
        href="#main"
        className="sr-only z-[70] rounded-sm bg-surface px-3 py-2 text-body text-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-rail lg:flex",
            collapsed ? "w-[68px]" : "w-64",
          )}
        >
          <div className={cn("flex h-16 items-center gap-2 px-5", collapsed && "flex-col justify-center gap-1 px-0 pt-2")}>
            {collapsed && (
              <Link href="/my-work" className="rounded-xs" aria-label="QMatus home">
                <LogoMark className="w-[22px]" />
              </Link>
            )}
            {!collapsed && (
              <Link href="/my-work" className="flex-1 rounded-xs" aria-label="QMatus home">
                <Wordmark />
              </Link>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="grid size-8 place-items-center rounded-sm text-fg-3 hover:bg-hover hover:text-fg"
            >
              {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
            </button>
          </div>
          {sidebarBody(collapsed)}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-canvas/95 px-3 backdrop-blur-sm sm:px-4 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid size-10 place-items-center rounded-sm text-fg-2 hover:bg-hover lg:hidden"
              aria-label="Open navigation"
            >
              <MenuIcon className="size-5" aria-hidden />
            </button>
            <Link href="/my-work" className="lg:hidden" aria-label="QMatus home">
              <Wordmark />
            </Link>
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="qm-press ml-auto flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-body text-fg-3 shadow-panel hover:border-line-strong hover:text-fg-2 lg:ml-0 lg:w-96"
              aria-label="Search and commands"
            >
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="hidden flex-1 text-left sm:inline">Search…</span>
              <kbd className="hidden rounded-full border border-line bg-subtle px-2 font-mono text-meta text-fg-3 lg:inline">⌘K</kbd>
            </button>
            <div className="flex items-center gap-1 lg:ml-auto">
              <Link
                href="/inbox"
                className="qm-press relative hidden size-10 place-items-center rounded-full border border-line bg-surface text-fg-2 shadow-panel hover:border-line-strong hover:text-fg md:grid"
                aria-label={unread ? `Inbox, ${unread} unread` : "Inbox"}
              >
                <Bell className="size-[18px]" aria-hidden />
                {unread > 0 && <span className="absolute top-2 right-2.5 size-2 rounded-full bg-ember ring-2 ring-surface" aria-hidden />}
              </Link>
              {userMenu}
            </div>
          </header>

          <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col pb-20 outline-none md:pb-0">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Quick"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-rail pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ gridTemplateColumns: `repeat(${bottomNav.length}, minmax(0, 1fr))` }}
      >
        {bottomNav.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-14 flex-col items-center justify-center gap-0.5 text-meta",
                active ? "text-accent" : "text-fg-2",
              )}
            >
              <item.Icon className="size-5" aria-hidden />
              {item.label}
              {!!item.badge && (
                <span className="absolute top-2 left-[calc(50%+6px)] size-2 rounded-full bg-ember" aria-label={`${item.badge} unread`} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Mobile/tablet navigation drawer (enters from the left, like the sidebar it replaces) */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-[min(300px,86vw)] flex-col bg-rail shadow-float lg:hidden"
          >
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <div className="flex h-14 items-center justify-between px-4">
              <Wordmark withProduct />
              <Dialog.Close className="grid size-10 place-items-center rounded-sm text-fg-2 hover:bg-hover" aria-label="Close navigation">
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>
            {sidebarBody(false)}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} commands={commands} />
    </TooltipProvider>
  );
}
