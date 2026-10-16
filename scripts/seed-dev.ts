/**
 * Seeds a LOCAL Supabase stack with a QMatus workspace and development-only
 * fixture data. Content is created by signing in as each fixture user so the
 * real RLS policies, triggers and RPCs run (activity, keys, notifications).
 *
 *   npm run db:reset && npm run db:seed
 */
import { DEV_PASSWORD, USERS, type UserKey } from "./fixtures";
import { isoDate, must, serviceClient, userClient, type Db } from "./lib";

type Ids = Record<UserKey, string>;

async function main() {
  const svc = serviceClient();

  const existing = must(await svc.from("organizations").select("id").limit(1), "check org");
  if (existing.length > 0) {
    console.log("Workspace already exists. Run `npm run db:reset` first for a fresh seed.");
    return;
  }

  // 1. Identities (provider admin API — local bootstrap only).
  const ids = {} as Ids;
  for (const [key, u] of Object.entries(USERS) as [UserKey, (typeof USERS)[UserKey]][]) {
    const { data, error } = await svc.auth.admin.createUser({
      email: u.email,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: u.name },
    });
    if (error) throw new Error(`create ${u.email}: ${error.message}`);
    ids[key] = data.user.id;
    must(
      await svc
        .from("profiles")
        .update({ title: u.title, level: "level" in u ? u.level : null, timezone: "Asia/Kolkata" })
        .eq("id", data.user.id),
      "profile",
    );
  }

  // 2. Workspace, teams, memberships.
  const org = must(await svc.from("organizations").insert({ name: "QMatus", slug: "qmatus" }).select("id").single(), "org");
  must(
    await svc.from("organization_memberships").insert(
      (Object.keys(USERS) as UserKey[]).map((k) => ({
        org_id: org.id,
        profile_id: ids[k],
        role: USERS[k].orgRole,
      })),
    ),
    "org memberships",
  );

  const teams = must(
    await svc
      .from("teams")
      .insert([
        {
          org_id: org.id,
          name: "Main Team",
          slug: "main",
          issue_prefix: "MAIN",
          description: "Founders' planning, decisions and company work.",
          accepts_requests: false,
        },
        {
          org_id: org.id,
          name: "Developer Team",
          slug: "dev",
          issue_prefix: "DEV",
          description: "Product engineering: build, review and ship.",
          accepts_requests: true,
          wip_limit_in_progress: 4,
        },
      ])
      .select("id, slug"),
    "teams",
  );
  const teamId = {
    founders: teams.find((t) => t.slug === "main")!.id,
    dev: teams.find((t) => t.slug === "dev")!.id,
  };

  const memberships = (Object.keys(USERS) as UserKey[]).flatMap((k) =>
    Object.entries(USERS[k].teams).map(([team, role]) => ({
      org_id: org.id,
      team_id: teamId[team as "founders" | "dev"],
      profile_id: ids[k],
      role: role as "lead" | "member",
      added_by: ids.admin,
    })),
  );
  must(await svc.from("team_memberships").insert(memberships), "team memberships");

  // 3. Grants (fixture shortcut; the app path is issue_grant/decide_grant).
  const past = new Date(Date.now() - 10 * 86400_000).toISOString();
  must(
    await svc.from("team_access_grants").insert(
      [
        {
          org_id: org.id,
          team_id: teamId.dev,
          grantee_id: ids.summaryViewer,
          issuer_id: ids.admin,
          scope: "dashboard_summary",
          reason: "Monthly operations review of delivery load.",
          status: "active",
        },
        {
          org_id: org.id,
          team_id: teamId.dev,
          grantee_id: ids.reader,
          issuer_id: ids.admin,
          scope: "workspace_read",
          reason: "Advisory review of the Q4 engineering plan.",
          status: "active",
          approver_id: ids.devLead,
          decided_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 21 * 86400_000).toISOString(),
        },
        {
          org_id: org.id,
          team_id: teamId.dev,
          grantee_id: ids.expired,
          issuer_id: ids.admin,
          scope: "workspace_read",
          reason: "Security consultant review, finished last week.",
          status: "active",
          approver_id: ids.devLead,
          decided_at: past,
          created_at: past,
          expires_at: new Date(Date.now() - 2 * 86400_000).toISOString(),
        },
      ],
      { defaultToNull: false },
    ),
    "grants",
  );

  const priya = await userClient(USERS.devLead.email, DEV_PASSWORD);
  const leo = await userClient(USERS.dev.email, DEV_PASSWORD);
  const ada = await userClient(USERS.dev2.email, DEV_PASSWORD);
  const rhea = await userClient(USERS.owner.email, DEV_PASSWORD);
  const iris = await userClient(USERS.founder.email, DEV_PASSWORD);

  await seedDeveloperTeam(priya, leo, ada, teamId.dev, ids);
  await seedMainTeam(rhea, iris, teamId.founders, ids);
  await seedRequests(iris, rhea, priya, teamId, ids);

  // 4. Lifecycle fixtures: a removed member and a suspended account.
  must(
    await svc
      .from("team_memberships")
      .update({ active: false, removed_at: new Date().toISOString() })
      .eq("team_id", teamId.dev)
      .eq("profile_id", ids.removed),
    "remove member",
  );
  must(await svc.from("organization_memberships").update({ state: "suspended" }).eq("profile_id", ids.suspended), "suspend");

  console.log(`Seeded QMatus workspace with ${Object.keys(USERS).length} fixture users.`);
  console.log(
    `Sign in at http://localhost:3000 as ${USERS.devLead.email} (password: SEED_PASSWORD or the default in scripts/fixtures.ts).`,
  );
}

