/**
 * Team isolation and role/grant semantics against the real database (RLS + SQL grants).
 * Spec §17.1–17.2. Each identity signs in through Supabase Auth; nothing here uses the
 * service role except fixture lookups in getWorld().
 */
import { beforeAll, describe, expect, it } from "vitest";
import { anon, as, getWorld, marker, serialized, type World } from "./helpers";

let w: World;
let devSecret: string;
let devTaskId: string;
let mainSecret: string;
let mainTaskId: string;

beforeAll(async () => {
  w = await getWorld();
  devSecret = marker("DEVPRIVATE");
  mainSecret = marker("MAINPRIVATE");

  const leo = await as("dev");
  const devTask = await leo
    .from("tasks")
    .insert({ team_id: w.teams.dev, title: `Rotate signing keys ${devSecret}`, assignee_id: w.ids.dev2, description: devSecret })
    .select("id")
    .single();
  expect(devTask.error).toBeNull();
  devTaskId = devTask.data!.id;
  expect((await leo.from("task_comments").insert({ task_id: devTaskId, body: `internal ${devSecret}` })).error).toBeNull();

  const rhea = await as("owner");
  const mainTask = await rhea
    .from("tasks")
    .insert({ team_id: w.teams.main, title: `Fundraising terms ${mainSecret}` })
    .select("id")
    .single();
  expect(mainTask.error).toBeNull();
  mainTaskId = mainTask.data!.id;
});

describe("anonymous visitors", () => {
  it("cannot read any workspace table", async () => {
    const db = anon();
    for (const table of ["tasks", "teams", "work_requests", "profiles", "projects", "audit_events"] as const) {
      const { data, error } = await db.from(table).select("*").limit(5);
      expect(error !== null || (data ?? []).length === 0, `${table} leaked to anon`).toBe(true);
    }
  });

  it("cannot self-register (invite-only)", async () => {
    const { data, error } = await anon().auth.signUp({ email: `walk-in-${Date.now()}@qmatus.test`, password: "a-long-enough-password" });
    expect(error ?? data.user).toBeTruthy();
    expect(error).not.toBeNull();
  });
});

describe("cross-team privacy", () => {
  it("a developer cannot read Main Team tasks by id, list or search", async () => {
    const leo = await as("dev");
    expect((await leo.from("tasks").select("id").eq("id", mainTaskId)).data).toEqual([]);
    expect((await leo.from("tasks").select("id").eq("team_id", w.teams.main)).data).toEqual([]);
    const search = await leo.rpc("search_workspace", { p_query: "Fundraising" });
    expect(serialized(search.data)).not.toContain(mainSecret);
  });

  it("a founder cannot read the Developer board, comments, activity, projects, ideas or library", async () => {
    const iris = await as("founder");
    expect((await iris.from("tasks").select("id").eq("team_id", w.teams.dev)).data).toEqual([]);
    expect((await iris.from("tasks").select("id").eq("id", devTaskId)).data).toEqual([]);
    expect((await iris.from("task_comments").select("id").eq("task_id", devTaskId)).data).toEqual([]);
    expect((await iris.from("task_activity").select("id").eq("task_id", devTaskId)).data).toEqual([]);
    expect((await iris.from("projects").select("id").eq("team_id", w.teams.dev)).data).toEqual([]);
    expect((await iris.from("parking_ideas").select("id").eq("team_id", w.teams.dev)).data).toEqual([]);
    expect((await iris.from("library_items").select("id").eq("team_id", w.teams.dev)).data).toEqual([]);
    expect((await iris.from("task_statuses").select("id").eq("team_id", w.teams.dev)).data).toEqual([]);
    expect((await iris.rpc("team_dashboard_summary", { p_team: w.teams.dev })).data).toBeNull();
    const search = await iris.rpc("search_workspace", { p_query: devSecret.slice(0, 20) });
    expect(serialized(search.data)).not.toContain(devSecret);
  });

  it("a founder's team list does not reveal the Developer Team, but intake lists it by name only", async () => {
    const iris = await as("founder");
    const teams = await iris.from("teams").select("id, slug");
    expect(teams.data!.map((t) => t.slug)).toEqual(["main"]);
    const intake = await iris.rpc("list_intake_teams");
    expect(intake.data).toEqual([{ id: w.teams.dev, name: "Developer Team", slug: "dev" }]);
  });

  it("a member of two teams reads both", async () => {
    const noor = await as("dual");
    expect((await noor.from("tasks").select("id").eq("id", devTaskId)).data).toHaveLength(1);
    expect((await noor.from("tasks").select("id").eq("id", mainTaskId)).data).toHaveLength(1);
  });
});

