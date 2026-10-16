/**
 * P1 task dependencies against the real database (spec §7.14). Covers self-links,
 * duplicates and cycles (including concurrent attempts), cross-team privacy,
 * who may edit links, soft removal that keeps history, and warning-only
 * enforcement. Writes go through the SQL functions; clients have no direct
 * write grant on task_dependencies.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { anon, as, getWorld, marker, serialized, serviceClient, type World } from "./helpers";

let w: World;

type Created = { id: string; key: string };

async function devTask(title: string, user: "dev" | "dual" = "dev"): Promise<Created> {
  const c = await as(user);
  const { data, error } = await c.from("tasks").insert({ team_id: w.teams.dev, title }).select("id, issue_key").single();
  expect(error).toBeNull();
  return { id: data!.id, key: data!.issue_key };
}

async function mainTask(title: string): Promise<Created> {
  const noor = await as("dual");
  const { data, error } = await noor.from("tasks").insert({ team_id: w.teams.main, title }).select("id, issue_key").single();
  expect(error).toBeNull();
  return { id: data!.id, key: data!.issue_key };
}

beforeAll(async () => {
  w = await getWorld();
});

describe("links between tasks the caller can read", () => {
  it("a member links two team tasks; both sides see the direction, with a direct link", async () => {
    const leo = await as("dev");
    const a = await devTask("Ship the export API");
    const b = await devTask("Agree the export schema");

    const { error } = await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: b.key.toLowerCase(), p_direction: "blocked_by" });
    expect(error).toBeNull();

    const fromA = await leo.rpc("get_task_dependencies", { p_task: a.id });
    expect(fromA.error).toBeNull();
    expect(fromA.data).toHaveLength(1);
    expect(fromA.data![0]).toMatchObject({ direction: "blocked_by", visible: true, task_id: b.id, issue_key: b.key, resolved: false });

    const fromB = await leo.rpc("get_task_dependencies", { p_task: b.id });
    expect(fromB.data![0]).toMatchObject({ direction: "blocks", visible: true, task_id: a.id });

    const counts = await leo.rpc("task_blocker_counts", { p_tasks: [a.id, b.id] });
    expect(counts.data).toEqual([{ task_id: a.id, open_blockers: 1 }]);
  });

  it("rejects self-links and duplicate links", async () => {
    const leo = await as("dev");
    const a = await devTask("Self link target");
    const b = await devTask("Duplicate link target");

    const self = await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: a.key, p_direction: "blocks" });
    expect(self.error?.code).toBe("22023");

    expect((await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: b.key, p_direction: "blocks" })).error).toBeNull();
    const dup = await leo.rpc("add_task_dependency", { p_task: b.id, p_other_key: a.key, p_direction: "blocked_by" });
    expect(dup.error?.code).toBe("23505");
  });
});

describe("no cycles", () => {
  it("rejects a direct two-task loop", async () => {
    const leo = await as("dev");
    const a = await devTask("Loop A");
    const b = await devTask("Loop B");
    expect((await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: b.key, p_direction: "blocked_by" })).error).toBeNull();
    const loop = await leo.rpc("add_task_dependency", { p_task: b.id, p_other_key: a.key, p_direction: "blocked_by" });
    expect(loop.error?.code).toBe("23514");
    expect(loop.error?.message).toMatch(/loop/);
  });

  it("rejects a longer loop (A ← B ← C, then C blocked by A)", async () => {
    const leo = await as("dev");
    const a = await devTask("Chain A");
    const b = await devTask("Chain B");
    const c = await devTask("Chain C");
    expect((await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: b.key, p_direction: "blocked_by" })).error).toBeNull();
    expect((await leo.rpc("add_task_dependency", { p_task: b.id, p_other_key: c.key, p_direction: "blocked_by" })).error).toBeNull();
    const loop = await leo.rpc("add_task_dependency", { p_task: c.id, p_other_key: a.key, p_direction: "blocked_by" });
    expect(loop.error?.code).toBe("23514");
  });

  it("two concurrent opposite links leave exactly one", async () => {
    const leo = await as("dev");
    const ada = await as("dev2");
    const x = await devTask("Race X");
    const y = await devTask("Race Y");
    const [r1, r2] = await Promise.all([
      leo.rpc("add_task_dependency", { p_task: x.id, p_other_key: y.key, p_direction: "blocked_by" }),
      ada.rpc("add_task_dependency", { p_task: y.id, p_other_key: x.key, p_direction: "blocked_by" }),
    ]);
    expect([r1.error, r2.error].filter(Boolean)).toHaveLength(1);
    const { data } = await serviceClient()
      .from("task_dependencies")
      .select("id")
      .in("blocked_task_id", [x.id, y.id])
      .is("removed_at", null);
    expect(data).toHaveLength(1);
  });

  it("a removed link no longer counts towards a loop", async () => {
    const leo = await as("dev");
    const a = await devTask("Unloop A");
    const b = await devTask("Unloop B");
    const first = await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: b.key, p_direction: "blocked_by" });
    expect(first.error).toBeNull();
    expect((await leo.rpc("remove_task_dependency", { p_link: first.data!.id })).error).toBeNull();
    const reverse = await leo.rpc("add_task_dependency", { p_task: b.id, p_other_key: a.key, p_direction: "blocked_by" });
    expect(reverse.error).toBeNull();
  });
});

describe("cross-team privacy", () => {
  it("a member can't link to another team's private task; it looks the same as an unknown key", async () => {
    const leo = await as("dev");
    const a = await devTask("Needs a founders decision");
    const secret = await mainTask(marker("founders-private"));

    const hidden = await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: secret.key, p_direction: "blocked_by" });
    const unknown = await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: "ZZZ-99999", p_direction: "blocked_by" });
    expect(hidden.error?.code).toBe("P0002");
    expect(unknown.error?.code).toBe("P0002");
    expect(hidden.error?.message).toBe(unknown.error?.message);
  });

  it("a link made by someone in both teams shows as a generic blocker to a viewer who can't read the other end", async () => {
    const noor = await as("dual");
    const leo = await as("dev");
    const title = marker("founders-blocker");
    const blocker = await mainTask(title);
    const blocked = await devTask("Launch pricing page", "dual");

    const added = await noor.rpc("add_task_dependency", { p_task: blocked.id, p_other_key: blocker.key, p_direction: "blocked_by" });
    expect(added.error).toBeNull();

    // Noor reads both ends.
    const noorView = await noor.rpc("get_task_dependencies", { p_task: blocked.id });
    expect(noorView.data![0]).toMatchObject({ visible: true, issue_key: blocker.key, team_slug: "main" });

    // Leo sees that the task is blocked, but nothing identifying the blocker.
    const leoView = await leo.rpc("get_task_dependencies", { p_task: blocked.id });
    expect(leoView.error).toBeNull();
    expect(leoView.data).toHaveLength(1);
    const row = leoView.data![0];
    expect(row).toMatchObject({ direction: "blocked_by", visible: false, resolved: false });
    expect(row.task_id).toBeNull();
    expect(row.issue_key).toBeNull();
    expect(row.title).toBeNull();
    expect(row.team_slug).toBeNull();
    expect(row.team_name).toBeNull();
    expect(serialized(leoView.data)).not.toContain(title);
    expect(serialized(leoView.data)).not.toContain(blocker.key);

    // Direct table reads need both ends readable.
    const direct = await leo.from("task_dependencies").select("*").eq("id", added.data!.id);
    expect(direct.data).toEqual([]);

    // The blocker's own page is not readable through the link function either.
    const other = await leo.rpc("get_task_dependencies", { p_task: blocker.id });
    expect(other.error?.code).toBe("P0002");

    // The board cue still counts it.
    const counts = await leo.rpc("task_blocker_counts", { p_tasks: [blocked.id, blocker.id] });
    expect(counts.data).toEqual([{ task_id: blocked.id, open_blockers: 1 }]);

    // Activity on the dev task names no key or title.
    const { data: activity } = await leo.from("task_activity").select("event, data").eq("task_id", blocked.id);
    expect(activity!.some((a) => a.event === "dependency_added")).toBe(true);
    expect(serialized(activity)).not.toContain(title);
    expect(serialized(activity)).not.toContain(blocker.key);

    // Leo can write the dev side, so may clear the link without seeing the other end.
    expect((await leo.rpc("remove_task_dependency", { p_link: added.data!.id })).error).toBeNull();
  });
});

describe("who may edit links", () => {
  it("a read-grant holder sees links but can't add or remove them", async () => {
    const leo = await as("dev");
    const tara = await as("reader");
    const a = await devTask("Read grant target A");
    const b = await devTask("Read grant target B");
    const c = await devTask("Read grant target C");
    const link = await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: b.key, p_direction: "blocked_by" });
    expect(link.error).toBeNull();

    const view = await tara.rpc("get_task_dependencies", { p_task: a.id });
    expect(view.data).toHaveLength(1);

    const add = await tara.rpc("add_task_dependency", { p_task: a.id, p_other_key: c.key, p_direction: "blocked_by" });
    expect(add.error?.code).toBe("42501");
    const remove = await tara.rpc("remove_task_dependency", { p_link: link.data!.id });
    expect(remove.error?.code).toBe("42501");

    // No direct write path either.
    const insert = await tara.from("task_dependencies").insert({
      org_id: link.data!.org_id,
      blocker_team_id: w.teams.dev,
      blocker_task_id: c.id,
      blocked_team_id: w.teams.dev,
      blocked_task_id: a.id,
      created_by: w.ids.reader,
    });
    expect(insert.error).not.toBeNull();
    const update = await tara
      .from("task_dependencies")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", link.data!.id)
      .select("id");
    expect(update.data ?? []).toEqual([]);

    const { data: still } = await serviceClient().from("task_dependencies").select("removed_at").eq("id", link.data!.id).single();
    expect(still!.removed_at).toBeNull();
  });

  it("members have no direct insert either; the function is the only path", async () => {
    const leo = await as("dev");
    const a = await devTask("Direct insert A");
    const b = await devTask("Direct insert B");
    const { data: t } = await leo.from("tasks").select("org_id").eq("id", a.id).single();
    const insert = await leo.from("task_dependencies").insert({
      org_id: t!.org_id,
      blocker_team_id: w.teams.dev,
      blocker_task_id: b.id,
      blocked_team_id: w.teams.dev,
      blocked_task_id: a.id,
      created_by: w.ids.dev,
    });
    expect(insert.error).not.toBeNull();
  });

  it("anonymous callers get nothing", async () => {
    const a = await devTask("Anonymous target");
    const res = await anon().rpc("get_task_dependencies", { p_task: a.id });
    expect(res.error).not.toBeNull();
    const counts = await anon().rpc("task_blocker_counts", { p_tasks: [a.id] });
    expect(counts.data ?? []).toEqual([]);
  });
});

describe("history and warning-only enforcement", () => {
  it("removal is soft, logged on both tasks, and rows can't be deleted", async () => {
    const leo = await as("dev");
    const a = await devTask("History A");
    const b = await devTask("History B");
    const link = await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: b.key, p_direction: "blocks" });
    expect(link.error).toBeNull();
    expect((await leo.rpc("remove_task_dependency", { p_link: link.data!.id })).error).toBeNull();
    // Retrying is harmless.
    expect((await leo.rpc("remove_task_dependency", { p_link: link.data!.id })).error).toBeNull();

    const svc = serviceClient();
    const { data: row } = await svc.from("task_dependencies").select("removed_at, removed_by").eq("id", link.data!.id).single();
    expect(row!.removed_at).not.toBeNull();
    expect(row!.removed_by).toBe(w.ids.dev);
    expect((await leo.rpc("get_task_dependencies", { p_task: a.id })).data).toEqual([]);

    for (const id of [a.id, b.id]) {
      const { data } = await leo
        .from("task_activity")
        .select("event")
        .eq("task_id", id)
        .in("event", ["dependency_added", "dependency_removed"]);
      expect(data!.map((d) => d.event).sort()).toEqual(["dependency_added", "dependency_removed"]);
    }

    const del = await svc.from("task_dependencies").delete().eq("id", link.data!.id);
    expect(del.error).not.toBeNull();
  });

  it("archiving the blocker keeps the link and resolves it", async () => {
    const leo = await as("dev");
    const a = await devTask("Archive A");
    const b = await devTask("Archive B");
    expect((await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: b.key, p_direction: "blocked_by" })).error).toBeNull();
    const { error } = await leo.from("tasks").update({ archived_at: new Date().toISOString() }).eq("id", b.id);
    expect(error).toBeNull();

    const view = await leo.rpc("get_task_dependencies", { p_task: a.id });
    expect(view.data).toHaveLength(1);
    expect(view.data![0]).toMatchObject({ archived: true, resolved: true });
    expect((await leo.rpc("task_blocker_counts", { p_tasks: [a.id] })).data).toEqual([]);

    // New links to archived tasks are refused.
    const c = await devTask("Archive C");
    const late = await leo.rpc("add_task_dependency", { p_task: c.id, p_other_key: b.key, p_direction: "blocked_by" });
    expect(late.error?.code).toBe("22023");
  });

  it("an open blocker never stops a status change", async () => {
    const leo = await as("dev");
    const a = await devTask("Move while blocked");
    const b = await devTask("Open blocker");
    expect((await leo.rpc("add_task_dependency", { p_task: a.id, p_other_key: b.key, p_direction: "blocked_by" })).error).toBeNull();
    const { data: t } = await leo.from("tasks").select("version, status_id").eq("id", a.id).single();
    const { data: transitions } = await leo.from("task_status_transitions").select("to_status").eq("from_status", t!.status_id).limit(1);
    const moved = await leo.rpc("move_task", { p_task: a.id, p_status: transitions![0].to_status, p_expected_version: t!.version });
    expect(moved.error).toBeNull();
  });
});
