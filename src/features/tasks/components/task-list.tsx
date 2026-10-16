"use client";

import { RelativeTime } from "@/components/ui/relative-time";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { BlockedBadge, IssueKey, PriorityMark, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { bulkUpdateTasks } from "../bulk-actions";
import { sortTasks, type SortKey } from "../filters";
import { PRIORITIES } from "../meta";
import type { Member, Status, TaskCard } from "../types";
import { DueCue } from "./task-card";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "key", label: "Key", className: "w-24" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status", className: "w-36" },
  { key: "priority", label: "Priority", className: "w-28" },
  { key: "due", label: "Due", className: "w-32" },
  { key: "updated", label: "Updated", className: "w-28" },
];

export function TaskList({
  tasks,
  statuses,
  members,
  canWrite,
  today,
  timezone,
  sort,
  dir,
}: {
  tasks: TaskCard[];
  statuses: Status[];
  members: Member[];
  canWrite: boolean;
  today: string;
  timezone: string;
  sort: SortKey;
  dir: "asc" | "desc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const memberName = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const rows = useMemo(() => sortTasks(tasks, sort, dir, statuses), [tasks, sort, dir, statuses]);

  const hrefFor = (key: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("task", key);
    return `${pathname}?${sp.toString()}`;
  };

  const setSort = (key: SortKey) => {
    const sp = new URLSearchParams(searchParams.toString());
    const nextDir = sort === key && dir === "asc" ? "desc" : "asc";
    sp.set("sort", key);
    sp.set("dir", nextDir);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const runBulk = (op: Parameters<typeof bulkUpdateTasks>[0]["op"]) => {
    const items = rows.filter((r) => selected.has(r.id)).map((r) => ({ id: r.id, key: r.key, version: r.version }));
    startTransition(async () => {
      const res = await bulkUpdateTasks({ items, op });
      if (!res.ok) return toast(res.error.message, "error");
      const { succeeded, failed } = res.data;
      if (failed.length === 0) toast(`Updated ${succeeded.length} task${succeeded.length === 1 ? "" : "s"}.`);
      else
        toast(
          `Updated ${succeeded.length}, ${failed.length} not changed: ${failed
            .slice(0, 3)
            .map((f) => `${f.key} (${f.reason.replace(/\.$/, "")})`)
            .join("; ")}${failed.length > 3 ? "…" : ""}`,
          "error",
        );
      setSelected(new Set(failed.length ? rows.filter((r) => failed.some((f) => f.key === r.key)).map((r) => r.id) : []));
    });
  };

  return (
    <div className="flex flex-col gap-2 pb-6">
      {canWrite && selected.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-2 shadow-float"
        >
          <span className="text-label font-medium text-fg">{selected.size} selected</span>
          <Select
            aria-label="Move selected to status"
            value=""
            disabled={pending}
            onChange={(e) => e.target.value && runBulk({ kind: "status", statusId: e.target.value })}
            className="h-8 w-auto text-label"
          >
            <option value="">Move to…</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Assign selected to"
            value="__"
            disabled={pending}
            onChange={(e) => e.target.value !== "__" && runBulk({ kind: "assignee", assigneeId: e.target.value || null })}
            className="h-8 w-auto text-label"
          >
            <option value="__">Assign to…</option>
            <option value="">Unassigned</option>
            {members
              .filter((m) => m.active)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
          <Select
            aria-label="Set priority of selected"
            value=""
            disabled={pending}
            onChange={(e) => e.target.value && runBulk({ kind: "priority", priority: e.target.value as never })}
            className="h-8 w-auto text-label"
          >
            <option value="">Priority…</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="quiet" onClick={() => setSelected(new Set())} className="ml-auto">
            Clear selection
          </Button>
          {pending && (
            <span role="status" className="text-meta text-fg-3">
              Updating…
            </span>
          )}
        </div>
      )}

      {/* Desktop/tablet: a real table. */}
      <div className="relative hidden overflow-x-auto rounded-xl border border-line bg-surface shadow-panel md:block">
        <table className="w-full border-collapse text-body">
          <caption className="sr-only">Tasks. Column headers sort the list.</caption>
          <thead>
            <tr className="border-b border-line text-left">
              {canWrite && (
                <th scope="col" className="w-10 px-3">
                  <input
                    type="checkbox"
                    aria-label="Select all tasks shown"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="size-4 accent-[var(--accent)]"
                  />
                </th>
              )}
              {COLUMNS.map((c) => {
                const active = sort === c.key;
                const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                    className={cn("h-10 px-3 font-normal", c.className)}
                  >
                    <button
                      type="button"
                      onClick={() => setSort(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-xs text-label",
                        active ? "font-medium text-fg" : "text-fg-3 hover:text-fg",
                      )}
                    >
                      {c.label}
                      <Icon className="size-3.5" aria-hidden />
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="w-36 px-3 text-left text-label font-normal text-fg-3">
                Assignee
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const s = statusById.get(t.statusId)!;
              const done = s.category === "completed" || s.category === "canceled";
              return (
                <tr key={t.id} className={cn("border-b border-line last:border-b-0 hover:bg-hover", selected.has(t.id) && "bg-selected")}>
                  {canWrite && (
                    <td className="px-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${t.key}: ${t.title}`}
                        checked={selected.has(t.id)}
                        onChange={() => toggle(t.id)}
                        className="size-4 accent-[var(--accent)]"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2.5 align-top whitespace-nowrap">
                    <IssueKey>{t.key}</IssueKey>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={hrefFor(t.key)}
                        scroll={false}
                        data-task-link={t.key}
                        className={cn("font-medium hover:text-accent [overflow-wrap:anywhere]", done ? "text-fg-2" : "text-fg")}
                      >
                        {t.title}
                      </Link>
                      {t.blocked && <BlockedBadge />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge statusKey={s.key} label={s.label} />
                  </td>
                  <td className="px-3 py-2.5">
                    <PriorityMark priority={t.priority} withLabel />
                  </td>
                  <td className="px-3 py-2.5">
                    {t.dueDate ? <DueCue due={t.dueDate} today={today} done={done} /> : <span className="text-meta text-fg-3">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-meta whitespace-nowrap text-fg-3">
                    <time dateTime={t.updatedAt}>
                      <RelativeTime iso={t.updatedAt} timeZone={timezone} />
                    </time>
                  </td>
                  <td className="px-3 py-2.5">
                    {t.assigneeId ? (
                      <span className="inline-flex items-center gap-2 text-label text-fg-2">
                        <Avatar name={memberName.get(t.assigneeId) ?? "Former member"} size="sm" />
                        <span className="truncate">{memberName.get(t.assigneeId) ?? "Former member"}</span>
                      </span>
                    ) : (
                      <span className="text-meta text-fg-3">Unassigned</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked rows with the same information. */}
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel md:hidden">
        {rows.map((t) => {
          const s = statusById.get(t.statusId)!;
          const done = s.category === "completed" || s.category === "canceled";
          return (
            <li key={t.id} className="flex flex-col gap-1.5 px-3.5 py-3">
              <div className="flex items-center gap-2">
                <IssueKey>{t.key}</IssueKey>
                <StatusBadge statusKey={s.key} label={s.label} />
                {t.blocked && <BlockedBadge />}
              </div>
              <Link
                href={hrefFor(t.key)}
                scroll={false}
                data-task-link={t.key}
                className="text-body font-medium text-fg [overflow-wrap:anywhere]"
              >
                {t.title}
              </Link>
              <div className="flex items-center gap-3">
                <PriorityMark priority={t.priority} withLabel />
                {t.dueDate && <DueCue due={t.dueDate} today={today} done={done} />}
                <span className="ml-auto text-meta text-fg-2">
                  {t.assigneeId ? (memberName.get(t.assigneeId) ?? "Former member") : "Unassigned"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