describe("admin power is not content access", () => {
  it("a workspace admin without membership cannot read Developer content", async () => {
    const sam = await as("admin");
    expect((await sam.from("tasks").select("id").eq("team_id", w.teams.dev)).data).toEqual([]);
    expect((await sam.from("task_comments").select("id").eq("task_id", devTaskId)).data).toEqual([]);
    expect((await sam.rpc("team_dashboard_summary", { p_team: w.teams.dev })).data).toBeNull();
    const search = await sam.rpc("search_workspace", { p_query: devSecret.slice(0, 20) });
    expect(serialized(search.data)).not.toContain(devSecret);
  });

  it("an admin cannot add themselves to a team", async () => {
    const sam = await as("admin");
    const { error } = await sam.rpc("admin_add_team_member", { p_team: w.teams.dev, p_profile: w.ids.admin, p_role: "member" });
    expect(error?.message).toMatch(/cannot add yourself/);
  });

  it("an admin cannot grant access to themselves", async () => {
    const sam = await as("admin");
    const { error } = await sam.rpc("issue_grant", {
      p_team: w.teams.dev,
      p_grantee: w.ids.admin,
      p_scope: "workspace_read",
      p_reason: "Trying to read the board myself",
    });
    expect(error?.message).toMatch(/yourself/);
  });

  it("an owner is not exempt either", async () => {
    const rhea = await as("owner");
    expect((await rhea.from("tasks").select("id").eq("id", devTaskId)).data).toEqual([]);
  });
});