async function statusIds(db: Db, team: string) {
  const rows = must(await db.from("task_statuses").select("id, key").eq("team_id", team), "statuses");
  return Object.fromEntries(rows.map((r) => [r.key, r.id])) as Record<string, string>;
}

async function moveTo(db: Db, taskId: string, statusId: string) {
  const t = must(await db.from("tasks").select("version").eq("id", taskId).single(), "task version");
  must(
    await db.rpc("move_task", {
      p_task: taskId,
      p_status: statusId,
      p_after: undefined,
      p_before: undefined,
      p_expected_version: t.version,
    }),
    "move",
  );
}

async function seedDeveloperTeam(priya: Db, leo: Db, ada: Db, team: string, ids: Ids) {
  const s = await statusIds(priya, team);

  const labels = must(
    await priya
      .from("task_labels")
      .insert(["frontend", "backend", "security", "infra", "mobile", "tech-debt"].map((name) => ({ team_id: team, name })))
      .select("id, name"),
    "labels",
  );
  const label = (n: string) => labels.find((l) => l.name === n)!.id;

  const onboarding = must(
    await priya
      .from("projects")
      .insert({
        team_id: team,
        name: "Onboarding v2",
        purpose: "Cut time-to-first-value for new customer workspaces from days to under an hour.",
        lead_id: ids.devLead,
        status: "active",
        health: "at_risk",
        start_date: isoDate(-21),
        target_date: isoDate(24),
        latest_update:
          "Invite flow and workspace templates are in review. Email verification is blocked on the provider sandbox; we expect a decision this week.",
      })
      .select("id")
      .single(),
    "project",
  );
  const reliability = must(
    await priya
      .from("projects")
      .insert({
        team_id: team,
        name: "Platform reliability",
        purpose: "Make failures visible and recoverable before customers notice them.",
        lead_id: ids.dev2,
        status: "active",
        health: "on_track",
        start_date: isoDate(-40),
        target_date: isoDate(45),
      })
      .select("id")
      .single(),
    "project",
  );

  const ms = must(
    await priya
      .from("milestones")
      .insert(
        [
          {
            team_id: team,
            project_id: onboarding.id,
            name: "Invite flow live for pilot customers",
            completion_criterion: "Three pilot workspaces onboard without engineering help.",
            due_date: isoDate(9),
            owner_id: ids.dev,
            position: 1,
          },
          {
            team_id: team,
            project_id: onboarding.id,
            name: "Templates GA",
            due_date: isoDate(24),
            owner_id: ids.dev2,
            position: 2,
          },
          {
            team_id: team,
            project_id: reliability.id,
            name: "Error budget alerts",
            completion_criterion: "Paging alerts fire on SLO burn, not on single errors.",
            due_date: isoDate(18),
            owner_id: ids.dev2,
            position: 1,
          },
        ],
        { defaultToNull: false },
      )
      .select("id, name"),
    "milestones",
  );
  const milestone = (n: string) => ms.find((m) => m.name === n)!.id;

  type Seed = {
    title: string;
    status: string;
    priority: "none" | "low" | "medium" | "high" | "urgent";
    type?: "task" | "bug" | "feature" | "chore" | "research" | "documentation";
    assignee?: string;
    due?: number;
    labels?: string[];
    project?: string;
    milestone?: string;
    blocked?: string;
    description?: string;
    by?: Db;
  };
  const seeds: Seed[] = [
    {
      title: "Invite email: handle expired links with a resend path",
      status: "in_review",
      priority: "high",
      type: "feature",
      assignee: ids.dev,
      due: 2,
      labels: ["frontend", "backend"],
      project: onboarding.id,
      milestone: milestone("Invite flow live for pilot customers"),
      description:
        "When an invite link has expired, show a clear explanation and let the invitee request a fresh link from the inviter.\n\nAcceptance criteria:\n- Expired, revoked and used links each have their own message\n- No workspace details are shown for invalid links\n- The resend request notifies the original inviter",
    },
    {
      title: "Email verification fails in provider sandbox",
      status: "in_progress",
      priority: "urgent",
      type: "bug",
      assignee: ids.dev,
      due: -1,
      labels: ["backend"],
      project: onboarding.id,
      milestone: milestone("Invite flow live for pilot customers"),
      blocked: "Waiting on provider support to enable sandbox webhooks for our account.",
    },
    {
      title: "Workspace templates: seed three starter boards",
      status: "in_progress",
      priority: "medium",
      type: "feature",
      assignee: ids.dev2,
      due: 6,
      labels: ["backend"],
      project: onboarding.id,
      milestone: milestone("Templates GA"),
      by: ada,
    },
    {
      title: "Rate-limit sign-in and password reset endpoints",
      status: "ready",
      priority: "high",
      type: "task",
      assignee: ids.devLead,
      due: 5,
      labels: ["security", "backend"],
    },
    {
      title: "Paging alerts on SLO burn rate",
      status: "in_progress",
      priority: "high",
      type: "feature",
      assignee: ids.dev2,
      due: 12,
      labels: ["infra"],
      project: reliability.id,
      milestone: milestone("Error budget alerts"),
      by: ada,
    },
    {
      title: "Structured request logging with correlation IDs",
      status: "done",
      priority: "medium",
      type: "task",
      assignee: ids.dev2,
      labels: ["infra", "backend"],
      project: reliability.id,
    },
    {
      title: "Move session cookies to __Host- prefix",
      status: "done",
      priority: "medium",
      type: "chore",
      assignee: ids.devLead,
      labels: ["security"],
    },
    {
      title: "Mobile: task list does not reflow at 320px",
      status: "ready",
      priority: "medium",
      type: "bug",
      assignee: ids.dev,
      due: 8,
      labels: ["mobile", "frontend"],
    },
    {
      title: "Investigate slow board load for teams with 500+ tasks",
      status: "backlog",
      priority: "low",
      type: "research",
      labels: ["frontend", "tech-debt"],
    },
    {
      title: "Document the database restore drill",
      status: "backlog",
      priority: "medium",
      type: "documentation",
      assignee: ids.removed,
      labels: ["infra"],
      project: reliability.id,
    },
    {
      title: "Replace hand-rolled date parsing with a tested helper",
      status: "backlog",
      priority: "low",
      type: "chore",
      labels: ["tech-debt"],
    },
    {
      title: "Accessibility pass on the onboarding wizard",
      status: "ready",
      priority: "medium",
      type: "task",
      assignee: ids.dual,
      due: 14,
      labels: ["frontend"],
      project: onboarding.id,
      milestone: milestone("Templates GA"),
    },
    {
      title: "Upgrade the database client and remove deprecated calls",
      status: "in_review",
      priority: "low",
      type: "chore",
      assignee: ids.devLead,
      labels: ["backend", "tech-debt"],
    },
    {
      title: "Spike: offline drafts for task comments",
      status: "backlog",
      priority: "none",
      type: "research",
      labels: ["mobile"],
    },
  ];

  const created: Record<string, { id: string }> = {};
  for (const seed of seeds) {
    const db = seed.by ?? priya;
    const task = must(
      await db
        .from("tasks")
        .insert({
          team_id: team,
          title: seed.title,
          type: seed.type ?? "task",
          priority: seed.priority,
          assignee_id: seed.assignee ?? null,
          due_date: seed.due === undefined ? null : isoDate(seed.due),
          project_id: seed.project ?? null,
          milestone_id: seed.milestone ?? null,
          description: seed.description ?? null,
          blocked: Boolean(seed.blocked),
          blocked_reason: seed.blocked ?? null,
        })
        .select("id")
        .single(),
      `task ${seed.title}`,
    );
    created[seed.title] = task;
    if (seed.labels?.length) {
      must(
        await db.from("task_label_links").insert(seed.labels.map((l) => ({ team_id: team, task_id: task.id, label_id: label(l) }))),
        "label links",
      );
    }
    // Walk the workflow legally to reach the target column.
    const path: Record<string, string[]> = {
      backlog: [],
      ready: ["ready"],
      in_progress: ["in_progress"],
      in_review: ["in_progress", "in_review"],
      done: ["in_progress", "done"],
    };
    for (const step of path[seed.status]) {
      await moveTo(db, task.id, s[step]);
    }
  }

  const invite = created["Invite email: handle expired links with a resend path"].id;
  must(
    await priya.from("task_checklist_items").insert(
      [
        ["Expired link message", true],
        ["Revoked link message", true],
        ["Resend request notifies inviter", false],
        ["Copy review with founders", false],
      ].map(([body, done], position) => ({ task_id: invite, body: body as string, done: done as boolean, position })),
    ),
    "checklist",
  );
  must(
    await leo.from("task_comments").insert({
      task_id: invite,
      body: "Expired and revoked states are in. I kept the copy deliberately vague for invalid tokens so we don't confirm which emails were invited.",
    }),
    "comment",
  );
  must(
    await priya.from("task_comments").insert({
      task_id: invite,
      body: "Good call. Can you add the resend path before this leaves review? It's the most common support question from pilots.",
    }),
    "comment",
  );

  must(
    await leo.from("tasks").insert({
      team_id: team,
      title: "Write copy variants for expired invitation state",
      parent_id: invite,
      assignee_id: ids.dev,
      priority: "medium",
    }),
    "subtask",
  );

  must(
    await leo.from("parking_ideas").insert(
      [
        {
          team_id: team,
          title: "Keyboard shortcut cheat sheet in the command menu",
          body: "Show available shortcuts in the command menu footer so people discover them without docs.",
          tags: ["ux"],
          pinned: true,
        },
        {
          team_id: team,
          title: "Nightly restore test into a scratch database",
          body: "Automate the restore drill so we know backups work before we need them.",
          tags: ["infra", "reliability"],
        },
        {
          team_id: team,
          title: "Preview deployments for every pull request",
          tags: ["infra"],
        },
      ],
      { defaultToNull: false },
    ),
    "ideas",
  );

  must(
    await priya.from("library_items").insert(
      [
        {
          team_id: team,
          title: "Engineering handbook",
          kind: "doc",
          url: "https://example.com/handbook",
          description: "How we plan, review and ship. Start here if you're new.",
          tags: ["onboarding"],
        },
        {
          team_id: team,
          title: "Production runbook",
          kind: "doc",
          url: "https://example.com/runbook",
          description: "Incident response, rollbacks and the restore procedure.",
          tags: ["infra"],
          project_id: reliability.id,
        },
        {
          team_id: team,
          title: "Error tracking dashboard",
          kind: "tool",
          url: "https://example.com/errors",
          description: "Grouped production errors with release markers.",
          tags: ["infra"],
        },
        {
          team_id: team,
          title: "Design tokens reference",
          kind: "link",
          url: "https://example.com/tokens",
          tags: ["frontend"],
        },
      ],
      { defaultToNull: false },
    ),
    "library",
  );
}

