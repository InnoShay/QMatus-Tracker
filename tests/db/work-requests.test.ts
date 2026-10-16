/**
 * The founder → developer Work Request boundary (spec §5, §8.1, §17.2 #9).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { as, getWorld, marker, serialized, type World } from "./helpers";

let w: World;
let requestId: string;
let noteSecret: string;
let taskSecret: string;
let linkedTaskIds: string[];

beforeAll(async () => {
  w = await getWorld();
  noteSecret = marker("TRIAGENOTE");
  taskSecret = marker("LINKEDTASK");
  const iris = await as("founder");
  const clientKey = crypto.randomUUID();
  const submitted = await iris.rpc("submit_work_request", {
    p_client_key: clientKey,
    p_target_team: w.teams.dev,
    p_source_team: w.teams.main,
    p_title: "Audit log export for compliance review",
    p_problem: "Our auditor needs a quarterly export.",
    p_outcome: "Admins can export audit events for a date range.",
    p_requested_priority: "medium",
    p_as_draft: false,
  });
  expect(submitted.error).toBeNull();
  requestId = submitted.data as unknown as string;

  // Idempotent: the same client key returns the same request, not a duplicate.
  const again = await iris.rpc("submit_work_request", {
    p_client_key: clientKey,
    p_target_team: w.teams.dev,
    p_title: "Audit log export for compliance review",
    p_problem: "Our auditor needs a quarterly export.",
    p_outcome: "Admins can export audit events for a date range.",
    p_requested_priority: "medium",
    p_as_draft: false,
  });
  expect(again.data).toBe(requestId);

  const priya = await as("devLead");
  expect(
    (await priya.rpc("transition_work_request", { p_request: requestId, p_expected: "submitted", p_to: "in_triage" })).error,
  ).toBeNull();
  expect(
    (await priya.from("work_request_internal_notes").insert({ request_id: requestId, body: `Risky: ${noteSecret}` })).error,
  ).toBeNull();
  const accepted = await priya.rpc("accept_work_request", {
    p_request: requestId,
    p_expected: "in_triage",
    p_committed_priority: "high",
    p_public_summary: "Accepted for next sprint.",
    p_tasks: [{ title: `Export pipeline ${taskSecret}`, assignee_id: w.ids.dev }],
  });
  expect(accepted.error).toBeNull();
  linkedTaskIds = accepted.data as unknown as string[];
  expect(linkedTaskIds).toHaveLength(1);
});

describe("requester view", () => {
  it("sees the shared request, its published events and shared messages", async () => {
    const iris = await as("founder");
    const r = await iris.from("work_requests").select("id, status, committed_priority").eq("id", requestId).single();
    expect(r.data).toMatchObject({ status: "accepted", committed_priority: "high" });
    const events = await iris.from("work_request_status_events").select("to_status, public_summary").eq("request_id", requestId);
    expect(events.data!.map((e) => e.to_status)).toEqual(["submitted", "in_triage", "accepted"]);
  });

  it("cannot read internal notes, triage records, task links or the linked tasks", async () => {
    const iris = await as("founder");
    expect((await iris.from("work_request_internal_notes").select("*").eq("request_id", requestId)).data).toEqual([]);
    expect((await iris.from("work_request_triage").select("*").eq("request_id", requestId)).data).toEqual([]);
    expect((await iris.from("work_request_task_links").select("*").eq("request_id", requestId)).data).toEqual([]);
    expect((await iris.from("tasks").select("id").in("id", linkedTaskIds)).data).toEqual([]);
    const search = await iris.rpc("search_workspace", { p_query: "Export pipeline" });
    expect(serialized(search.data)).not.toContain(taskSecret);
  });

  it("cannot reach private data through any shared resource", async () => {
    const iris = await as("founder");
    const all = await Promise.all([
      iris.from("work_requests").select("*").eq("id", requestId),
      iris.from("work_request_status_events").select("*").eq("request_id", requestId),
      iris.from("work_request_messages").select("*").eq("request_id", requestId),
      iris.from("work_request_audience").select("*").eq("request_id", requestId),
      iris.from("notifications").select("*"),
    ]);
    const blob = serialized(all.map((r) => r.data));
    expect(blob).not.toContain(noteSecret);
    expect(blob).not.toContain(taskSecret);
    for (const id of linkedTaskIds) expect(blob).not.toContain(id);
  });

  it("cannot triage, publish updates or write internal notes", async () => {
    const iris = await as("founder");
    expect(
      (await iris.rpc("transition_work_request", { p_request: requestId, p_expected: "accepted", p_to: "in_progress" })).error,
    ).not.toBeNull();
    expect((await iris.rpc("publish_request_update", { p_request: requestId, p_summary: "All done!" })).error).not.toBeNull();
    expect((await iris.from("work_request_internal_notes").insert({ request_id: requestId, body: "sneaky" })).error).not.toBeNull();
  });

  it("cannot edit a submitted request directly", async () => {
    const iris = await as("founder");
    const upd = await iris.from("work_requests").update({ title: "Changed after submission" }).eq("id", requestId).select("id");
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
  });

  it("can exchange shared messages with the receiving team", async () => {
    const iris = await as("founder");
    const priya = await as("devLead");
    expect((await iris.from("work_request_messages").insert({ request_id: requestId, body: "Thanks — CSV is fine." })).error).toBeNull();
    const seen = await priya.from("work_request_messages").select("body").eq("request_id", requestId);
    expect(seen.data!.map((m) => m.body)).toContain("Thanks — CSV is fine.");
  });
});

describe("outsiders", () => {
  it("a developer outside the audience still triages via team membership; an unrelated admin sees nothing", async () => {
    const sam = await as("admin");
    expect((await sam.from("work_requests").select("id").eq("id", requestId)).data).toEqual([]);
    expect((await sam.from("work_request_messages").select("id").eq("request_id", requestId)).data).toEqual([]);
    const leo = await as("dev");
    expect((await leo.from("work_requests").select("id").eq("id", requestId)).data).toHaveLength(1);
    expect((await leo.from("work_request_internal_notes").select("body").eq("request_id", requestId)).data!.length).toBe(1);
  });
});

describe("lifecycle integrity", () => {
  it("a retried accept conflicts instead of creating a second task tree", async () => {
    const priya = await as("devLead");
    const retry = await priya.rpc("accept_work_request", {
      p_request: requestId,
      p_expected: "in_triage",
      p_committed_priority: "high",
      p_tasks: [{ title: "Duplicate tree" }],
    });
    expect(retry.error?.code).toBe("40001");
    const links = await priya.from("work_request_task_links").select("task_id").eq("request_id", requestId);
    expect(links.data).toHaveLength(1);
  });

  it("rejects illegal transitions and requires a reason to decline", async () => {
    const priya = await as("devLead");
    const skip = await priya.rpc("transition_work_request", { p_request: requestId, p_expected: "accepted", p_to: "closed" });
    expect(skip.error).not.toBeNull();
    const noReason = await priya.rpc("transition_work_request", { p_request: requestId, p_expected: "accepted", p_to: "declined" });
    expect(noReason.error?.message).toMatch(/reason/);
  });

  it("rejects a requested date in the past", async () => {
    const iris = await as("founder");
    const { error } = await iris.rpc("submit_work_request", {
      p_client_key: crypto.randomUUID(),
      p_target_team: w.teams.dev,
      p_title: "Backdated request",
      p_problem: "x",
      p_outcome: "y",
      p_requested_priority: "low",
      p_as_draft: false,
      p_requested_date: "2001-01-01",
    });
    expect(error?.message).toMatch(/past/);
  });

  it("refuses requests into a team that does not accept them", async () => {
    const leo = await as("dev");
    const { error } = await leo.rpc("submit_work_request", {
      p_client_key: crypto.randomUUID(),
      p_target_team: w.teams.main,
      p_title: "Into the founders' team",
      p_problem: "x",
      p_outcome: "y",
      p_requested_priority: "low",
      p_as_draft: false,
    });
    expect(error?.message).toMatch(/not accepting/);
  });
});
