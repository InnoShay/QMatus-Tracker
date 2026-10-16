"use client";

import { FileText, FolderKanban, Lightbulb, Search, Send, SquareKanban, type LucideIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { IssueKey } from "@/components/ui/badges";
import { cn } from "@/components/ui/cn";
import { searchWorkspace } from "@/features/search/actions";
import type { SearchHit } from "@/features/search/hits";

export type Command = { id: string; label: string; href: string; hint?: string };

const KIND: Record<SearchHit["kind"], { label: string; Icon: LucideIcon }> = {
  task: { label: "Tasks", Icon: SquareKanban },
  project: { label: "Projects", Icon: FolderKanban },
  request: { label: "Requests", Icon: Send },
  idea: { label: "Parking Lot", Icon: Lightbulb },
  library: { label: "Library", Icon: FileText },
};

/**
 * ⌘K / Ctrl+K. Deliberately has no open/close animation: it is keyboard-driven
 * and used constantly (Emil: never animate 100+/day keyboard surfaces).
 */
export function CommandMenu({ open, onOpenChange, commands }: { open: boolean; onOpenChange: (o: boolean) => void; commands: Command[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [rawHits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const listId = useId();
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const mySeq = ++seq.current;
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await searchWorkspace(q);
        if (mySeq !== seq.current) return;
        if (res.ok) {
          setHits(res.data);
          setError(null);
        } else setError(res.error.message);
        setActive(0);
      });
    }, 160);
    return () => clearTimeout(t);
  }, [query]);

  const hits = query.trim().length >= 2 ? rawHits : [];
  const matchingCommands = query.trim() ? commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase())) : commands;
  const items: { key: string; href: string }[] = [
    ...matchingCommands.map((c) => ({ key: `c-${c.id}`, href: c.href })),
    ...hits.map((h) => ({ key: `h-${h.kind}-${h.id}`, href: h.href })),
  ];

  const close = (next: boolean) => {
    if (!next) {
      setQuery("");
      setHits([]);
      setError(null);
      setActive(0);
    }
    onOpenChange(next);
  };

  const go = (href: string) => {
    close(false);
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      go(items[active].href);
    }
  };

  const grouped = (Object.keys(KIND) as SearchHit["kind"][])
    .map((k) => ({ kind: k, rows: hits.filter((h) => h.kind === k) }))
    .filter((g) => g.rows.length);
  let index = matchingCommands.length;
  const activeKey = items[active]?.key;

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim backdrop-blur-[3px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[12dvh] left-1/2 z-50 flex max-h-[70dvh] w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-overlay qm-glass-panel"
        >
          <Dialog.Title className="sr-only">Search and commands</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search className="size-4 shrink-0 text-fg-3" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search tasks, projects, requests…"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeKey}
              aria-autocomplete="list"
              className="h-12 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-3"
            />
            {pending && <span className="text-meta text-fg-3">Searching…</span>}
          </div>
          <div id={listId} role="listbox" aria-label="Results" className="min-h-0 overflow-y-auto p-1.5">
            {matchingCommands.length > 0 && (
              <div role="group" aria-label="Go to">
                <p className="px-2.5 pt-2 pb-1 text-meta font-medium text-fg-3">Go to</p>
                {matchingCommands.map((c, i) => (
                  <button
                    key={c.id}
                    id={`c-${c.id}`}
                    role="option"
                    aria-selected={active === i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(c.href)}
                    className={cn(
                      "flex h-9 w-full items-center justify-between rounded-sm px-2.5 text-left text-body text-fg",
                      active === i && "bg-hover",
                    )}
                  >
                    {c.label}
                    {c.hint && <span className="text-meta text-fg-3">{c.hint}</span>}
                  </button>
                ))}
              </div>
            )}
            {grouped.map(({ kind, rows }) => {
              const { label, Icon } = KIND[kind];
              return (
                <div key={kind} role="group" aria-label={label}>
                  <p className="px-2.5 pt-3 pb-1 text-meta font-medium text-fg-3">{label}</p>
                  {rows.map((h) => {
                    const i = index++;
                    return (
                      <button
                        key={h.id}
                        id={`h-${h.kind}-${h.id}`}
                        role="option"
                        aria-selected={active === i}
                        onMouseMove={() => setActive(i)}
                        onClick={() => go(h.href)}
                        className={cn(
                          "flex min-h-9 w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-body text-fg",
                          active === i && "bg-hover",
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-fg-3" aria-hidden />
                        {h.ref && <IssueKey>{h.ref}</IssueKey>}
                        <span className="min-w-0 flex-1 truncate">{h.title}</span>
                        {h.context && <span className="hidden text-meta text-fg-3 sm:inline">{h.context}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {query.trim().length >= 2 && !pending && hits.length === 0 && !error && (
              <p className="px-2.5 py-6 text-center text-body text-fg-2">
                Nothing you can access matches “{query.trim()}”. Try a task key like DEV-12 or a different word.
              </p>
            )}
            {error && <p className="px-2.5 py-4 text-body text-danger">{error}</p>}
          </div>
          <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-meta text-fg-3 sm:flex">
            <span>↑↓ to move</span>
            <span>Enter to open</span>
            <span>Esc to close</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
