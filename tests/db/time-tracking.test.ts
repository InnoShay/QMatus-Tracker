/**
 * P1 time tracking against the real database (spec §7.13, §8.5, §4.6, §17.3).
 * Covers the one-running-timer invariant under concurrency, owner-only
 * visibility, the separate team-totals capability and the stop rule on
 * revocation. Writes go through the SQL functions; clients have no direct
 * write grant on time_entries.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { as, getWorld, serviceClient, type World } from "./helpers";

let w: World;
let taskA: string;
let taskB: string;
let leoEntry: string;

const HOUR = 3_600_000;
const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function running(userId: string) {
  const { data } = await serviceClient().from("time_entries").select("id, task_id").eq("user_id", userId).is("ended_at", null);
  return data ?? [];
}

beforeAll(async () => {
  w = await getWorld();
  const leo = await as("dev");
  const a = await leo.from("tasks").insert({ team_id: w.teams.dev, title: "Profile the sync worker" }).select("id").single();
  const b = await leo.from("tasks").insert({ team_id: w.teams.dev, title: "Write the sync runbook" }).select("id").single();
  expect(a.error).toBeNull();
  expect(b.error).toBeNull();
  taskA = a.data!.id;
  taskB = b.data!.id;
});

describe("one running timer per user", () => {
  it("two concurrent starts on different tasks leave exactly one running timer", async () => {
    const leo = await as("dev");
    const [r1, r2] = await Promise.all([leo.rpc("start_timer", { p_task: taskA }), leo.rpc("start_timer", { p_task: taskB })]);
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
    expect(await running(w.ids.dev)).toHaveLength(1);

    // The earlier one was stopped as "switched", never left open or overlapping.
    const { data: mine } = await leo.from("time_entries").select("id, ended_at, stop_reason").order("started_at");
    expect(mine).toHaveLength(2);
    expect(mine![0].stop_reason).toBe("switched");
    expect(mine![1].ended_at).toBeNull();
  });

  it("concurrent starts on the same task are idempotent and return the same entry", async () => {
    const leo = await as("dev");
    const results = await Promise.all([1, 2, 3].map(() => leo.rpc("start_timer", { p_task: taskA }).single()));
    for (const r of results) expect(r.error).toBeNull();
    const ids = new Set(results.map((r) => r.data!.id));
    expect(ids.size).toBe(1);
    expect(await running(w.ids.dev)).toEqual([{ id: [...ids][0], task_id: taskA }]);
    leoEntry = [...ids][0];
  });

  it("the database rejects a second running row even without the function", async () => {
    const svc = serviceClient();
    const { data: t } = await svc.from("tasks").select("org_id, team_id").eq("id", taskB).single();
    const dup = await svc.from("time_entries").insert({
      org_id: t!.org_id,
      team_id: t!.team_id,
      task_id: taskB,
      user_id: w.ids.dev,
      source: "timer",
      started_at: iso(-60_000),
    });
    expect(dup.error).not.toBeNull();
  });

  it("stop is idempotent and timestamps come from the server", async () => {
    const leo = await as("dev");
    const s1 = await leo.rpc("stop_timer").single();
    expect(s1.error).toBeNull();
    expect(s1.data!.id).toBe(leoEntry);
    expect(s1.data!.stop_reason).toBe("user");
    const s2 = await leo.rpc("stop_timer", { p_entry: leoEntry }).single();
    expect(s2.data!.ended_at).toBe(s1.data!.ended_at);
    // Nothing running: a bare stop is a no-op.
    const s3 = await leo.rpc("stop_timer");
    expect(s3.error).toBeNull();
    expect(s3.data).toEqual([]);
    expect(Math.abs(new Date(s1.data!.ended_at!).getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("clients cannot write time rows directly", async () => {
    const leo = await as("dev");
    const insert = await leo.from("time_entries").insert({
      org_id: w.ids.dev,
      team_id: w.teams.dev,
      task_id: taskA,
      user_id: w.ids.dev,
      source: "manual",
      started_at: iso(-2 * HOUR),
      ended_at: iso(-HOUR),
    });
    expect(insert.error).not.toBeNull();
    const update = await leo
      .from("time_entries")
      .update({ started_at: iso(-10 * HOUR) })
      .eq("id", leoEntry)
      .select("id");
    expect(update.error !== null || (update.data ?? []).length === 0).toBe(true);
    const del = await leo.from("time_entries").delete().eq("id", leoEntry).select("id");
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
  });
});

describe("manual entries and corrections", () => {
  it("validates ranges, rejects overlaps and is idempotent per request id", async () => {
    const leo = await as("dev");
    const bad = [
      { p_started_at: iso(-HOUR), p_ended_at: iso(-2 * HOUR) },
      { p_started_at: iso(-30 * HOUR), p_ended_at: iso(-HOUR) },
      { p_started_at: iso(-HOUR), p_ended_at: iso(2 * HOUR) },
      { p_started_at: iso(-100 * 24 * HOUR), p_ended_at: iso(-100 * 24 * HOUR + HOUR) },
    ];
    for (const range of bad) {
      const r = await leo.rpc("add_time_entry", { p_task: taskA, ...range });
      expect(r.error?.code, JSON.stringify(range)).toBe("22023");
    }

    const requestId = crypto.randomUUID();
    const args = { p_task: taskB, p_started_at: iso(-50 * HOUR), p_ended_at: iso(-49 * HOUR), p_note: "Pairing", p_request_id: requestId };
    const first = await leo.rpc("add_time_entry", args).single();
    expect(first.error).toBeNull();
    expect(first.data!.duration_seconds).toBe(3600);
    const retry = await leo.rpc("add_time_entry", args).single();
    expect(retry.data!.id).toBe(first.data!.id);

    const overlap = await leo.rpc("add_time_entry", {
      p_task: taskA,
      p_started_at: iso(-49.5 * HOUR),
      p_ended_at: iso(-48 * HOUR),
    });
    expect(overlap.error?.code).toBe("22023");
    expect(overlap.error?.message).toContain("overlaps");
  });

  it("an entry may cross midnight; it is not split", async () => {
    const leo = await as("dev");
    const d = new Date(Date.now() - 4 * 24 * HOUR);
    d.setUTCHours(23, 0, 0, 0);
    const start = d.toISOString();
    const end = new Date(d.getTime() + 2 * HOUR).toISOString();
    const r = await leo.rpc("add_time_entry", { p_task: taskA, p_started_at: start, p_ended_at: end }).single();
    expect(r.error).toBeNull();
    expect(r.data!.duration_seconds).toBe(7200);
  });

  it("corrections are version-checked and leave a history event", async () => {
    const leo = await as("dev");
    const created = await leo
      .rpc("add_time_entry", { p_task: taskA, p_started_at: iso(-150 * HOUR), p_ended_at: iso(-149 * HOUR) })
      .single();
    const e = created.data!;
    const fixed = await leo
      .rpc("correct_time_entry", {
        p_entry: e.id,
        p_expected_version: e.version,
        p_started_at: e.started_at,
        p_ended_at: new Date(new Date(e.ended_at!).getTime() + 30 * 60_000).toISOString(),
        p_note: "Forgot the review call",
      })
      .single();
    expect(fixed.error).toBeNull();
    expect(fixed.data!.duration_seconds).toBe(5400);
    expect(fixed.data!.corrected_at).not.toBeNull();

    const stale = await leo.rpc("correct_time_entry", {
      p_entry: e.id,
      p_expected_version: e.version,
      p_started_at: e.started_at,
      p_ended_at: e.ended_at!,
    });
    expect(stale.error?.code).toBe("40001");

    const { data: events } = await leo.from("time_entry_events").select("event, data").eq("entry_id", e.id).order("id");
    expect(events!.map((x) => x.event)).toEqual(["manual_created", "corrected"]);
    expect(JSON.stringify(events![1].data)).toContain(e.ended_at!.slice(0, 16));

    // Someone else can't correct or delete it, even on the same team.
    const ada = await as("dev2");
    const hijack = await ada.rpc("correct_time_entry", {
      p_entry: e.id,
      p_expected_version: fixed.data!.version,
      p_started_at: e.started_at,
      p_ended_at: e.ended_at!,
    });
    expect(hijack.error?.code).toBe("P0002");
    expect((await ada.rpc("delete_time_entry", { p_entry: e.id, p_expected_version: fixed.data!.version })).error?.code).toBe("P0002");

    // The owner's delete is soft and idempotent.
    expect((await leo.rpc("delete_time_entry", { p_entry: e.id, p_expected_version: fixed.data!.version })).error).toBeNull();
    expect((await leo.rpc("delete_time_entry", { p_entry: e.id, p_expected_version: fixed.data!.version })).error).toBeNull();
    const { data: after } = await leo.from("time_entries").select("deleted_at").eq("id", e.id).single();
    expect(after!.deleted_at).not.toBeNull();
  });
});

describe("privacy", () => {
  it("another member, the team lead and an admin cannot read your entries or their history", async () => {
    for (const who of ["dev2", "devLead", "admin", "owner"] as const) {
      const db = await as(who);
      expect((await db.from("time_entries").select("id").eq("user_id", w.ids.dev)).data, who).toEqual([]);
      expect((await db.from("time_entries").select("id").eq("id", leoEntry)).data, who).toEqual([]);
      expect((await db.from("time_entry_events").select("id").eq("entry_id", leoEntry)).data, who).toEqual([]);
    }
  });

  it("a read-grant holder can read the task but cannot see entries, log time or read totals", async () => {
    const tara = await as("reader");
    expect((await tara.from("tasks").select("id").eq("id", taskA)).data).toHaveLength(1);
    expect((await tara.from("time_entries").select("id").eq("task_id", taskA)).data).toEqual([]);
    expect((await tara.from("time_entry_events").select("id")).data).toEqual([]);
    expect((await tara.rpc("start_timer", { p_task: taskA })).error?.code).toBe("42501");
    expect(
      (await tara.rpc("add_time_entry", { p_task: taskA, p_started_at: iso(-3 * HOUR), p_ended_at: iso(-2 * HOUR) })).error?.code,
    ).toBe("42501");
    const totals = await tara.rpc("team_time_totals", { p_team: w.teams.dev, p_from: "2026-01-01", p_to: "2026-12-31" });
    expect(totals.data).toBeNull();
  });

  it("someone outside the team gets the same answer for a private task as for a missing one", async () => {
    const iris = await as("founder");
    const priv = await iris.rpc("start_timer", { p_task: taskA });
    const missing = await iris.rpc("start_timer", { p_task: crypto.randomUUID() });
    expect(priv.error?.code).toBe("P0002");
    expect(missing.error?.code).toBe("P0002");
    expect(priv.error?.message).toBe(missing.error?.message);
  });

  it("team totals are a lead-only aggregate, suppressed below three people", async () => {
    const range = {
      p_team: w.teams.dev,
      p_from: new Date(Date.now() - 7 * 24 * HOUR).toISOString().slice(0, 10),
      p_to: iso(24 * HOUR).slice(0, 10),
    };
    for (const who of ["dev", "dev2", "admin", "owner", "summaryViewer"] as const) {
      expect((await (await as(who)).rpc("team_time_totals", range)).data, who).toBeNull();
    }
    const priya = await as("devLead");
    const before = (await priya.rpc("team_time_totals", range)).data as Record<string, unknown>;
    expect(before.suppressed).toBe(true);
    expect(before.total_seconds).toBeNull();

    for (const who of ["dev2", "dual"] as const) {
      const db = await as(who);
      const r = await db.rpc("add_time_entry", {
        p_task: taskB,
        p_started_at: iso(-6 * HOUR),
        p_ended_at: iso(-5 * HOUR),
        p_note: `secret note ${who}`,
      });
      expect(r.error, who).toBeNull();
    }
    const after = (await priya.rpc("team_time_totals", range)).data as Record<string, unknown>;
    expect(after.suppressed).toBe(false);
    expect(Object.keys(after).sort()).toEqual(["from", "suppressed", "to", "total_seconds"]);
    expect(Number(after.total_seconds)).toBeGreaterThanOrEqual(2 * 3600);
    expect(JSON.stringify(after)).not.toContain("secret note");
  });
});

describe("stop rule on revocation", () => {
  it("removing a member stops their timer, and they can no longer write time to that team", async () => {
    const noor = await as("dual");
    const sam = await as("admin");
    const started = await noor.rpc("start_timer", { p_task: taskA }).single();
    expect(started.error).toBeNull();

    expect((await sam.rpc("admin_remove_team_member", { p_team: w.teams.dev, p_profile: w.ids.dual })).error).toBeNull();
    try {
      const { data: entry } = await noor.from("time_entries").select("ended_at, stop_reason").eq("id", started.data!.id).single();
      expect(entry!.ended_at).not.toBeNull();
      expect(entry!.stop_reason).toBe("access_lost");
      expect(await running(w.ids.dual)).toEqual([]);
      expect((await noor.rpc("start_timer", { p_task: taskA })).error).not.toBeNull();
      const manual = await noor.rpc("add_time_entry", { p_task: taskA, p_started_at: iso(-12 * HOUR), p_ended_at: iso(-11 * HOUR) });
      expect(manual.error).not.toBeNull();
      // History stays with its owner.
      const { data: events } = await noor.from("time_entry_events").select("event").eq("entry_id", started.data!.id).order("id");
      expect(events!.map((e) => e.event)).toEqual(["started", "auto_stopped"]);
    } finally {
      expect((await sam.rpc("admin_add_team_member", { p_team: w.teams.dev, p_profile: w.ids.dual, p_role: "member" })).error).toBeNull();
    }
  });

  it("suspending an account stops its running timer", async () => {
    const noor = await as("dual");
    const sam = await as("admin");
    const started = await noor.rpc("start_timer", { p_task: taskB }).single();
    expect(started.error).toBeNull();
    expect(
      (await sam.rpc("admin_set_member_state", { p_org: await orgId(), p_profile: w.ids.dual, p_state: "suspended" })).error,
    ).toBeNull();
    try {
      const { data } = await serviceClient().from("time_entries").select("stop_reason, ended_at").eq("id", started.data!.id).single();
      expect(data!.stop_reason).toBe("suspended");
      // A suspended account can't read even its own entries.
      expect((await noor.from("time_entries").select("id")).data).toEqual([]);
      expect((await noor.rpc("start_timer", { p_task: taskB })).error).not.toBeNull();
    } finally {
      expect(
        (await sam.rpc("admin_set_member_state", { p_org: await orgId(), p_profile: w.ids.dual, p_state: "active" })).error,
      ).toBeNull();
    }
  });

  it("archiving a task stops timers on it and refuses new time", async () => {
    const leo = await as("dev");
    const t = await leo.from("tasks").insert({ team_id: w.teams.dev, title: "Short-lived spike" }).select("id").single();
    const started = await leo.rpc("start_timer", { p_task: t.data!.id }).single();
    expect(started.error).toBeNull();
    expect((await leo.from("tasks").update({ archived_at: new Date().toISOString() }).eq("id", t.data!.id)).error).toBeNull();
    const { data } = await leo.from("time_entries").select("stop_reason").eq("id", started.data!.id).single();
    expect(data!.stop_reason).toBe("task_archived");
    expect((await leo.rpc("start_timer", { p_task: t.data!.id })).error?.code).toBe("22023");
  });

  it("revoking an edit grant stops the grantee's timer; an expired one is settled at its expiry", async () => {
    const tara = await as("reader");
    const sam = await as("admin");
    const priya = await as("devLead");

    const grant = async (expiresInMs: number) => {
      const issued = await sam.rpc("issue_grant", {
        p_team: w.teams.dev,
        p_grantee: w.ids.reader,
        p_scope: "edit",
        p_reason: "Covering on-call this week",
        p_expires_at: iso(expiresInMs),
      });
      expect(issued.error).toBeNull();
      const id = issued.data as unknown as string;
      expect((await priya.rpc("decide_grant", { p_grant: id, p_approve: true })).error).toBeNull();
      return id;
    };

    const g1 = await grant(24 * HOUR);
    const s1 = await tara.rpc("start_timer", { p_task: taskA }).single();
    expect(s1.error).toBeNull();
    expect((await sam.rpc("revoke_grant", { p_grant: g1, p_reason: "On-call ended" })).error).toBeNull();
    const { data: e1 } = await tara.from("time_entries").select("stop_reason").eq("id", s1.data!.id).single();
    expect(e1!.stop_reason).toBe("access_lost");

    await grant(4_000);
    const s2 = await tara.rpc("start_timer", { p_task: taskA }).single();
    expect(s2.error).toBeNull();
    const { data: g2 } = await serviceClient()
      .from("team_access_grants")
      .select("expires_at")
      .eq("grantee_id", w.ids.reader)
      .eq("scope", "edit")
      .eq("status", "active")
      .single();
    await sleep(5_000);
    const current = await tara.rpc("current_timer");
    expect(current.data).toEqual([]);
    const { data: e2 } = await tara.from("time_entries").select("stop_reason, ended_at").eq("id", s2.data!.id).single();
    expect(e2!.stop_reason).toBe("access_lost");
    // Ended when access ended, not when it was noticed.
    expect(new Date(e2!.ended_at!).getTime()).toBe(new Date(g2!.expires_at!).getTime());
    expect((await tara.rpc("start_timer", { p_task: taskA })).error?.code).toBe("42501");
  });
});

async function orgId() {
  const { data } = await serviceClient().from("teams").select("org_id").eq("id", w.teams.dev).single();
  return data!.org_id;
}
