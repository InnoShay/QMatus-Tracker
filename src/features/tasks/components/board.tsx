"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical, Plus, TriangleAlert } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useId, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { StatusIcon } from "@/components/ui/badges";
import { cn } from "@/components/ui/cn";
import { usePrefersReducedMotion } from "@/components/ui/use-reduced-motion";
import { toast } from "@/components/ui/toast";
import { createTask, moveTask, updateTask } from "../actions";
import type { Member, Status, TaskCard, Transition } from "../types";
import { TaskActionsMenu } from "./task-actions-menu";
import { TaskCardView } from "./task-card";

type Props = {
  teamSlug: string;
  statuses: Status[];
  transitions: Transition[];
  members: Member[];
  tasks: TaskCard[];
  allTasks: TaskCard[];
  canWrite: boolean;
  viewerId: string;
  today: string;
  wipLimit: number | null;
};

const DONE_PREVIEW = 20;

export function Board({ teamSlug, statuses, transitions, members, tasks, allTasks, canWrite, viewerId, today, wipLimit }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(tasks);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCanceled, setShowCanceled] = useState(false);
  const [expandedDone, setExpandedDone] = useState(false);
  const [mobileStatus, setMobileStatus] = useState<string>(() => statuses.find((s) => s.key === "in_progress")?.id ?? statuses[0]?.id);
  const [, startTransition] = useTransition();
  const liveRef = useRef<HTMLParagraphElement>(null);
  const dndId = useId(); // stable across server/client render (avoids a hydration mismatch)
  const reducedMotion = usePrefersReducedMotion();

  // Server state wins whenever fresh props arrive (after any confirmed write).
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setItems(tasks);
  }

  const memberName = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const allowedFrom = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const t of transitions) {
      if (!m.has(t.from)) m.set(t.from, new Set());
      m.get(t.from)!.add(t.to);
    }
    return m;
  }, [transitions]);
  const subtaskCounts = useMemo(() => {
    const done = new Set(statuses.filter((s) => s.category === "completed").map((s) => s.id));
    const m = new Map<string, { done: number; total: number }>();
    for (const t of allTasks) {
      if (!t.parentId) continue;
      const c = m.get(t.parentId) ?? { done: 0, total: 0 };
      c.total += 1;
      if (done.has(t.statusId)) c.done += 1;
      m.set(t.parentId, c);
    }
    return m;
  }, [allTasks, statuses]);

  const columns = useMemo(
    () =>
      statuses.map((s) => ({
        status: s,
        tasks: items.filter((t) => t.statusId === s.id).sort((a, b) => a.rank - b.rank),
      })),
    [items, statuses],
  );

  // Left/Right jump to the neighbouring visible column; Up/Down reorder within it.
  const columnOrder = useRef<string[]>([]);
  const itemsRef = useRef(items);
  const [coordinateGetter] = useState(() => {
    const getter: KeyboardCoordinateGetter = (event, args) => {
      if (event.code === "ArrowRight" || event.code === "ArrowLeft") {
        const { over, active, droppableRects } = args.context;
        const overId = over ? String(over.id) : String(active ?? "");
        const current = overId.startsWith("col:") ? overId.slice(4) : itemsRef.current.find((t) => t.id === overId)?.statusId;
        const order = columnOrder.current;
        const next = order[order.indexOf(current ?? "") + (event.code === "ArrowRight" ? 1 : -1)];
        const rect = next ? droppableRects.get(`col:${next}`) : undefined;
        if (!rect) return undefined;
        event.preventDefault();
        return { x: rect.left + 12, y: rect.top + 48 };
      }
      return sortableKeyboardCoordinates(event, args);
    };
    return getter;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Long-press on touch so vertical/horizontal scrolling is never hijacked.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

  const hrefFor = (key: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("task", key);
    return `${pathname}?${sp.toString()}`;
  };

  const announce = (msg: string) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const isAllowed = (fromStatus: string, toStatus: string) => fromStatus === toStatus || !!allowedFrom.get(fromStatus)?.has(toStatus);

  /** Optimistic move with rollback. Success is only claimed after the server confirms. */
  function persistMove(task: TaskCard, toStatus: string, after: string | null, before: string | null, nextItems: TaskCard[]) {
    const snapshot = items;
    setItems(nextItems);
    setSaving((s) => new Set(s).add(task.id));
    startTransition(async () => {
      const res = await moveTask({
        taskId: task.id,
        statusId: toStatus,
        version: task.version,
        afterId: after,
        beforeId: before,
      });
      setSaving((s) => {
        const n = new Set(s);
        n.delete(task.id);
        return n;
      });
      if (!res.ok) {
        setItems(snapshot);
        toast(res.error.message, "error");
        announce(`${task.key} could not be moved. It is back in ${statusById.get(task.statusId)?.label}.`);
        return;
      }
      setItems((cur) => cur.map((t) => (t.id === task.id ? { ...t, version: res.data.version } : t)));
      const label = statusById.get(toStatus)?.label;
      announce(`${task.key} saved in ${label}.`);
      if (toStatus !== task.statusId) toast(`${task.key} moved to ${label}.`);
    });
  }

  function moveToEnd(task: TaskCard, toStatus: string) {
    if (!isAllowed(task.statusId, toStatus)) {
      toast(`${task.key} can't move from ${statusById.get(task.statusId)?.label} to ${statusById.get(toStatus)?.label}.`, "error");
      return;
    }
    const col = items.filter((t) => t.statusId === toStatus && t.id !== task.id).sort((a, b) => a.rank - b.rank);
    const last = col.at(-1);
    const next = items.map((t) => (t.id === task.id ? { ...t, statusId: toStatus, rank: (last?.rank ?? 0) + 1024 } : t));
    persistMove(task, toStatus, last?.id ?? null, null, next);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  // A pointer drag must not also count as a click on the card link it started on.
  const justDragged = useRef(false);
  const guardClick = (e: React.MouseEvent) => {
    if (justDragged.current) e.preventDefault();
  };

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 250);
    const task = items.find((t) => t.id === e.active.id);
    if (!task || !e.over) return;
    const overId = String(e.over.id);
    const overTask = items.find((t) => t.id === overId);
    const toStatus = overId.startsWith("col:") ? overId.slice(4) : overTask?.statusId;
    if (!toStatus) return;
    if (!isAllowed(task.statusId, toStatus)) {
      toast(`${task.key} can't move from ${statusById.get(task.statusId)?.label} to ${statusById.get(toStatus)?.label}.`, "error");
      return;
    }
    const col = items.filter((t) => t.statusId === toStatus && t.id !== task.id).sort((a, b) => a.rank - b.rank);
    let index = overTask ? col.findIndex((t) => t.id === overTask.id) : col.length;
    if (overTask && overTask.statusId === task.statusId) {
      // Moving down within the same column lands after the hovered card.
      const original = items.filter((t) => t.statusId === toStatus).sort((a, b) => a.rank - b.rank);
      if (original.findIndex((t) => t.id === task.id) < original.findIndex((t) => t.id === overTask.id)) index += 1;
    }
    if (index < 0) index = col.length;
    const after = col[index - 1] ?? null;
    const before = col[index] ?? null;
    if (toStatus === task.statusId && (after?.id ?? null) === prevId(task) && (before?.id ?? null) === nextId(task)) return;
    const rank = after && before ? (after.rank + before.rank) / 2 : after ? after.rank + 1024 : before ? before.rank - 1024 : 1024;
    const next = items.map((t) => (t.id === task.id ? { ...t, statusId: toStatus, rank } : t));
    persistMove(task, toStatus, after?.id ?? null, before?.id ?? null, next);
  }

  const prevId = (task: TaskCard) => {
    const col = items.filter((t) => t.statusId === task.statusId).sort((a, b) => a.rank - b.rank);
    return col[col.findIndex((t) => t.id === task.id) - 1]?.id ?? null;
  };
  const nextId = (task: TaskCard) => {
    const col = items.filter((t) => t.statusId === task.statusId).sort((a, b) => a.rank - b.rank);
    return col[col.findIndex((t) => t.id === task.id) + 1]?.id ?? null;
  };

  const assignToMe = (task: TaskCard) => {
    startTransition(async () => {
      const res = await updateTask(task.id, task.version, {
        assigneeId: viewerId,
      });
      toast(res.ok ? `${task.key} is assigned to you.` : res.error.message, res.ok ? "success" : "error");
    });
  };

  const activeTask = activeId ? items.find((t) => t.id === activeId) : null;

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const t = items.find((x) => x.id === active.id);
      return t ? `Picked up ${t.key}, ${t.title}. Use arrow keys to move, space to drop, escape to cancel.` : "";
    },
    onDragOver: ({ active, over }) => {
      const t = items.find((x) => x.id === active.id);
      if (!t || !over) return "";
      const overId = String(over.id);
      const status = overId.startsWith("col:")
        ? statusById.get(overId.slice(4))
        : statusById.get(items.find((x) => x.id === overId)?.statusId ?? "");
      if (!status) return "";
      return isAllowed(t.statusId, status.id) ? `${t.key} is over ${status.label}.` : `${t.key} can't move to ${status.label}.`;
    },
    onDragEnd: ({ active, over }) => {
      const t = items.find((x) => x.id === active.id);
      return t && over ? `Dropped ${t.key}. Saving.` : "";
    },
    onDragCancel: ({ active }) => `Move cancelled. ${items.find((x) => x.id === active.id)?.key ?? "Task"} stayed where it was.`,
  };

  const renderCard = (task: TaskCard, opts: { draggable: boolean }) => {
    const status = statusById.get(task.statusId)!;
    const allowed = statuses.filter((s) => allowedFrom.get(task.statusId)?.has(s.id));
    const done = status.category === "completed" || status.category === "canceled";
    const card = (handle?: React.ReactNode) => (
      <TaskCardView
        handle={handle}
        onLinkClick={guardClick}
        task={task}
        href={hrefFor(task.key)}
        assigneeName={task.assigneeId ? (memberName.get(task.assigneeId) ?? null) : null}
        today={today}
        done={done}
        subtasks={subtaskCounts.get(task.id)}
        saving={saving.has(task.id)}
        menu={
          <TaskActionsMenu
            taskKey={task.key}
            title={task.title}
            href={hrefFor(task.key)}
            currentStatus={status}
            allowed={allowed}
            canWrite={canWrite}
            disabled={saving.has(task.id)}
            onMove={(to) => moveToEnd(task, to)}
            onAssignToMe={task.assigneeId === viewerId ? undefined : () => assignToMe(task)}
          />
        }
      />
    );
    return opts.draggable && canWrite ? (
      <SortableCard
        key={task.id}
        id={task.id}
        label={`${task.key}: ${task.title}`}
        disabled={saving.has(task.id)}
        reducedMotion={reducedMotion}
      >
        {(handle) => card(handle)}
      </SortableCard>
    ) : (
      <li key={task.id}>{card()}</li>
    );
  };

  const visibleColumns = columns.filter((c) => c.status.category !== "canceled" || showCanceled);
  useLayoutEffect(() => {
    itemsRef.current = items;
    columnOrder.current = visibleColumns.map((c) => c.status.id);
  });
  const canceled = columns.find((c) => c.status.category === "canceled");
  const activeStatus = activeTask?.statusId ?? null;

  return (
    <>
      <p ref={liveRef} aria-live="polite" className="sr-only" />

      {/* Mobile: one status at a time, chosen explicitly (spec §7.3). */}
      <div className="md:hidden">
        <div role="tablist" aria-label="Status" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-3">
          {columns.map(({ status, tasks: colTasks }) => (
            <button
              key={status.id}
              role="tab"
              type="button"
              aria-selected={mobileStatus === status.id}
              onClick={() => setMobileStatus(status.id)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-sm border px-3 text-label",
                mobileStatus === status.id ? "border-accent bg-accent-soft text-fg" : "border-line-strong bg-surface text-fg-2",
              )}
            >
              <StatusIcon statusKey={status.key} />
              {status.label}
              <span className="tabular text-fg-3">{colTasks.length}</span>
            </button>
          ))}
        </div>
        {columns
          .filter((c) => c.status.id === mobileStatus)
          .map(({ status, tasks: colTasks }) => (
            <div key={status.id} role="tabpanel" aria-label={status.label}>
              {colTasks.length === 0 ? (
                <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-body text-fg-2">{emptyCopy(status.key)}</p>
              ) : (
                <ul className="flex flex-col gap-2">{colTasks.map((t) => renderCard(t, { draggable: false }))}</ul>
              )}
              {canWrite && <InlineCreate teamSlug={teamSlug} status={status} />}
            </div>
          ))}
      </div>

      {/* Desktop/tablet: horizontally scrolling columns in their own scroll region. */}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "To move a task, press space or enter, use the arrow keys, then press space again to drop. Or use the task's actions menu.",
          },
        }}
      >
        <div
          role="region"
          aria-label="Board columns. Scroll horizontally to see all statuses."
          tabIndex={0}
          className="hidden min-h-0 flex-1 overflow-x-auto overscroll-x-contain pb-4 md:block"
        >
          <div className="flex min-h-full w-max items-start gap-3">
            {visibleColumns.map(({ status, tasks: colTasks }) => {
              const isDone = status.category === "completed";
              const shown = isDone && !expandedDone ? colTasks.slice(0, DONE_PREVIEW) : colTasks;
              const overLimit = status.key === "in_progress" && wipLimit !== null && colTasks.length > wipLimit;
              const dropState = activeStatus === null ? "idle" : isAllowed(activeStatus, status.id) ? "allowed" : "blocked";
              return (
                <Column key={status.id} status={status} dropState={dropState}>
                  <div className="flex h-9 items-center gap-2 px-1">
                    <StatusIcon statusKey={status.key} />
                    <h2 className="text-label font-semibold text-fg">{status.label}</h2>
                    <span className="tabular text-label text-fg-3">{colTasks.length}</span>
                    {status.key === "in_progress" && wipLimit !== null && (
                      <span
                        className={cn(
                          "ml-auto inline-flex items-center gap-1 text-meta tabular",
                          overLimit ? "font-medium text-warning" : "text-fg-3",
                        )}
                        title="Work-in-progress limit. A warning only; nothing is blocked."
                      >
                        {overLimit && <TriangleAlert className="size-3.5" aria-hidden />}
                        {overLimit ? `Over limit of ${wipLimit}` : `Limit ${wipLimit}`}
                      </span>
                    )}
                    {dropState === "blocked" && <span className="ml-auto text-meta text-fg-3">Not allowed</span>}
                  </div>
                  <SortableContext items={shown.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <ul className="flex min-h-16 flex-col gap-2" aria-label={`${status.label} tasks`}>
                      {shown.map((t) => renderCard(t, { draggable: true }))}
                      {colTasks.length === 0 && <li className="px-1 py-2 text-label text-fg-3">{emptyCopy(status.key)}</li>}
                    </ul>
                  </SortableContext>
                  {isDone && colTasks.length > DONE_PREVIEW && (
                    <button
                      type="button"
                      onClick={() => setExpandedDone((v) => !v)}
                      className="mt-2 h-8 rounded-sm px-2 text-left text-label text-fg-2 hover:bg-hover"
                    >
                      {expandedDone ? "Show fewer" : `Show ${colTasks.length - DONE_PREVIEW} more`}
                    </button>
                  )}
                  {canWrite && !isDone && status.category !== "canceled" && <InlineCreate teamSlug={teamSlug} status={status} />}
                </Column>
              );
            })}
            {canceled && !showCanceled && (
              <button
                type="button"
                onClick={() => setShowCanceled(true)}
                className="flex h-9 w-36 shrink-0 items-center gap-1.5 rounded-md border border-dashed border-line-strong px-3 text-label text-fg-2 hover:bg-hover"
                aria-label={`Show Canceled column, ${canceled.tasks.length} tasks`}
              >
                <ChevronRight className="size-4" aria-hidden />
                Canceled <span className="tabular text-fg-3">{canceled.tasks.length}</span>
              </button>
            )}
          </div>
        </div>
        <DragOverlay dropAnimation={reducedMotion ? null : { duration: 150, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
          {activeTask ? (
            <div className="w-[272px]">
              <TaskCardView
                task={activeTask}
                href="#"
                assigneeName={activeTask.assigneeId ? (memberName.get(activeTask.assigneeId) ?? null) : null}
                today={today}
                done={false}
                dragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function emptyCopy(key: string) {
  switch (key) {
    case "backlog":
      return "Ideas and requests that aren't ready yet.";
    case "ready":
      return "Nothing ready to pick up.";
    case "in_progress":
      return "Nothing in progress.";
    case "in_review":
      return "Nothing waiting for review.";
    case "done":
      return "Finished work shows up here.";
    default:
      return "No tasks.";
  }
}

function Column({ status, dropState, children }: { status: Status; dropState: "idle" | "allowed" | "blocked"; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status.id}` });
  return (
    <section
      ref={setNodeRef}
      aria-label={status.label}
      className={cn(
        "flex w-[288px] shrink-0 flex-col rounded-xl border p-2 transition-[background-color,border-color,opacity] duration-[120ms]",
        dropState === "blocked" ? "border-line bg-rail opacity-60" : "border-line bg-rail",
        dropState === "allowed" && isOver && "border-accent bg-accent-soft",
      )}
    >
      {children}
    </section>
  );
}

function SortableCard({
  id,
  label,
  disabled,
  reducedMotion,
  children,
}: {
  id: string;
  label: string;
  disabled: boolean;
  reducedMotion: boolean;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    // Neighbours make room with the product's ease-out; nothing slides under reduced motion.
    transition: reducedMotion ? null : { duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  });
  // Pointer/touch drag from anywhere on the card; keyboard drag only from the
  // labelled handle, so Enter on the card link still opens the task.
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler<HTMLButtonElement> | undefined}
      aria-label={`Move ${label}`}
      className="absolute top-2 -left-px z-10 grid h-6 w-3.5 cursor-grab place-items-center rounded-r-xs text-fg-3 opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 hover:bg-hover hover:text-fg focus-visible:opacity-100 pointer-coarse:hidden"
    >
      <GripVertical className="size-3.5" aria-hidden />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
      onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLLIElement> | undefined}
      onTouchStart={listeners?.onTouchStart as React.TouchEventHandler<HTMLLIElement> | undefined}
    >
      {children(handle)}
    </li>
  );
}

function InlineCreate({ teamSlug, status }: { teamSlug: string; status: Status }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const value = title.trim();
    if (!value) return;
    startTransition(async () => {
      const res = await createTask({
        teamSlug,
        title: value,
        statusId: status.id,
      });
      if (res.ok) {
        setTitle("");
        toast(`${res.data.key} created in ${status.label}.`);
        inputRef.current?.focus();
      } else {
        toast(res.error.message, "error");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex h-8 items-center gap-1.5 rounded-sm px-2 text-label text-fg-3 hover:bg-hover hover:text-fg pointer-coarse:h-10"
      >
        <Plus className="size-4" aria-hidden /> Add task
      </button>
    );
  }
  return (
    <form
      className="mt-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="sr-only" htmlFor={`new-${status.id}`}>
        New task title in {status.label}
      </label>
      <input
        id={`new-${status.id}`}
        ref={inputRef}
        autoFocus
        value={title}
        maxLength={200}
        disabled={pending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        placeholder="Task title, then Enter"
        className="h-9 w-full rounded-sm border border-control bg-surface px-2.5 text-body text-fg placeholder:text-fg-3 focus-visible:outline-2 focus-visible:outline-focus"
      />
      <p className="mt-1 px-0.5 text-meta text-fg-3">{pending ? "Creating…" : "Enter to add · Esc to cancel"}</p>
    </form>
  );
}