async function seedMainTeam(rhea: Db, iris: Db, team: string, ids: Ids) {
  const s = await statusIds(rhea, team);
  const items = [
    { title: "Finalise Q4 hiring plan", priority: "high" as const, assignee: ids.owner, due: 4, status: "in_progress" },
    { title: "Pilot customer feedback synthesis", priority: "medium" as const, assignee: ids.founder, due: 7, status: "ready" },
    { title: "Board update draft for November", priority: "medium" as const, assignee: ids.owner, due: 15, status: "backlog" },
    { title: "Pricing page research", priority: "low" as const, assignee: ids.founder, status: "backlog" },
    { title: "Renew office lease", priority: "medium" as const, assignee: ids.owner, status: "done" },
  ];
  for (const it of items) {
    const db = it.assignee === ids.founder ? iris : rhea;
    const t = must(
      await db
        .from("tasks")
        .insert({
          team_id: team,
          title: it.title,
          priority: it.priority,
          assignee_id: it.assignee,
          due_date: it.due === undefined ? null : isoDate(it.due),
        })
        .select("id")
        .single(),
      "founder task",
    );
    const path: Record<string, string[]> = {
      backlog: [],
      ready: ["ready"],
      in_progress: ["in_progress"],
      done: ["in_progress", "done"],
    };
    for (const step of path[it.status]) await moveTo(db, t.id, s[step]);
  }
  must(
    await iris.from("parking_ideas").insert({
      team_id: team,
      title: "Customer advisory board",
      body: "Five pilot customers, quarterly. Could replace ad-hoc feedback calls.",
      tags: ["customers"],
    }),
    "founder idea",
  );
  must(
    await rhea.from("library_items").insert({
      team_id: team,
      title: "Company OKRs — Q4",
      kind: "doc",
      url: "https://example.com/okrs",
      description: "Company objectives and how we measure them this quarter.",
    }),
    "founder library",
  );
}