describe("grants", () => {
  it("a dashboard-summary grant returns allowlisted aggregates only, never task rows", async () => {
    const marcus = await as("summaryViewer");
    const summary = await marcus.rpc("team_dashboard_summary", { p_team: w.teams.dev });
    expect(summary.error).toBeNull();
    const s = summary.data as Record<string, unknown>;
    expect(s.full_access).toBe(false);
    expect(Object.keys(s).sort()).toEqual(
      ["backlog", "blocked", "completed_14d", "full_access", "in_progress", "in_review", "overdue"].sort(),
    );
    expect(serialized(s)).not.toContain(devSecret);
    expect((await marcus.from("tasks").select("id").eq("team_id", w.teams.dev)).data).toEqual([]);
    expect((await marcus.from("projects").select("id").eq("team_id", w.teams.dev)).data).toEqual([]);
    expect((await marcus.from("task_statuses").select("id").eq("team_id", w.teams.dev)).data).toEqual([]);
  });

  it("a workspace-read grant reads the target team but cannot write, comment or reach other teams", async () => {
    const tara = await as("reader");
    expect((await tara.from("tasks").select("id").eq("id", devTaskId)).data).toHaveLength(1);
    expect((await tara.from("tasks").select("id").eq("id", mainTaskId)).data).toEqual([]);
    const insert = await tara.from("tasks").insert({ team_id: w.teams.dev, title: "Should not exist" });
    expect(insert.error).not.toBeNull();
    const update = await tara.from("tasks").update({ title: "Hijacked" }).eq("id", devTaskId).select("id");
    expect(update.data ?? []).toEqual([]);
    const comment = await tara.from("task_comments").insert({ task_id: devTaskId, body: "drive-by" });
    expect(comment.error).not.toBeNull();
    const issue = await tara.rpc("issue_grant", {
      p_team: w.teams.dev,
      p_grantee: w.ids.founder,
      p_scope: "workspace_read",
      p_reason: "Passing my access along",
    });
    expect(issue.error).not.toBeNull();
  });

  it("expired grants, removed members and suspended accounts lose access on the next request", async () => {
    for (const who of ["expired", "removed", "suspended"] as const) {
      const db = await as(who);
      expect((await db.from("tasks").select("id").eq("team_id", w.teams.dev)).data, who).toEqual([]);
      expect((await db.rpc("team_dashboard_summary", { p_team: w.teams.dev })).data, who).toBeNull();
    }
  });

  it("private-content grants require a distinct second approver, and revocation is immediate", async () => {
    const sam = await as("admin");
    const tara = await as("reader");
    const rhea = await as("owner");

    const issued = await sam.rpc("issue_grant", {
      p_team: w.teams.main,
      p_grantee: w.ids.reader,
      p_scope: "workspace_read",
      p_reason: "Advisor reviewing the hiring plan this month",
      p_expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    });
    expect(issued.error).toBeNull();
    const grantId = issued.data as unknown as string;

    // Pending: no access yet.
    expect((await tara.from("tasks").select("id").eq("id", mainTaskId)).data).toEqual([]);
    // Issuer and grantee cannot approve.
    expect((await sam.rpc("decide_grant", { p_grant: grantId, p_approve: true })).error).not.toBeNull();
    expect((await tara.rpc("decide_grant", { p_grant: grantId, p_approve: true })).error).not.toBeNull();
    // The target team's lead approves.
    expect((await rhea.rpc("decide_grant", { p_grant: grantId, p_approve: true })).error).toBeNull();
    expect((await tara.from("tasks").select("id").eq("id", mainTaskId)).data).toHaveLength(1);
    // Revoke: the very next request is denied.
    expect((await sam.rpc("revoke_grant", { p_grant: grantId, p_reason: "Review complete" })).error).toBeNull();
    expect((await tara.from("tasks").select("id").eq("id", mainTaskId)).data).toEqual([]);
  });

  it("grant issuance and decisions are audited without the free-text reason", async () => {
    const sam = await as("admin");
    const { data } = await sam
      .from("audit_events")
      .select("action, metadata")
      .in("action", ["access_grant.issued", "access_grant.approved", "access_grant.revoked"]);
    expect(data!.map((e) => e.action)).toEqual(
      expect.arrayContaining(["access_grant.issued", "access_grant.approved", "access_grant.revoked"]),
    );
    expect(serialized(data)).not.toContain("hiring plan");
  });

  it("audit events cannot be modified or deleted", async () => {
    const sam = await as("admin");
    const { data } = await sam.from("audit_events").select("id").limit(1);
    const id = data![0].id;
    const upd = await sam.from("audit_events").update({ action: "tampered.event" }).eq("id", id).select("id");
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
    const del = await sam.from("audit_events").delete().eq("id", id).select("id");
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    const still = await sam.from("audit_events").select("action").eq("id", id).single();
    expect(still.data?.action).not.toBe("tampered.event");
  });
});

