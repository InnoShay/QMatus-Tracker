import { describe, expect, it } from "vitest";
import { hashInviteToken, isWellFormedToken, newInviteToken, safeNextPath } from "@/features/auth/tokens";
import { projectProgress } from "@/features/projects/progress";
import { REQUEST_TRANSITIONS } from "@/features/requests/meta";
import { activeFilterCount, applyFilters, EMPTY_FILTERS, filtersToQuery, parseFilters, sortTasks } from "@/features/tasks/filters";
import type { Status, TaskCard } from "@/features/tasks/types";
import { isSafeHttpUrl } from "@/components/ui/rich-text";
import { addDays, daysBetween, dueState, formatDueDate, todayIn } from "@/lib/dates";
import { mapDbError, NOT_AVAILABLE } from "@/lib/errors";
import { canCommentTeam, canIssueGrantTo, canReadTeam, canTriageRequests, canWriteTeam } from "@/server/policies";
import type { TeamAccess, Viewer, ViewerTeam } from "@/server/auth/viewer";

const statuses: Status[] = [
  { id: "s-backlog", key: "backlog", label: "Backlog", category: "backlog", position: 1 },
  { id: "s-ready", key: "ready", label: "Ready", category: "unstarted", position: 2 },
  { id: "s-prog", key: "in_progress", label: "In Progress", category: "started", position: 3 },
  { id: "s-done", key: "done", label: "Done", category: "completed", position: 5 },
  { id: "s-cancel", key: "canceled", label: "Canceled", category: "canceled", position: 6 },
];

