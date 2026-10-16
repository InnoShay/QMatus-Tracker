"use client";

import { Kanban, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import { Popover } from "radix-ui";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { Select } from "@/components/ui/field";
import { PRIORITIES } from "../meta";
import { activeFilterCount, filtersToQuery, type TaskFilters } from "../filters";
import type { Label, Member, ProjectRef } from "../types";

const chip =
  "h-8 w-auto min-w-0 max-w-44 border-line-strong text-label pointer-coarse:h-10 data-[active=true]:border-accent data-[active=true]:bg-accent-soft";

/**
 * Filter state lives in the URL, so Board and List share it, links are
 * bookmarkable, and switching views keeps the same filters.
 */
export function TaskToolbar({
  teamSlug,
  view,
  filters,
  members,
  labels,
  projects,
  total,
  shown,
}: {
  teamSlug: string;
  view: "board" | "list";
  filters: TaskFilters;
  members: Member[];
  labels: Label[];
  projects: ProjectRef[];
  total: number;
  shown: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(filters.q);
  const [prevQ, setPrevQ] = useState(filters.q);
  if (filters.q !== prevQ) {
    setPrevQ(filters.q);
    setQ(filters.q);
  }

  const push = (next: Partial<TaskFilters>) => {
    const merged = { ...filters, ...next };
    const sp = new URLSearchParams(filtersToQuery(merged));
    for (const keep of ["sort", "dir"]) {
      const v = searchParams.get(keep);
      if (v) sp.set(keep, v);
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => push({ q }), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce only on typed query
  }, [q]);

  const viewHref = (target: "board" | "list") => {
    const qs = new URLSearchParams(filtersToQuery(filters)).toString();
    return `/t/${teamSlug}/${target}${qs ? `?${qs}` : ""}`;
  };

  const count = activeFilterCount(filters);
  const secondary = [filters.priority, filters.label, filters.project, filters.due, filters.blocked, !filters.showDone].filter(
    Boolean,
  ).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="View" className="inline-flex rounded-sm border border-line-strong bg-subtle p-0.5">
          {(["board", "list"] as const).map((v) => {
            const Icon = v === "board" ? Kanban : Rows3;
            return (
              <Link
                key={v}
                href={viewHref(v)}
                aria-current={view === v ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-xs px-2.5 text-label pointer-coarse:h-9",
                  view === v ? "bg-surface font-medium text-fg shadow-raised" : "text-fg-2 hover:text-fg",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {v === "board" ? "Board" : "List"}
              </Link>
            );
          })}
        </div>

        <label className="relative flex min-w-0 flex-1 basis-40 sm:max-w-64">
          <span className="sr-only">Filter by title or key</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by title or key"
            className="h-8 w-full rounded-sm border border-line-strong bg-surface pr-2 pl-8 text-label text-fg placeholder:text-fg-3 focus-visible:outline-2 focus-visible:outline-focus pointer-coarse:h-10"
          />
        </label>

        <Select
          aria-label="Assignee"
          value={filters.assignee}
          data-active={!!filters.assignee}
          onChange={(e) => push({ assignee: e.target.value })}
          className={chip}
        >
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {members
            .filter((m) => m.active)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </Select>

        {/* One place for every other filter (spec §10.4). */}
        <Popover.Root>
          <Popover.Trigger
            className={cn(
              "qm-press inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-label pointer-coarse:h-10",
              secondary ? "border-accent bg-accent-soft text-fg" : "border-line-strong bg-surface text-fg-2 hover:text-fg",
            )}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Filters
            {secondary > 0 && (
              <span className="tabular rounded-xs bg-accent px-1 text-meta font-medium text-action-fg">
                {secondary}
                <span className="sr-only"> active</span>
              </span>
            )}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              collisionPadding={12}
              className="qm-popover z-50 flex w-72 flex-col gap-3 rounded-md border border-line-strong bg-surface p-3 shadow-float"
            >
              <FilterSelect label="Priority" value={filters.priority} onChange={(v) => push({ priority: v as TaskFilters["priority"] })}>
                <option value="">Any priority</option>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </FilterSelect>
              {labels.length > 0 && (
                <FilterSelect label="Label" value={filters.label} onChange={(v) => push({ label: v })}>
                  <option value="">Any label</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </FilterSelect>
              )}
              {projects.length > 0 && (
                <FilterSelect label="Project" value={filters.project} onChange={(v) => push({ project: v })}>
                  <option value="">Any project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </FilterSelect>
              )}
              <FilterSelect label="Due" value={filters.due} onChange={(v) => push({ due: v as TaskFilters["due"] })}>
                <option value="">Any due date</option>
                <option value="overdue">Overdue</option>
                <option value="week">Due within 7 days</option>
              </FilterSelect>
              <label className="flex items-center gap-2 text-body text-fg">
                <input
                  type="checkbox"
                  checked={filters.blocked}
                  onChange={(e) => push({ blocked: e.target.checked })}
                  className="size-4 accent-[var(--accent)]"
                />
                Blocked only
              </label>
              <label className="flex items-center gap-2 text-body text-fg">
                <input
                  type="checkbox"
                  checked={!filters.showDone}
                  onChange={(e) => push({ showDone: !e.target.checked })}
                  className="size-4 accent-[var(--accent)]"
                />
                Hide done and canceled
              </label>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {count > 0 && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              router.replace(pathname, { scroll: false });
            }}
            className="inline-flex h-8 items-center gap-1 rounded-sm px-2 text-label font-medium text-accent hover:bg-hover pointer-coarse:h-10"
          >
            <X className="size-3.5" aria-hidden /> Clear filters
          </button>
        )}
        <p className="ml-auto text-meta text-fg-3 tabular" aria-live="polite">
          {count > 0 ? `${shown} of ${total} tasks` : `${total} tasks`}
        </p>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label font-medium text-fg-2">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-label pointer-coarse:h-10">
        {children}
      </Select>
    </label>
  );
}