describe("tampering and integrity", () => {
  it("rejects creating a task in another team by forging team_id", async () => {
    const leo = await as("dev");
    const { error } = await leo.from("tasks").insert({ team_id: w.teams.main, title: "Forged" });
    expect(error).not.toBeNull();
  });

  it("rejects assigning a task to someone outside its team", async () => {
    const leo = await as("dev");
    const { error } = await leo.from("tasks").update({ assignee_id: w.ids.founder }).eq("id", devTaskId);
    expect(error?.message).toMatch(/active member/);
  });

  it("rejects assigning to a removed member", async () => {
    const leo = await as("dev");
    const { error } = await leo.from("tasks").update({ assignee_id: w.ids.removed }).eq("id", devTaskId);
    expect(error?.message).toMatch(/active member/);
  });

  it("does not let clients rewrite ownership, keys or rank", async () => {
    const leo = await as("dev");
    // Columns without an UPDATE grant are rejected outright.
    for (const patch of [{ team_id: w.teams.main }, { issue_key: "DEV-1" }, { rank: 1 }, { creator_id: w.ids.dev2 }] as const) {
      const { error } = await leo
        .from("tasks")
        .update(patch as never)
        .eq("id", devTaskId);
      expect(error, JSON.stringify(patch)).not.toBeNull();
    }
  });

  it("rejects a project or parent from another team", async () => {
    const rhea = await as("dual");
    const { data: devProject } = await rhea.from("projects").select("id").eq("team_id", w.teams.dev).limit(1).single();
    const { error } = await rhea.from("tasks").insert({ team_id: w.teams.main, title: "Cross link", project_id: devProject!.id });
    expect(error).not.toBeNull();
    const parent = await rhea.from("tasks").insert({ team_id: w.teams.main, title: "Cross parent", parent_id: devTaskId });
    expect(parent.error).not.toBeNull();
  });

  it("enforces workflow transitions on the server", async () => {
    const leo = await as("dev");
    const { data: t } = await leo.from("tasks").select("version, status_id").eq("id", devTaskId).single();
    expect(t!.status_id).toBe(w.statuses.dev.backlog);
    const illegal = await leo.rpc("move_task", { p_task: devTaskId, p_status: w.statuses.dev.done, p_expected_version: t!.version });
    expect(illegal.error?.message).toMatch(/not allowed/);
  });

  it("rejects stale writes with a conflict", async () => {
    const leo = await as("dev");
    const { data: t } = await leo.from("tasks").select("version").eq("id", devTaskId).single();
    const ok = await leo.rpc("move_task", { p_task: devTaskId, p_status: w.statuses.dev.ready, p_expected_version: t!.version });
    expect(ok.error).toBeNull();
    const stale = await leo.rpc("move_task", { p_task: devTaskId, p_status: w.statuses.dev.in_progress, p_expected_version: t!.version });
    expect(stale.error?.code).toBe("40001");
  });

  it("records completion and preserves history on reopen", async () => {
    const leo = await as("dev");
    const step = async (status: string) => {
      const { data: t } = await leo.from("tasks").select("version").eq("id", devTaskId).single();
      const r = await leo.rpc("move_task", { p_task: devTaskId, p_status: status, p_expected_version: t!.version });
      expect(r.error).toBeNull();
    };
    await step(w.statuses.dev.in_progress);
    await step(w.statuses.dev.done);
    expect((await leo.from("tasks").select("completed_at").eq("id", devTaskId).single()).data!.completed_at).not.toBeNull();
    await step(w.statuses.dev.in_progress);
    expect((await leo.from("tasks").select("completed_at").eq("id", devTaskId).single()).data!.completed_at).toBeNull();
    const events = (await leo.from("task_activity").select("event").eq("task_id", devTaskId)).data!.map((e) => e.event);
    expect(events).toEqual(expect.arrayContaining(["created", "completed", "reopened"]));
  });

  it("allows only the author to edit a comment, and deletion leaves a tombstone", async () => {
    const leo = await as("dev");
    const ada = await as("dev2");
    const { data: c } = await leo.from("task_comments").insert({ task_id: devTaskId, body: "first draft" }).select("id").single();
    const foreign = await ada.from("task_comments").update({ body: "rewritten by someone else" }).eq("id", c!.id).select("id");
    expect(foreign.data ?? []).toEqual([]);
    const del = await leo
      .from("task_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", c!.id)
      .select("body, deleted_at")
      .single();
    expect(del.data!.body).toBe("");
    expect(del.data!.deleted_at).not.toBeNull();
  });

  it("keeps subtasks to one level", async () => {
    const leo = await as("dev");
    const { data: child } = await leo
      .from("tasks")
      .insert({ team_id: w.teams.dev, title: "child", parent_id: devTaskId })
      .select("id")
      .single();
    const grandchild = await leo.from("tasks").insert({ team_id: w.teams.dev, title: "grandchild", parent_id: child!.id });
    expect(grandchild.error?.message).toMatch(/one level/);
  });
});

describe("notifications", () => {
  it("are visible only to their recipient and carry no titles", async () => {
    const ada = await as("dev2");
    const iris = await as("founder");
    const mine = await ada.from("notifications").select("*").eq("resource_id", devTaskId);
    expect(mine.data!.length).toBeGreaterThan(0);
    expect(serialized(mine.data)).not.toContain(devSecret);
    const theirs = await iris.from("notifications").select("id").eq("resource_id", devTaskId);
    expect(theirs.data).toEqual([]);
  });
});