function task(over: Partial<TaskCard>): TaskCard {
  return {
    id: crypto.randomUUID(),
    key: "DEV-1",
    title: "Task",
    statusId: "s-backlog",
    priority: "none",
    type: "task",
    assigneeId: null,
    dueDate: null,
    blocked: false,
    blockedReason: null,
    openBlockers: 0,
    rank: 1024,
    version: 1,
    projectId: null,
    milestoneId: null,
    parentId: null,
    labels: [],
    commentCount: 0,
    completedAt: null,
    updatedAt: "2026-10-01T00:00:00Z",
    createdAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

describe("dates", () => {
  it("computes whole days across DST and month boundaries", () => {
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("classifies due dates", () => {
    expect(dueState("2026-10-15", "2026-10-16")).toBe("overdue");
    expect(dueState("2026-10-16", "2026-10-16")).toBe("today");
    expect(dueState("2026-10-19", "2026-10-16")).toBe("soon");
    expect(dueState("2026-10-30", "2026-10-16")).toBe("later");
  });
  it("formats relative due labels", () => {
    expect(formatDueDate("2026-10-17", "2026-10-16")).toBe("Tomorrow");
    expect(formatDueDate("2026-10-15", "2026-10-16")).toBe("Yesterday");
    expect(formatDueDate("2027-01-05", "2026-10-16")).toBe("Jan 5, 2027");
  });
  it("resolves today in the viewer's zone, not the server's", () => {
    const instant = new Date("2026-10-16T22:30:00Z");
    expect(todayIn("UTC", instant)).toBe("2026-10-16");
    expect(todayIn("Asia/Kolkata", instant)).toBe("2026-10-17");
    expect(todayIn("Not/AZone", instant)).toBe("2026-10-16");
  });
});

describe("task filters (shared by board and list)", () => {
  const ctx = { viewerId: "me", today: "2026-10-16", statuses };
  const tasks = [
    task({ key: "DEV-1", title: "Auth tests", assigneeId: "me", priority: "high", dueDate: "2026-10-10" }),
    task({ key: "DEV-2", title: "Docs", assigneeId: null, blocked: true, statusId: "s-prog" }),
    task({ key: "DEV-3", title: "Shipped", statusId: "s-done", assigneeId: "other", dueDate: "2026-10-01" }),
  ];
  it("round-trips through the URL", () => {
    const f = { ...EMPTY_FILTERS, q: "auth", assignee: "me", blocked: true, showDone: false };
    expect(parseFilters(filtersToQuery(f))).toEqual(f);
    expect(activeFilterCount(f)).toBe(4);
  });
  it("ignores unknown values instead of trusting them", () => {
    expect(parseFilters({ priority: "critical", due: "yesterday" })).toMatchObject({ priority: "", due: "" });
  });
  it("filters by text, assignee, blocked, done and overdue", () => {
    const keys = (f: Partial<typeof EMPTY_FILTERS>) => applyFilters(tasks, { ...EMPTY_FILTERS, ...f }, ctx).map((t) => t.key);
    expect(keys({ q: "auth" })).toEqual(["DEV-1"]);
    expect(keys({ q: "dev-2" })).toEqual(["DEV-2"]);
    expect(keys({ assignee: "me" })).toEqual(["DEV-1"]);
    expect(keys({ assignee: "none" })).toEqual(["DEV-2"]);
    expect(keys({ blocked: true })).toEqual(["DEV-2"]);
    expect(keys({ showDone: false })).toEqual(["DEV-1", "DEV-2"]);
    // Completed work is never "overdue".
    expect(keys({ due: "overdue" })).toEqual(["DEV-1"]);
  });
  it("sorts by priority and puts missing due dates last in both directions", () => {
    const a = task({ key: "DEV-10", priority: "low", dueDate: null, rank: 1 });
    const b = task({ key: "DEV-11", priority: "urgent", dueDate: "2026-11-01", rank: 2 });
    const c = task({ key: "DEV-12", priority: "medium", dueDate: "2026-10-20", rank: 3 });
    expect(sortTasks([a, b, c], "priority", "asc", statuses).map((t) => t.key)).toEqual(["DEV-11", "DEV-12", "DEV-10"]);
    expect(sortTasks([a, b, c], "due", "asc", statuses).map((t) => t.key)).toEqual(["DEV-12", "DEV-11", "DEV-10"]);
    expect(sortTasks([a, b, c], "due", "desc", statuses).map((t) => t.key)).toEqual(["DEV-11", "DEV-12", "DEV-10"]);
    expect(sortTasks([a, b, c], "key", "desc", statuses).map((t) => t.key)).toEqual(["DEV-12", "DEV-11", "DEV-10"]);
  });
});

describe("project progress rule", () => {
  it("handles zero eligible tasks without a fake percentage", () => {
    expect(projectProgress([])).toEqual({ done: 0, total: 0, percent: null });
    expect(projectProgress([{ statusCategory: "canceled" }])).toEqual({ done: 0, total: 0, percent: null });
  });
  it("excludes canceled and archived tasks", () => {
    expect(
      projectProgress([
        { statusCategory: "completed" },
        { statusCategory: "started" },
        { statusCategory: "canceled" },
        { statusCategory: "completed", archived: true },
      ]),
    ).toEqual({ done: 1, total: 2, percent: 50 });
  });
});

describe("policy helpers mirror the database", () => {
  const team = (access: TeamAccess): ViewerTeam => ({
    id: "t",
    slug: "dev",
    name: "Dev",
    prefix: "DEV",
    description: null,
    acceptsRequests: true,
    wipLimit: null,
    access,
    grantExpiresAt: null,
  });
  it("orders capabilities and denies by default", () => {
    expect([canReadTeam(team("summary")), canReadTeam(team("workspace_read")), canReadTeam(null)]).toEqual([false, true, false]);
    expect([canCommentTeam(team("workspace_read")), canCommentTeam(team("collaboration"))]).toEqual([false, true]);
    expect([canWriteTeam(team("collaboration")), canWriteTeam(team("edit")), canWriteTeam(team("member"))]).toEqual([false, true, true]);
    // Grants never confer triage.
    expect([canTriageRequests(team("edit")), canTriageRequests(team("member"))]).toEqual([false, true]);
  });
  it("never allows self-grants, even for owners", () => {
    const viewer = { id: "me", org: { role: "owner" } } as Viewer;
    expect(canIssueGrantTo(viewer, "me")).toBe(false);
    expect(canIssueGrantTo(viewer, "someone")).toBe(true);
    expect(canIssueGrantTo({ id: "me", org: { role: "member" } } as Viewer, "someone")).toBe(false);
  });
});

describe("request lifecycle table", () => {
  it("has terminal declined/closed states that only reopen into triage", () => {
    expect(REQUEST_TRANSITIONS.declined).toEqual(["in_triage"]);
    expect(REQUEST_TRANSITIONS.closed).toEqual(["in_triage"]);
    expect(REQUEST_TRANSITIONS.draft).toEqual([]);
    expect(REQUEST_TRANSITIONS.submitted).not.toContain("accepted");
  });
});

describe("security helpers", () => {
  it("only accepts same-origin relative redirect targets", () => {
    expect(safeNextPath("/t/dev/board")).toBe("/t/dev/board");
    expect(safeNextPath("//evil.example")).toBe("/my-work");
    expect(safeNextPath("/\\evil.example")).toBe("/my-work");
    expect(safeNextPath("https://evil.example")).toBe("/my-work");
    expect(safeNextPath(undefined)).toBe("/my-work");
  });
  it("linkifies only http(s) URLs", () => {
    expect(isSafeHttpUrl("https://example.com/a")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,hi")).toBe(false);
  });
  it("issues 256-bit invite tokens and stores only a hash", () => {
    const { token, hash } = newInviteToken();
    expect(isWellFormedToken(token)).toBe(true);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashInviteToken(token));
    expect(hash).not.toContain(token);
    expect(isWellFormedToken("short")).toBe(false);
  });
  it("maps database errors to non-revealing messages", () => {
    expect(mapDbError({ code: "42501", message: "permission denied for table tasks" }).message).toBe(NOT_AVAILABLE);
    expect(mapDbError({ code: "P0002", message: "not found" }).message).toBe(NOT_AVAILABLE);
    expect(mapDbError({ code: "40001", message: "this task changed since you loaded it" })).toMatchObject({ code: "conflict" });
    expect(mapDbError({ code: "XX000", message: "internal stack" }).message).not.toContain("stack");
    expect(mapDbError({ code: "23514", message: 'new row violates check constraint "x"' }).message).not.toContain("violates");
  });
});