async function seedRequests(iris: Db, rhea: Db, priya: Db, teamId: { founders: string; dev: string }, ids: Ids) {
  const submit = async (
    db: Db,
    input: { title: string; problem: string; outcome: string; criteria?: string; priority: "low" | "medium" | "high"; date?: number },
  ) =>
    must(
      await db.rpc("submit_work_request", {
        p_client_key: crypto.randomUUID(),
        p_target_team: teamId.dev,
        p_source_team: teamId.founders,
        p_title: input.title,
        p_problem: input.problem,
        p_outcome: input.outcome,
        p_acceptance_criteria: input.criteria ?? "",
        p_links: "",
        p_requested_priority: input.priority,
        p_requested_date: input.date === undefined ? undefined : isoDate(input.date),
        p_audience: [ids.owner],
        p_as_draft: false,
      }),
      "submit request",
    ) as unknown as string;

  const exportReq = await submit(iris, {
    title: "Pilot customers need a CSV export of their tasks",
    problem: "Two pilot customers asked to pull their task data into their own reporting. Today we export by hand.",
    outcome: "Customers can export their own workspace tasks without contacting us.",
    criteria: "- Export respects the customer's permissions\n- Includes status, assignee and dates\n- Works for up to 5,000 tasks",
    priority: "high",
    date: 21,
  });
  const ssoReq = await submit(rhea, {
    title: "Single sign-on for the enterprise pilot",
    problem: "The enterprise pilot requires SSO before they roll out beyond five users.",
    outcome: "Enterprise pilot users sign in with their identity provider.",
    priority: "medium",
    date: 45,
  });
  const themeReq = await submit(iris, {
    title: "Dark mode for the customer dashboard",
    problem: "Several customers work late shifts and have asked for a dark theme.",
    outcome: "Customer dashboard supports a dark theme that follows the system setting.",
    priority: "low",
  });

  // Export: triaged, accepted with private tasks, then in progress with a published update.
  must(
    await priya.rpc("transition_work_request", {
      p_request: exportReq,
      p_expected: "submitted",
      p_to: "in_triage",
      p_public_summary: "",
      p_reason: "",
      p_committed_priority: undefined,
      p_committed_date: undefined,
    }),
    "triage",
  );
  must(
    await priya.from("work_request_internal_notes").insert({
      request_id: exportReq,
      body: "Reuse the list-view query so export can't drift from what the user can see. Size estimate: one sprint.",
    }),
    "note",
  );
  must(
    await priya.rpc("accept_work_request", {
      p_request: exportReq,
      p_expected: "in_triage",
      p_committed_priority: "high",
      p_committed_date: isoDate(25),
      p_public_summary: "Accepted. We've planned this for the next sprint and will share progress here.",
      p_tasks: [
        { title: "CSV export endpoint scoped to viewer permissions", type: "feature", assignee_id: ids.dev },
        { title: "Export button and progress state in list view", type: "feature", assignee_id: ids.dev2 },
      ],
    }),
    "accept",
  );
  must(
    await priya.rpc("transition_work_request", {
      p_request: exportReq,
      p_expected: "accepted",
      p_to: "in_progress",
      p_public_summary: "Implementation has started.",
      p_reason: "",
      p_committed_priority: undefined,
      p_committed_date: undefined,
    }),
    "start",
  );
  must(
    await priya.rpc("publish_request_update", {
      p_request: exportReq,
      p_summary: "The export endpoint is working in staging. Next: the button in list view and a size limit check.",
    }),
    "update",
  );
  must(
    await iris
      .from("work_request_messages")
      .insert({ request_id: exportReq, body: "Thanks. Could the export include labels too? Both pilots use them for reporting." }),
    "msg",
  );
  must(
    await priya
      .from("work_request_messages")
      .insert({ request_id: exportReq, body: "Yes, labels will be included as a semicolon-separated column." }),
    "msg",
  );

  // SSO: needs information.
  must(
    await priya.rpc("transition_work_request", {
      p_request: ssoReq,
      p_expected: "submitted",
      p_to: "in_triage",
      p_public_summary: "",
      p_reason: "",
      p_committed_priority: undefined,
      p_committed_date: undefined,
    }),
    "triage",
  );
  must(
    await priya.rpc("transition_work_request", {
      p_request: ssoReq,
      p_expected: "in_triage",
      p_to: "needs_info",
      p_public_summary: "Which identity provider does the pilot use, and do they need SCIM provisioning or just sign-in?",
      p_reason: "",
      p_committed_priority: undefined,
      p_committed_date: undefined,
    }),
    "needs info",
  );
  must(
    await priya
      .from("work_request_internal_notes")
      .insert({ request_id: ssoReq, body: "If they need SCIM this is a much bigger job. Don't commit to a date until we know." }),
    "note",
  );

  void themeReq; // stays Submitted, waiting in the intake queue.
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
