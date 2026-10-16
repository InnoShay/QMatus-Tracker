# Qmatus Team Tracker — Final Product & Technical Specification

**Version:** 3.1 — reviewed and hardened baseline with companion UI/UX specification  
**Review date:** 16 October 2026  
**Document status:** Canonical functional, structural, security and implementation baseline. The companion `qmatus_team_tracker_ui_ux_spec_v1.md` defines the visual system and screen-level behavior. Together they are inputs to the final coding-agent prompt.  
**Build assumption:** Completely new application, codebase, database, deployment, and product implementation. No existing source code, migrations, legacy behavior, or repository audit is assumed.  
**Product scope:** Private internal work platform for Qmatus, initially serving the Main Team / Founders and Developer Team.  
**Primary product benchmark:** Linear-like focus and speed, with selected Kanban, project, time-tracking, and collaboration patterns from established tools.

---

## 0. Executive decision

Build a **private, team-isolated, Kanban-first work platform with controlled cross-team Work Requests**. Its purpose is not merely to store tasks. It should help the team decide what work matters, turn requests into clear commitments, make ownership and blockers visible, keep collaboration attached to work, and preserve decisions and history without turning the application into an enterprise suite.

The key design decision is non-negotiable:

> **Founders can commission work from the Developer Team and follow deliberately published progress without automatically gaining access to the private Developer Team workspace. Administrative power, organizational seniority, and content visibility are separate concepts.**

The application will have two private teams at launch:

1. **Main Team / Founders** — founders' internal planning, tasks, decisions, and references.
2. **Developer Team** — developer planning, internal task board, private engineering discussions, time records, and engineering resources.

Cross-team work uses a dedicated **Work Request / Intake** flow. An authorized administrator can grant narrowly scoped access to a specific person when needed. The access grant must be explicit, auditable, time-bounded where appropriate, and revocable.

### 0.1 Review score for Version 2.0

Version 2.0 had strong coverage and a sound product direction, but it was not yet a 10/10 implementation contract. Its calibrated review score is **7.8/10**.

| Review area | V2 score | Why it was not a 10 | V3 correction |
|---|---:|---|---|
| Product problem and team fit | 9.0 | Strong concept; some startup-specific workflows needed clearer prioritization | Define the operating model around intake, ownership, blockers, decisions, and delivery |
| Feature coverage | 8.8 | Broad coverage, but a few human workflows were missing or under-specified | Add intake ownership, request audience, delivery updates, lightweight decision log, and precise notifications |
| Permission semantics | 6.8 | Grant inheritance, admin self-access, requester audience, and time visibility were not fully normative | Define default-deny evaluation order, exact grant scopes, approval safeguards, and sensitive-data boundaries |
| Database integrity | 7.0 | Cross-team project/task/request relationships could be left to application validation alone | Require composite foreign keys/constraints and consistent team/org scope, not only TypeScript checks |
| Stack and data access | 7.2 | Combining a server DAL with service-role access could accidentally bypass RLS | Specify user-scoped Supabase clients for ordinary data access and tightly isolated elevated operations |
| Delivery discipline | 7.2 | Too many P0 modules could encourage a wide but shallow first release | Use vertical slices, release gates, and explicit defer rules |
| Security and operations | 8.0 | Strong foundation, but threat cases such as unsafe URLs, XSS, rate limiting, session revocation, and log integrity needed more detail | Add a practical threat model and secure defaults for sessions, files, rich text, exports, and audit data |
| Testability and acceptance | 7.8 | Good test list, but not enough invariants/property-style coverage and lifecycle rules | Add authorization matrix fixtures, cross-tenant tests, acceptance gates, and failure-path requirements |

The scores are an engineering review judgment, not a scientific measurement. The point is to expose weaknesses before implementation. V3 resolves the identified specification gaps as far as a product document can; correct implementation and testing are still required. No written spec can honestly guarantee that a future implementation will contain zero defects.

### 0.2 Highest-risk loopholes fixed in V3

1. **RLS could be bypassed accidentally.** Ordinary application queries must use a session-bound client that carries the authenticated user's context. Elevated service credentials are reserved for isolated, trusted operations and must never become the default path for task CRUD.
2. **A grant could be broader than its label suggests.** A grant now means exactly its named capabilities and scope; access does not propagate through arbitrary links, related tasks, or dashboard drill-downs.
3. **An admin could quietly expose private content.** No implicit admin content bypass; self-grants are forbidden; high-sensitivity team-wide grants require a second approval; owner overrides create alerts and audit records.
4. **A cross-team relation could leak through database joins.** Every relationship between team-owned objects must prove that its organization/team scope is compatible through database constraints where possible and service validation otherwise.
5. **A request could expose developer internals.** Shared request messages and internal triage notes are separate resources; a shared request never grants access to the private tasks linked behind it.
6. **Time records could become a monitoring feature.** Personal entries and aggregate time summaries have separate permissions; no screenshots, keystrokes, presence scoring, or ranking people by logged hours.
7. **The first release could become unfinishable.** Implement the critical workflows in end-to-end slices. Do not begin optional reporting, AI, external integrations, or advanced automation before the secure tracker is usable.

---

## 1. Product vision and principles

### 1.1 Product outcomes

The product should enable every authorized teammate to answer:

- What should I work on next?
- Who owns this task?
- What does “done” mean?
- What is blocked, why, and who can unblock it?
- What did the team commit to, and what changed?
- Where should I submit new work or ideas?
- Which information is shared with me, and which remains private to another team?
- What decisions and references explain this work?

Success means the team uses this tracker as the source of truth for work execution, instead of duplicating tasks across chat messages, spreadsheets, and informal lists.

### 1.2 Product principles

1. **Privacy is architectural.** It applies to rows, columns, aggregates, relationships, file downloads, notifications, exports, search, activity, and realtime.
2. **Default deny.** Unknown, missing, stale, or ambiguous authorization must deny access rather than guess.
3. **Seniority is not permission.** L0–L5 labels are optional profile metadata only.
4. **One accountable owner per task.** Contributors, reviewers, and watchers are separate concepts.
5. **Request is not commitment.** The receiving team owns triage and confirms the actual priority/date.
6. **Kanban first, not Kanban only.** Board and list are views over the same task records. The list is essential for accessibility and bulk review.
7. **Context stays with the work.** Comments, decisions, blockers, files, and meaningful history are associated with the relevant resource.
8. **Progress, not surveillance.** Measure flow and delivery risk, never keystrokes, screenshots, webcam activity, or individual productivity scores.
9. **Easy by default.** The first-run workflow must work for a small team without complex setup or custom workflow design.
10. **Clear state changes.** A status change, assignment, timer action, request transition, or permission change must be confirmed by the server and visible in history where consequential.
11. **Secure failures.** Access denial and validation failures should be useful without revealing the existence or content of private resources.
12. **Modular monolith first.** One deployable app with clear domain boundaries is the default; no premature microservices.
13. **No fake completeness.** A visible button must work, be clearly disabled with a reason, or be absent. Mock behaviors must not masquerade as shipped features.
14. **Every feature pays rent.** Each module needs a clear team problem, an accountable owner, and a defined success criterion.

### 1.3 Product non-goals

Do not try to replace Slack/Discord, Google Drive, GitHub, HR/payroll, CRM, billing, or a full enterprise portfolio suite. Link to those systems where appropriate. Avoid features that create operational or privacy cost without a demonstrated need.

---

## 2. Research basis and benchmark decisions

The feature choices use patterns documented by established task/project tools and security standards. These sources establish useful patterns, not a requirement to copy every feature.

| Reference | Proven pattern worth learning from | Qmatus decision |
|---|---|---|
| [Linear Teams](https://linear.app/docs/teams) and [Triage](https://linear.app/docs/triage) | Team home, triage before work enters the team's flow, team-specific views and ownership | Use a team-specific home and intake queue; a new request is triaged before it becomes committed engineering work |
| [Jira Kanban / WIP limits](https://www.atlassian.com/agile/kanban/wip-limits/) | Work-in-progress limits reveal bottlenecks and encourage finishing work | Add optional, warning-first WIP limits; never penalize individuals for a team bottleneck |
| [Asana project management](https://help.asana.com/s/article/managing-projects) and [dependencies](https://help.asana.com/s/article/use-dependencies-to-kick-work-off-at-the-right-time) | Dependencies, milestones, status visibility and standardized intake | Include lightweight projects/milestones and task blockers; defer complex portfolio management |
| [ClickUp task model](https://developer.clickup.com/docs/tasks) and [time tracking](https://help.clickup.com/hc/en-us/articles/6304106812823-Track-time-on-tasks) | Task hierarchy and time entries | Add a simple timer/manual entry model only after core work execution is reliable |
| [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects) | One work item shown in board/table/roadmap views | Keep one canonical task record; later link repository activity rather than reimplement source control |
| [Basecamp](https://basecamp.com/) | Simple shared messages, to-dos and project context | Keep communication contextual and lightweight; do not build a general chat product |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [API BOLA guidance](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) | Deny-by-default, every-object authorization, least privilege | Re-authorize every resource operation; guessed or sequential IDs must not grant access |
| [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) | Centralized Data Access Layer, secure server-side checks and minimal DTOs | Use a server-only DAL/domain-service layer and field-allowlisted responses |
| [Supabase secure data](https://supabase.com/docs/guides/database/secure-data), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization) | RLS, least-privilege grants, private channels and protected storage | Make RLS and storage policy part of the first schema migration and test suite, not a final hardening task |
| [PostgreSQL row security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html) | RLS is row-level filtering but does not replace SQL privileges and can be bypassed by privileged roles/table owners | Define database grants as well as policies; isolate privileged credentials and test their behavior |
| [WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) | Dragging must have an accessible alternative | Board moves must work without drag-and-drop, including a click/tap alternative and keyboard operation |

### 2.1 Implications for product design

- An intake queue is as important as the board: incoming ideas and requests need triage before they become promises.
- The product needs one canonical task model with a trustworthy history.
- Status categories should remain consistent even if team labels differ.
- Metrics should reveal flow risks and blocked work, not reward task fragmentation or hours logged.
- Permissions must be part of feature design and database design from day one.
- The right first release is deliberately narrow but complete; “best possible” means dependable and coherent, not the largest feature count.

---

## 3. Organization, teams, and user types

### 3.1 Launch organization

Use one private Qmatus organization/workspace at launch. Keep an organization identifier in the schema to make ownership explicit and prevent accidental cross-workspace joins, but do not build public multi-tenant signup or a workspace marketplace.

Seed two teams at first-run setup:

- **Main Team / Founders**
- **Developer Team**

The schema may support future private teams such as Product, Design, Operations, or Marketing, but those should not be created unless the team needs them.

### 3.2 L0–L5 labels

If Qmatus wants L0–L5 visible, store the level as optional profile metadata. Do not use it in policy functions, database policies, route guards, API filters, or grant evaluation. A user's level must never grant access merely because it is numerically senior.

### 3.3 Authentication versus authorization

- **Authentication** answers: who signed in?
- **Organization membership** answers: is this identity an active member of the Qmatus workspace?
- **Team membership** answers: which private team's content and actions are available?
- **Capabilities/grants** answer: what may the user do to this resource?
- **UI visibility** answers: what navigation makes sense; it is not a security boundary.

An authenticated account with no active organization membership gets no private workspace access.

---

## 4. Roles and permission matrix

Prefer a small set of stable role presets in V1. Do not build a generic custom-role designer until real usage requires it. Fine-grained temporary cross-team access uses explicit grants, not a large matrix of arbitrary custom roles.

### 4.1 Role definitions

| Role | Normal authority | Explicitly does not imply |
|---|---|---|
| **Workspace Owner** | Workspace lifecycle, designated administrators, recovery configuration, final approval of sensitive exceptional access | Automatic read access to every team's private tasks, notes, files, time entries, or board |
| **Workspace Admin** | Invite/deactivate members, create teams, manage ordinary team membership and grants, inspect security events | Blanket content visibility or permission to silently grant access to self |
| **Team Lead** | Manage the assigned team's members when delegated, status workflow, labels, team projects, task assignment and team resources | Access to another team's private content |
| **Team Member** | Create/edit work within their team, comment, assign/reassign where allowed, manage their own time entries | Change their own role, add themselves to a team, or grant themselves access |
| **Requester** | Submit a work request, respond to questions and read the request audience's shared status/updates | Read the target team's board or private task details |
| **Viewer / Guest** | Read only the explicitly granted scope | Any inferred access beyond that scope |

“Requester” is usually a capability assigned to an active workspace user, not a substitute for team membership. A person can be a member of one team and a requester into another team's intake flow.

### 4.2 Capability matrix

This is the default policy. Every operation not explicitly allowed is denied. Team roles do not authorize other teams by implication.

| Capability | Workspace Owner | Workspace Admin | Team Lead | Team Member | Requester | Viewer/Guest |
|---|---|---|---|---|---|---|
| Manage workspace settings | Yes | Delegated | No | No | No | No |
| Invite/deactivate workspace users | Yes | Yes | Only if delegated | No | No | No |
| Add/remove team membership | Yes | Yes | Only assigned team if delegated | No | No | No |
| Read team-private workspace | Only through membership/grant | Only through membership/grant | Own team | Own team | No by default | Only if granted |
| Create/edit ordinary task | Through team membership/grant | Through team membership/grant | Own team | Own team | No; use Work Request | No unless edit granted |
| Manage team workflow/statuses | No by default | No by default | Own team if delegated | No | No | No |
| Submit Work Request | If workspace member | If workspace member | Yes | If enabled | Yes | Only if request capability granted |
| Triage target-team request | Only if member/delegated | Only if member/delegated | Target team | Target team intake permissions | No | Only if explicitly granted |
| Read own time entries | Own entries | Own entries | Own entries | Own entries | Own entries if any | Own entries if any |
| Read team time totals | Only with separate capability | Only with separate capability | If granted by policy | No by default | No | No by default |
| Read audit/security log | Workspace events allowed by admin role | Workspace events | Team events if delegated | Own visible task activity only | Own request history | No unless granted |
| Issue/revoke access grants | Sensitive policy; see §5.4 | Yes within grant policy | No by default | No | No | No |

A member of two teams can use both teams because both memberships are explicit. Being a founder or having a Workspace Owner/Admin role alone does not grant private team content access.

### 4.3 Permission evaluation contract

Every protected operation must apply this evaluation sequence against current authoritative state:

1. Validate the session and resolve the canonical authenticated user ID.
2. Verify the user is active and has active membership in the Qmatus organization.
3. Resolve the canonical resource from the database, including its organization/team ownership. Do not authorize from client-supplied IDs or role strings alone.
4. Determine the exact action (`read`, `create`, `edit`, `delete/archive`, `comment`, `publish update`, `view aggregate`, etc.).
5. Check active team membership/role capabilities or an active grant that explicitly covers this resource and action.
6. Check field-level and workflow constraints, such as a requester not being allowed to edit a committed target date, or a member not being able to edit another user's historical time entry.
7. Apply data-minimization rules and return only fields authorized for the current context.
8. Deny if any required policy is missing, contradictory, expired, or cannot be evaluated. Log security-relevant denials without storing secrets or protected content.

There is no implicit admin override. A role and a grant can combine only by union of their explicitly allowed capabilities; a grant cannot confer the ability to issue grants, change roles, manage membership, or read unrelated resources unless that is a separate named capability.

### 4.4 Grant types and inheritance rules

V1 supports team-targeted grants with a strict, predefined scope:

- **Dashboard summary:** read an allowlisted aggregate dashboard DTO only. No task titles, task IDs, names of private projects, member-level activity, time-entry detail, comments, or drill-down links.
- **Team workspace read:** read the team's regular board/list/task/project/Library/idea content that is available to team readers, but not detailed time entries or restricted security logs.
- **Team collaboration:** workspace read plus allowed comments/replies and reactions where implemented.
- **Team edit:** workspace read plus the exact task/project/resource mutations named in the grant's capability set.
- **Team management:** a separately delegated set of team settings/membership/workflow actions. It never follows from a read/edit grant.

A grant includes grantee, issuer, target team, type/scope, allowed capabilities, reason, created time, optional expiry, optional approval, revoked time, revoker, and related audit event.

**Inheritance rules:**

- A dashboard-summary grant authorizes only the aggregate endpoint/DTO, never the board or task APIs.
- A team workspace grant applies only to resources owned by that team, and only to the named capabilities.
- Links between records do not expand access. A grant to a project does not automatically grant another team's task access through a relation; a link to a Work Request never grants access to private tasks linked behind it.
- A grant expires/revokes centrally; cached UI state, open pages, exports and realtime subscriptions must not preserve usable access.
- If resource-level grants are introduced later, use explicitly typed resource-sharing records and constraints. Do not introduce an unconstrained `target_type + target_id` polymorphic table without integrity enforcement.

### 4.5 Grant issuance and sensitive approval

- The grant issuer must possess an explicit `access_grant.issue` capability.
- A user cannot issue or approve a grant to themselves.
- Dashboard-summary grants may be issued by an authorized Workspace Admin; issuance is logged and is visible in grant history.
- A team-wide private content grant requires approval from the target Team Lead. If no Team Lead is designated, require a second authorized Workspace Owner/Admin approver.
- A grant that would give private content access to a Workspace Owner/Admin also requires a distinct approver; the target cannot approve their own access.
- If an urgent owner override is required, collect a reason, use a short expiry, notify the target team's designated lead/admin audience, and emit a high-priority audit event. It must not be the routine path.
- Any grant is revocable. Expiry is enforced on every request, not by relying solely on a scheduled cleanup job.
- Grant UI must show the exact scope in plain language; never present ambiguous labels such as “admin access” when a narrower scope is intended.

### 4.6 Account suspension and membership removal

When an account is suspended/deactivated or a team membership is removed:

- new reads and writes must be denied promptly based on current database state;
- the provider session should be revoked where supported, with revalidation required on subsequent requests;
- subscriptions must be removed or reauthorized; cached content must be invalidated/refetched;
- the user's historical actor identity must remain on task/activity/audit history;
- their assigned tasks must be reviewed/reassigned through an explicit workflow, not silently deleted;
- active timers must be stopped, or marked for resolution, according to a documented rule;
- pending invites and grants issued to/by that account must be reviewed or invalidated as appropriate.

---

## 5. Work Request / Intake — the controlled cross-team boundary

This is a core product module, not a later add-on. It enables founders to issue work to developers without seeing the developer team's private execution board.

### 5.1 Request lifecycle

Recommended lifecycle:

`Draft → Submitted → In Triage → Needs Information ↔ In Triage → Accepted / Planned → In Progress → Delivered → Closed`

`Declined` is a terminal outcome. A closed request can be reopened only by an authorized actor and with a reason. Team-specific labels may vary, but the underlying state categories and allowed transitions must be defined server-side.

### 5.2 Request content

A request should capture:

- concise title;
- problem/background;
- desired outcome and why it matters;
- acceptance criteria / definition of success;
- requester and explicitly selected request audience;
- target team;
- requested priority and desired date, clearly labelled **requested**, not promised;
- relevant public/team-allowed links and shared attachments;
- status, submission time, last public update and closure reason;
- committed priority/date after the target team accepts/plans the work;
- clarifying questions and published progress updates.

The target team decides whether to accept, decline, ask questions, or schedule it. The team owns the committed priority and target date. A requester's requested deadline must never silently become a developer commitment.

### 5.3 Audience and visibility

- The request creator is always in the request audience while active and authorized.
- Additional origin-team recipients must be selected explicitly or added using a clearly defined team policy. Do not automatically expose every request to every member of the origin team unless the company intentionally chooses that rule.
- Target-team intake members and authorized team members can read the submitted request for triage.
- Only shared request messages, shared attachments, and published status events are visible to the requester audience.
- Developer-only triage notes, internal comments, time entries, private task IDs, linked task titles, board positions, and internal task status details are not returned to requesters.
- If a request is referenced in a notification or search result, it must use the same request audience and current authorization checks.

### 5.4 Internal tasks linked to a request

On acceptance, the developer team may create one or many private tasks. Creation of the tasks, internal relationship links, request status change, activity, and notification-outbox records should be atomic or use a reliable idempotent workflow so retries do not create duplicate task trees.

The request page may publish a summary such as “Accepted”, “Implementation has started”, “Waiting for additional information”, and “Delivered”. The published update is authored deliberately; it is not a mirror of private internal task data. Requesters cannot traverse private links or discover internal task IDs through APIs or relationship counts.

### 5.5 Failure cases

- A request can be submitted even if its requested date is invalid only if validation returns a clear correction; it must not silently coerce dates.
- If the target team is archived/unavailable, the submission must fail safely and tell the user how to proceed without revealing private team information to unauthorized users.
- If the requester loses authorization, they lose access to the request and attachments except for any applicable retention/export policy.
- If a developer task is deleted/archived, the request remains valid and its public history is preserved.
- Duplicate requests should be linkable/markable as duplicates, not silently discarded.
- Notifications and emails must never include private linked task content.

---

## 6. Prioritized feature scope

### 6.1 P0 — Secure daily-work release

All of the following must be implemented as complete, tested vertical slices. It is acceptable to ship them in multiple internal iterations, but not as dead buttons or partially wired screens.

**Foundation and access**
- Invite-only authentication/session flow; invitation accept, expiry, revoke, resend, and error states.
- Organization, private teams, team memberships, role presets, audit events, and scoped team grants.
- Two seed teams: Main Team / Founders and Developer Team.
- Server-side authorization, RLS, database grants, security tests, and an admin-safe grant flow.

**Work execution**
- My Work, team dashboard, Kanban board, list view, task create/edit/detail, status/priority/assignee/due date/type, labels, archive/restore.
- One primary assignee; reviewer/watchers can be added only when their behavior and permissions are implemented.
- One-level subtasks and lightweight checklist items.
- Projects and milestones with a small, defined set of fields.
- Work Request/Intake workflow, internal task linkage and separate internal notes/shared messages.
- Task comments and meaningful activity history.
- Basic in-app notification inbox for assignments, mentions if implemented, request questions/status changes, and task updates the user is allowed to see.

**Knowledge and discoverability**
- Parking Lot for team-scoped ideas, with promote-to-task/request action and source relationship.
- Library of team-scoped reference links/docs/tools; use links first if safe file-upload behavior is not ready.
- Search over permitted task/project/request/idea/Library data.

**Quality baseline**
- Accessible board alternative, responsive layout, loading/empty/error/conflict/forbidden states.
- Schema migrations and seed data, typed validation, logs, automated tests, CI, environment/secret hygiene.
- Backup and restore procedure documented and a first restore test performed before production use.

### 6.2 P1 — Workflow quality after the core release is stable

- Timer and manual time entries, with explicit per-user and aggregate privacy rules.
- Task dependency links and blocker reason, with cycle prevention.
- Watchers/subscriptions, @mentions, review requests, notification preferences and digest/reminder jobs.
- Secure attachments when validation, scanning policy, private storage and download authorization are complete.
- Saved personal/team views, safe bulk actions, WIP warnings, task templates and recurring tasks.
- Project status updates, a lightweight decision log, and definitions-of-done/checklist templates.
- Admin grant review and expiry screens, security event filters, and membership-change workflows.

### 6.3 P2 — Add only after observed use justifies it

- GitHub/GitLab links to PRs/commits and optional state transitions triggered by verified integration events.
- Calendar/deadline view, project timeline, release milestones and additional project summary views.
- Team-level flow analytics: cycle time, throughput, task aging, blocked duration, WIP trends, missed commitments. Define every metric; avoid developer leaderboards.
- Email digests, additional integrations, export tools and more advanced reporting.
- Standardized request forms, approved simple automation rules, richer project templates.
- Optional AI assistance for summarizing discussions or drafting status reports, only with explicit data policy, opt-in, clear provenance, and human review.
- Typed resource-level cross-team sharing if Work Requests and team grants prove insufficient. Add only with a defined visibility model and referential integrity.

### 6.4 Explicitly out of scope unless a new product decision is made

- Public self-registration.
- Employee surveillance (screenshots, keystrokes, webcam, browser tracking, hidden presence collection).
- Productivity rankings based on tasks completed, hours logged, or online status.
- Payroll, attendance, leave management, HR files, billing, invoicing, CRM, or a customer-facing portal.
- Full chat/DM/voice/video suite.
- A generic no-code workflow engine, complex Gantt resource planning, or arbitrarily nested subtasks in V1.
- Premature microservices, global external search infrastructure, and a complicated event bus.
- AI processing of private content without an explicitly approved provider, retention, access and opt-out policy.

---

## 7. Module behavior requirements

### 7.1 Authentication, invitations, and account management — P0

**Requirements**

- Invite-only access. No public self-registration by default.
- Invite email must match the intended identity; invitations expire, can be revoked/rescinded, and must be single-use or otherwise replay-safe.
- Use the auth provider's established invitation/session mechanisms where possible. If a separate invitation record is maintained for team/role provisioning, store only a hashed secret where a secret is needed and validate invite state atomically.
- Rate-limit login, reset, invite creation/resend, request submission and other abuse-sensitive endpoints.
- Use secure, HttpOnly, Secure, appropriately SameSite cookies/session handling as supported by the auth architecture.
- Support sign-in, sign-out, session expiry, recovery, invalid invitation, expired invitation, revoked membership, and deactivation states.
- Profile fields: display name, avatar, timezone, optional title and optional L-level metadata.
- Admins use MFA when supported by the auth provider; make it a launch requirement if the access risk or provider setup makes it practical.
- The first workspace/owner must be bootstrapped securely through a documented one-time setup path, not by an unauthenticated “become admin” route.

**Implementation rules**

- Authentication claims identify the caller but do not replace live authorization checks against membership/grant state.
- Avoid detailed login responses that reveal whether an email exists.
- Verify invitation state server-side and consume it atomically to avoid double acceptance or concurrent role assignment.
- Never store raw credentials or auth tokens in application logs.
- Deactivation must invalidate app authorization immediately even if provider-session invalidation is delayed.

### 7.2 Organization, teams, membership, and grants — P0

- Create/rename/archive private teams, with deletion disabled for normal user flows.
- Add/remove users from a specific team with a team-specific role.
- Permit multiple team memberships only when explicitly assigned.
- Keep the owner/admin permissions and content permissions separate.
- Provide an appropriate “request access” flow that does not confirm the existence or content of a private resource to an unauthorized user.
- Record invitations, membership/role changes, grants, revocations, approvals and privileged settings changes in an append-oriented audit log.
- Team removal must invalidate access to all team-owned resources, files and realtime topics.
- Team archive/restore and future hard deletion need documented handling for tasks, active timers, requests, references and history.

### 7.3 My Work and personal inbox — P0

The page answers “What should I do next?” using only data the current user may access:

- active tasks assigned to me;
- due soon / overdue tasks;
- blocked tasks and their blocker reason;
- tasks waiting for my review or response;
- recent items I follow;
- personal timer state when time tracking is enabled;
- requests I submitted or am explicitly part of the audience for;
- a practical quick-create action inside the current authorized scope.

Do not rank work using opaque AI scoring. Sort/group by simple understandable reasons. “My Work” is a filtered view of canonical records, not a separate task store and not a cross-team bypass.

### 7.4 Team dashboard — P0

The regular team dashboard may show:

- counts by task status category;
- work currently in progress, review and blocked;
- due/overdue work and next milestones;
- active projects and their latest published update;
- recent team activity that the viewer is permitted to see;
- optional WIP warnings once configured.

For `dashboard_summary` grants, use a dedicated server query and DTO with a documented allowlist of aggregate fields. No task-level rows, task names/IDs, private project names, member activity, time entries, comments or hidden drill-down links. Aggregates must not expose a small-group sensitive fact through subtraction or filters; return only approved metrics at a sufficient level of aggregation.

Do not present “online”, “productive”, “slow developer”, or similar individual monitoring metrics.

### 7.5 Tasks and work items — P0

**Core fields**

- internal UUID;
- human-readable team issue key, for example `DEV-0042`;
- organization/team owner;
- title and description;
- task type: Task, Bug, Feature, Chore, Research, Documentation;
- status and priority;
- one primary assignee, creator, optional reviewer, optional watchers;
- optional project, milestone, parent task, start date, due date and estimate;
- labels/tags, blocked flag and reason;
- created/updated/completed/archived timestamps and actor references;
- version field for stale-write detection.

**Core behavior**

- Create from Board, List, My Work, Project and accepted Work Request.
- Search/filter by ID/title/status/assignee/project/priority/type/label/date/blocked state.
- Reassignments preserve history.
- Completion and reopening create activity events; reopening does not erase historical completion.
- Archive preserves the task and history; restore is permission-checked.
- IDs are display references, not secrets, and are never an authorization mechanism.
- Task descriptions/comments must support safe rendering. Markdown or rich text content is sanitized; untrusted HTML is not rendered directly.
- A task normally belongs to exactly one owning team. Cross-team movement is not a casual edit; if added, it is an explicit transaction with reauthorization, membership/assignee/project validation, preserved history, and an audit entry. Defer it in V1 if not required.

### 7.6 Status and transitions — P0

Default task workflow:

`Backlog → Ready → In Progress → In Review → Done`

`Canceled` is a separate terminal alternative. “Blocked” is initially a flag + reason, not necessarily a status column; a task may be in progress and blocked at the same time.

- Each status has a category (backlog, unstarted, started, completed, canceled) and a sort position.
- Allowed transitions are checked by the server; the client cannot invent valid transitions.
- `completed_at` is set when moving to a completed state; reopening preserves the historical event and clears/updates the current completion state consistently.
- In Review can request reviewer action if review feature is enabled.
- Blocked requires a reason; a related blocking task can be linked when dependencies are implemented.
- Canceled tasks are excluded from progress calculations by default and can be filtered in.
- WIP limits warn by default; hard blocks are not initial behavior.
- Status change and order/rank change are distinct mutations so one does not accidentally overwrite the other.

### 7.7 Subtasks and checklists — P0

- **Subtask:** a separately assigned task with its own status, owner, due date, history and comments.
- **Checklist item:** a lightweight step with text, ordering and completion state, no separate owner or comment thread.
- V1 supports one subtask level only.
- Parent and child must have compatible team/project ownership, enforced by database constraints where possible.
- Completing all subtasks may suggest completing the parent, but must not silently mark the parent done unless a deliberate team rule is configured and tested.
- If the parent is archived, define what happens to open children; prefer a warning/review flow to destructive cascading.

### 7.8 Kanban board — P0, primary execution surface

**Functional requirements**

- Columns are generated from the team's configured statuses.
- Cards show a limited set of signals: issue key/title, priority, primary assignee, due/overdue cue, a few labels, subtask progress, and blocker/review/comment indicators when relevant.
- Inline create within a status/column.
- Drag-and-drop with server-authoritative state and rollback if denied or failed.
- **Accessible non-drag alternative:** a click/tap action or menu to move a card, plus full keyboard operability; dragging cannot be the only path. This aligns with WCAG 2.2 dragging-movement guidance.
- Opening a task preserves board scroll, filters, sort, and navigation context.
- Filters/sort by priority, assignee, due date, project, type, label, blocker and status.
- Optional grouping by assignee/project; default grouping is status.
- Saved personal/team views when built; all saved views execute under current permissions.
- WIP count and optional threshold. Show a neutral warning and the limit; do not blame individual contributors.
- If a moved task leaves the current filter, remove it from view with a clear, non-disruptive response.
- Concurrent ordering changes must not produce duplicate ranks or unpredictable jumps; use a tested rank/order strategy and conflict handling.
- Never use client-side optimistic display as evidence that the database accepted a change.

### 7.9 List view — P0

- Same canonical tasks as the board.
- Sortable columns, filters, visible status/priority/assignee/dates, and direct access to task details.
- Bulk actions only for safe, authorized operations; revalidate every row server-side and show partial failures honestly.
- Accessible to keyboard and screen-reader users who find a board difficult to operate.
- Do not expose more fields than the viewer's permission scope allows.

### 7.10 Projects and milestones — P0, lightweight

**Project:** owned by exactly one team in V1, with name, purpose, lead, status/health, start/target dates, archive state, tasks, milestones and a short published update.

**Milestone:** outcome/deliverable, due date, owner (optional), state/order and linked tasks.

Rules:
- Project, milestone and task must share the required organization/team boundary; enforce with composite constraints where possible.
- Progress calculation must be deterministic. Define whether progress is based on completed eligible tasks or milestones and document the chosen rule in product help.
- Handle zero eligible tasks without division errors.
- Canceled/archived tasks are excluded by default; completed/archived milestone behavior must be specified and tested.
- Project health is manually set or calculated from documented thresholds; do not present an unexplained AI score.
- V1 needs an overview and detail view, not an advanced portfolio/Gantt system.

### 7.11 Comments, mentions, reviews and activity — P0 base / P1 expansion

- Comments are attached to a task, project, or Work Request and inherit that resource's privacy boundary.
- Shared Work Request messages and developer-only internal notes are separate permissioned resources.
- @mentions (when shipped) only offer recipients the author is authorized to reference; notifying a person never grants them access.
- Reviewer/watchers are separate from the primary owner.
- Comment edit/delete policy is explicit. If edits are allowed, preserve an edit timestamp and audit the meaningful edit; deletion should use tombstone/retention behavior where required by history policy.
- Task activity is a chronological, append-oriented list of business changes: created, assignment/status/priority/due date changes, comments, blocked/unblocked, relation/milestone changes, archive/restore and completion/reopen.
- Keep audit events (security/administrative operations) logically separate from user-facing task activity.
- Never serialize arbitrary internal metadata into an activity DTO. Use event-type allowlists and field-level rendering.

### 7.12 Notifications — P0 basic / P1 richer

P0 in-app notifications:

- task assignment/reassignment;
- mention or review request if those features are enabled;
- comment/activity on a task a user follows, subject to preferences;
- Work Request clarification and published status updates;
- grant issued, approved, expiring, or revoked where applicable.

P1:

- due-date and stale-blocker reminders;
- daily/weekly digest and notification preferences;
- email delivery with safe content policy.

Rules:
- Notification is a pointer/event, not a permission token. On opening a notification, authorize the target again.
- Delivery workers check the recipient's current active status, permissions and preferences at send time.
- Email subject/body must not leak private task details to requesters, former members, or users with summary-only access.
- Prefer short neutral email alerts containing a safe event label and secure link rather than sensitive content.
- Use idempotency keys so retries do not send duplicates.
- A failed email must not roll back the task update.

### 7.13 Time tracking and estimates — P1

- Start/stop timer on an authorized task; manual time entry if enabled.
- At most one active timer per user across the organization unless a deliberate alternative is approved. Enforce the invariant with a database uniqueness strategy (for example, a partial unique index) and transactional logic, not only UI state.
- Persist timer state server-side so it survives navigation/browser closure; elapsed time is calculated from authoritative timestamps, not a counter running only in the browser.
- Manual entries and corrections require validation and leave an edit/correction event.
- Define how app handles midnight, timezone changes, a stale active timer, task archive, member removal and session expiry.
- Personal time-entry details are visible to the owner and explicitly authorized roles. Team totals require a separate capability; detailed notes are not automatically exposed to anyone with team read access.
- Estimates are optional and not required for every task.
- No mandatory timesheets, billing engine, screenshots, idle detection or employee ranking.

### 7.14 Dependencies and blockers — P1

- Support a small set of relations, starting with “blocks / is blocked by”.
- A task may have a blocked flag/reason even without a linked dependency.
- Prevent self-links and dependency cycles, including concurrent attempts; perform validation transactionally or with an appropriate lock/constraint strategy.
- Deleting/archiving a linked task must not silently erase the history explaining the blocker.
- Show blocker direction and a direct link only when the viewer can read the linked task. If they cannot, show a privacy-safe generic blocker state without disclosing its title or team.
- Do not prevent a developer from moving a task if the policy is warning-only; avoid hard enforcement until a clear workflow is chosen.

### 7.15 Parking Lot / ideas — P0

- Team-scoped idea capture with title, details, tags, creator, state, optional pin, and links/references.
- States such as Captured, Reviewing, Promoted, Archived; keep the set small.
- Search and filtering by state/tag/creator/date.
- Promote an idea to a task or Work Request through an explicit action; preserve the source relationship and do not duplicate details silently.
- Promoting an idea across a team boundary creates a new authorized Work Request rather than moving private idea content into a different team automatically.
- Pinned items are team-level priorities only if the team has agreed to that semantic; pinning does not change task priority.

### 7.16 Library, decisions and project updates — P0 references / P1 structured knowledge

**P0 Library**
- Team-scoped links/resources with title, type (Doc, Link, Image, Tool), description, tags, owner, optional project relation and created/updated metadata.
- Use links first. Private uploads are not considered safe until storage policies, size/type validation and download checks are tested.
- Do not fetch/preview arbitrary submitted URLs server-side in V1; this can introduce server-side request forgery and unsafe-content risks. If URL preview is later added, validate destinations, block private/internal IP ranges, limit redirects/timeouts, and isolate fetches.

**P1 Decision Log**
- A concise, append-oriented decision record: title, context, decision, rationale, date, owner, status (proposed/accepted/superseded), and related project/tasks.
- Decisions are scoped to a team/project. Cross-team sharing is an explicit copy/published summary, not implicit read access.
- Superseding a decision retains the previous entry and points to the replacement.

**P1 Project updates**
- Small update format: current state, what's changed, risk/blocker, next milestone/date, author and timestamp.
- A published update is intentionally shareable; internal task/activity details are not automatically copied into it.

### 7.17 Search and saved views — P0 basic / P1 richer

- V1 search is database-backed or uses a search mechanism that enforces the same authorized scope. Do not create a global index that bypasses resource policies.
- Search results include only fields the viewer can see and support task key/title plus key filters first.
- Search suggestions/autocomplete must obey the same scope as full results.
- Saved views store validated filter/group/sort state, never arbitrary SQL.
- A team view is readable only within that team/grant scope. A personal view follows its owner and does not expose its filter values or hidden resource names to other members.
- A saved view is evaluated against current permissions every time it runs; being able to save a query does not preserve access after revocation.

### 7.18 Templates, recurring work and automation — P1/P2

- Start with fixed built-in task templates and basic reusable checklists.
- Recurring tasks run server-side on a schedule with an idempotency key; a closed browser cannot stop their execution.
- V1 does not need a generic user-authored workflow engine.
- Initial automation candidates: due reminders, recurring maintenance task, stale-blocker reminder, or notification when a Work Request needs a response.
- Each automation must specify trigger, conditions, permitted actions, actor/audit identity, retry behavior, loop prevention and off switch.
- Automation must never bypass data access rules or create a broader grant than the initiating user is allowed to create.

### 7.19 Reports and flow health — P1/P2

Useful team-level metrics may include:

- cycle time and its definition;
- throughput by period;
- WIP by status;
- task aging;
- blocked duration;
- milestone slippage;
- overdue items and unassigned work.

Metric safeguards:

- Define start/end events and timezone rules before exposing the metric.
- Display sample size and date range; suppress misleading percentages for tiny samples where appropriate.
- Do not compare people using task counts or hours, because task size and context differ.
- Avoid a single opaque “productivity score”.
- Reports inherit the same team/grant scope, and exports reauthorize every included row.

### 7.20 Administration, audit, and settings — P0

- Member lifecycle, invitations, team creation, team membership and role presets.
- Grant create/request/approve/revoke/expiry review.
- Team status/label configuration with validation against existing task states.
- User timezone and notification preference settings.
- Administrative/security event history with appropriate visibility.
- Archive/restore controls and a controlled path for exceptional destructive operations.
- No normal UI for arbitrary database mutation or editing audit events.

### 7.21 Integrations — P2

Start with references/links to existing tools. Later integrations can include GitHub/GitLab and calendar/email.

Every integration needs:

- an owner and concrete use case;
- minimum OAuth scopes and securely stored/revocable tokens;
- verified webhook signatures and replay/idempotency handling;
- explicit team/resource mapping;
- a failure/retry policy and visible connection health;
- tests that verify no event causes unauthorized cross-team disclosure;
- a disconnect/delete-token path.

---

## 8. Essential end-to-end workflows

### 8.1 Founder commissions developer work

1. Founder signs in as an active Main Team member.
2. Founder submits a Work Request with outcome, context, acceptance criteria, requested priority/date and explicit audience.
3. The request enters the Developer Team's intake queue; no developer task is created as a commitment yet.
4. Authorized developers triage it, ask questions, accept/decline, and decide committed priority/date.
5. On acceptance, developers create private tasks/subtasks linked internally to the request.
6. The requester sees only shared request messages and published status updates.
7. Developers publish “started”, “waiting for input”, “delivered”, or equivalent updates when useful.
8. Request closure records outcome and retains history.

Acceptance checks: founder cannot access developer board/task IDs/internal notes; developers can use internal detail; request audience can read only the allowed shared surface; notifications leak no hidden data.

### 8.2 Developer executes ordinary work

1. Developer opens My Work or Developer Board.
2. Developer opens a task, confirms the desired outcome and acceptance criteria, and starts work.
3. Task status/assignee/priority changes are validated server-side.
4. Comments, review requests, blockers, dependencies and timer data (if enabled) are recorded against the task.
5. Completion records `completed_at` and an activity event; reopening does not destroy prior history.
6. Board/list/dashboard reflect the canonical state after server confirmation.

### 8.3 Admin grants dashboard summary access

1. Authorized admin selects a target user and team.
2. UI explains “summary only” and lists exactly what the person will see.
3. Admin provides a reason and optional expiry.
4. Server verifies issuer capability, prevents self-grant, validates the target and creates a grant plus audit event.
5. Dashboard uses its allowlisted aggregate DTO. Task detail, board, private names/comments/time entries remain denied.
6. Expiry/revocation stops future access promptly; UI and subscriptions are invalidated.

### 8.4 Admin grants broader team access

1. Admin requests a specific team-wide scope for another person.
2. The target Team Lead approves; if no Team Lead exists, a second authorized Owner/Admin approves. The grantee cannot approve their own access.
3. Grant is created with reason, scope, approver, and optional expiry.
4. All operations remain limited to the recorded capability set.
5. Audit event and notification are emitted; revocation is always available.

### 8.5 Timer lifecycle

1. User starts a timer on an authorized task.
2. Backend transaction checks for another active timer for that user and enforces one active timer globally.
3. Timestamp is persisted; UI derives elapsed time.
4. Stop saves a final timestamp/duration; manual correction creates a history event.
5. If task access is revoked or user is deactivated, the timer is stopped/flagged by a documented rule and cannot continue writing time to inaccessible resources.

### 8.6 Idea becomes executable work

1. User captures an idea inside a team-visible Parking Lot.
2. The team reviews it and decides whether to promote, keep, or archive it.
3. Same-team promotion creates a task and keeps source linkage.
4. Cross-team promotion creates a Work Request, copies only explicitly selected shareable content, and does not expose the origin team's entire idea record.

---

## 9. Functional route inventory (not visual design)

The companion UI/UX specification defines visual layout and navigation hierarchy; this section names functional capabilities, not final screen composition.

### Authentication and onboarding

- Sign in
- Accept invitation / first-run setup
- Recovery and session-expired states
- Invalid/expired/revoked invitation
- No-access / request-access response

### Daily work

- My Work
- Team Dashboard
- Team Board
- Team List
- Task detail/activity
- Projects and project detail
- Milestones
- Work Requests: create, submitted requests, request detail, target-team intake queue
- Notification inbox
- Search results

### Knowledge and planning

- Parking Lot capture/list/detail/triage
- Library list/search/item create/detail
- Decision Log and project update surfaces when P1 is implemented
- Saved views when implemented

### Administration and settings

- Available team switcher
- User/profile/timezone
- Notifications/preferences
- Members/invitations/team membership
- Team roles/workflow/labels
- Access grants and approvals
- Audit/security event history
- Workspace settings and recovery documentation

---

## 10. Recommended technical architecture

This is a recommended default, not a claim that anything has already been implemented. It should be accepted or changed deliberately before coding.

### 10.1 Reference stack

- **Web application:** Next.js App Router, React and TypeScript.
- **Auth/database:** Supabase Auth + PostgreSQL.
- **Data access:** server-only Data Access Layer (DAL) and domain-service/use-case functions.
- **Ordinary reads/writes:** authenticated, session-bound Supabase client carrying the user's JWT so RLS applies.
- **Elevated operations:** isolated server-only client for actions that genuinely require administrative credentials (e.g. certain auth invitations); explicit application authorization is required, credentials are never shipped to browser code, and the scope of these operations is minimized.
- **File storage:** private Supabase Storage buckets and RLS; short-lived signed URLs only after authorization.
- **Realtime:** add only after private channel policies and revocation behavior are tested. Polling/revalidation is acceptable for the first release.
- **Validation:** shared typed schemas, e.g. Zod or equivalent, at all untrusted boundaries; the server is authoritative.
- **Testing:** unit/integration tests, database/RLS tests, end-to-end browser tests and migration-from-empty tests.
- **Hosting:** managed web and database/auth hosting with separate development and production environments; staging is strongly recommended before the first production rollout.

### 10.2 Critical Supabase credential rule

The normal application path must **not** use a service/secret key for routine task, project, request, library or notification CRUD. Such credentials can bypass RLS. Use the signed-in user's context and RLS for normal user-scoped database operations. Only use an elevated server-side path when necessary, and re-check the actor's right to perform that operation before executing it. Keep it in a separate module/API with tests; never expose it in `NEXT_PUBLIC_*` variables or client bundles.

This explicit split closes an ambiguity in Version 2.0. Supabase documents that secret/service-role credentials bypass RLS and must remain server-only: [Secure data](https://supabase.com/docs/guides/database/secure-data), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

### 10.3 Modular-monolith boundaries

Keep one deployable application with domain modules. Suggested structure:

```text
src/
  app/
    (auth)/
    (workspace)/
      my-work/
      teams/[teamSlug]/
        dashboard/
        board/
        list/
        projects/
        requests/
        parking-lot/
        library/
      inbox/
      search/
      settings/
      admin/
    api/                    # webhooks/integrations and stable HTTP endpoints only
  features/
    auth/
    organizations/
    teams/
    access-control/
    work-requests/
    tasks/
    projects/
    milestones/
    collaboration/
    notifications/
    time-tracking/
    parking-lot/
    library/
    decision-log/
    reporting/
    integrations/
  server/
    dal/                    # server-only, session-aware secure data access
    services/               # use cases, transactions, and business rules
    policies/               # central authorization decisions
    audit/                  # append-oriented audit helpers
    notifications/          # outbox/delivery worker
    privileged/              # smallest possible elevated credential boundary
  lib/
    auth/
    db/
    validation/
    errors/
    dates/
    logging/
    env/
  types/
    generated-db-types.ts
supabase/
  migrations/
  seed.sql
  tests/
tests/
  unit/
  integration/
  e2e/
```

Folder names may evolve, but the boundaries must remain: UI is not business logic; domain services enforce rules; DAL centralizes secure queries; database migrations are canonical; policies and tests live alongside the implementation.

### 10.4 Request flow

1. Client submits an action with untrusted input.
2. Server validates input schema and authenticated session.
3. Domain service resolves canonical records and current membership/grants.
4. Policy layer authorizes the exact action and fields.
5. DAL performs the query with a user-scoped client so RLS adds an independent database boundary.
6. Database constraints validate ownership and relationship invariants.
7. Transaction writes the domain change and required activity/outbox record together where possible.
8. Server returns a minimal, type-safe DTO with only allowed fields.
9. UI displays success only after confirmed persistence; on failure it rolls back optimistic UI and shows a truthful response.
10. Any realtime/email job applies the same recipient visibility rules at delivery/read time.

### 10.5 Why not microservices or a custom workflow engine?

For a small team, a modular monolith lowers deployment and debugging burden, allows transactions across closely related records and is easier to test. The app can still have clean domain interfaces and background jobs. Split a service only when a measurable performance, team ownership, compliance or reliability need justifies the added complexity.

---

## 11. Conceptual data model and invariants

The exact SQL schema is finalized in the implementation stage, but the following relationships and invariants are mandatory. Prefer database constraints and foreign keys wherever possible; application-only validation is insufficient for core scope rules.

### 11.1 Identity and authorization entities

- `organizations` — workspace identity and settings; one active Qmatus workspace initially.
- `profiles` — app profile linked one-to-one to the auth provider identity; state, display name, avatar, timezone, optional level metadata.
- `organization_memberships` — organization, profile, org role, active/suspended state and timestamps.
- `teams` — organization ID, name, unique slug, issue prefix, workflow settings and archived state.
- `team_memberships` — team, profile, team role, active/removed state, metadata.
- `invitations` — intended email/team/role, inviter, expiry, acceptance/revoke state and provider invitation reference; avoid keeping a reusable raw invitation secret.
- `team_access_grants` — grantee, issuer, target team, enumerated grant scope/capabilities, reason, expiry/revocation and approval metadata. V1 team-grant targets are explicit FKs, not arbitrary polymorphic IDs.
- `audit_events` — actor, action, target identifiers, relevant organization/team scope, timestamp, request/correlation ID and allowlisted safe metadata.

### 11.2 Work entities

- `team_issue_sequences` or an atomic sequence mechanism — race-safe human-readable keys.
- `task_statuses` — team, label, category, display order, default/terminal metadata and allowed transitions.
- `tasks` — UUID, issue key, organization/team, parent, project/milestone, title/body/type/status/priority, assignee/creator/reviewer, date/estimate/blocker fields, archive/completion metadata, row version.
- `task_labels` + `task_label_links` — team-scoped taxonomy and relation.
- `task_checklist_items` — text/order/completion actor/timestamp.
- `task_dependencies` — source/target task and relation type; prevent self-reference and cycles in service transaction.
- `task_watchers` — task/profile subscriptions.
- `projects` — organization/team, lead, name/purpose/status/health/dates/archival fields.
- `milestones` — project, outcome, due date, state/order, optional owner.
- `task_activity` — append-oriented user-facing business events.
- `task_comments` — task/project-specific comments with explicit author, timestamps and edit/tombstone policy; never mix private developer notes into requester-visible comments.

### 11.3 Work Request entities

- `work_requests` — org, source team, target team, submitter, title/problem/outcome/acceptance criteria, requested priority/date, committed priority/date, request status, timestamps.
- `work_request_audience` — request ID and user ID allowed to read shared request information, including explicit audience changes with audit history.
- `work_request_messages` — shared messages visible to request audience and target intake members.
- `work_request_internal_notes` — separate developer-only resource.
- `work_request_status_events` — state transitions and published summaries.
- `work_request_task_links` — private internal links from request to developer tasks; never expose this relation through requester DTOs.
- `work_request_attachments` — request-shared attachment metadata; private task attachments remain separately scoped.

### 11.4 Operational and knowledge entities

- `time_entries` — user, task, start/stop timestamps, duration/entry type, note, correction/delete metadata; one active timer invariant.
- `notifications` — recipient, safe event type, reference, created/read timestamps and minimum safe metadata.
- `notification_outbox` — retry state/idempotency key/delivery attempt metadata where async delivery is used.
- `notification_preferences` — channels/categories for noncritical notifications.
- `parking_ideas` — team, creator, title/body/state/tags/pinned/promoted metadata and source relation.
- `library_items` — team, title/type/link or private file reference/description/tags/owner/project.
- `decision_records` — team/project, context, decision, rationale, status, owner and supersedes relation (P1).
- `project_updates` — project, author, published summary, risk/next milestone, publication timestamp (P1).
- `saved_views` — owner/team, validated filter/group/sort structure, visibility and schema version.
- `task_templates` — team, name, type and safe task/checklist defaults (P1).

### 11.5 Relationship and database invariants

1. Every private resource has exactly one owning organization and, where appropriate, exactly one team.
2. `team_id` must belong to the specified `organization_id`; enforce that with composite unique/FK constraints or equivalent normalized ownership constraints.
3. A task's project and milestone must belong to the same team/organization as the task. Prefer composite foreign keys such as `(team_id, project_id)` → a unique project key that includes `team_id`.
4. A parent task and subtask must share the same team in V1. A Work Request is the sanctioned cross-team object, not a task with an arbitrary foreign team link.
5. A task assignee must have active membership in the task's team, unless a documented, tested cross-team assignment feature is intentionally added later.
6. Task IDs and human-readable keys are unique under the intended organization/team prefix. Key generation is atomic and server/database-owned.
7. A task's primary assignee is one profile or null. Multi-owner responsibility is not supported.
8. Work Request shared audience and target intake eligibility are checked independently; neither implies private developer task access.
9. A `dashboard_summary` grant can be applied only to a summary endpoint/schema and never becomes a normal team-read grant.
10. A grant references a valid team through a real FK. If resource-level grants are introduced later, model them with typed FK-backed records.
11. Audit rows must not be edited/deleted by ordinary app roles. Retention/cleanup is a controlled administrative procedure.
12. Use foreign keys, uniqueness, check constraints, database transactions and indexes for invariants wherever possible.

### 11.6 Deletion, archive and retention

- Normal user actions use archive/restore for tasks, projects, ideas and references; they do not cascade-delete work history.
- Deactivating a member preserves actor references and historic work.
- A hard-delete/retention policy should be documented before public launch, including attachments and any exported copies.
- Deletion of a team is not permitted until its resources and linked requests have been deliberately archived/moved under a tested process.
- Do not store private comment bodies or full task descriptions in audit metadata merely to preserve history. Store event types and safe field-change summaries as appropriate.

---

## 12. Authorization and database policy architecture

### 12.1 Centralized policy functions

Create tested server-only policy functions such as:

- `canReadTeam(user, team)`
- `canManageTeam(user, team, action)`
- `canReadTask(user, task)`
- `canUpdateTask(user, task, changes)`
- `canReadWorkRequest(user, request)`
- `canSendWorkRequestMessage(user, request)`
- `canPublishRequestUpdate(user, request)`
- `canReadDashboardSummary(user, team)`
- `canReadTimeEntry(user, entry)`
- `canManageGrant(user, target, action)`

The names may change; policies must be centralized and used consistently by every feature. Do not rely on page layouts, client state, role names supplied in the payload, or a hidden navigation link.

### 12.2 Defense-in-depth requirements

**Application layer**

- Authenticate the caller and check live organization/team membership/grants.
- Authorize the requested verb on the canonical resource.
- Validate field-level changes and transition rules.
- Use minimal DTOs and allowlisted event metadata.
- Recheck recipients and resources for notifications, downloads, search and exports.

**Database layer**

- Enable RLS on every exposed private table in the initial migrations.
- Define policies for SELECT, INSERT, UPDATE and DELETE as needed; do not assume a SELECT policy secures writes.
- Apply least-privilege SQL grants as well as RLS. A row policy does not replace SQL privileges and privileged roles can bypass RLS.
- Do not expose internal tables through the public Data API unless required.
- Views must be carefully configured so they do not bypass underlying access policies; for supported PostgreSQL versions, consider `security_invoker = true` where appropriate.
- Review `SECURITY DEFINER` functions for ownership, fixed safe `search_path`, restricted execution privileges and explicit authorization.
- RLS policies must not have an accidental permissive-policy `OR` path that bypasses intended checks. Test each operation as each role.
- Use indexes for policy predicates and common filters. Test query plans as data grows.

### 12.3 Normal versus elevated Supabase operations

**Normal path:** server/user-scoped client with the authenticated user's session/JWT. RLS applies. This is the default for task/project/request/resource CRUD.

**Elevated path:** isolated server-only credentials for provider admin actions or explicitly justified privileged jobs. Each call has a narrow input contract, explicit actor/authorization validation, audit event and tests. It must never be exposed to client code or used as a convenience workaround for a broken RLS policy.

### 12.4 Protected surfaces beyond normal page queries

- **Search/autocomplete:** same resource visibility filter; never global index results leaked by a second query.
- **Counts/metrics:** aggregate-only grant uses dedicated allowlisted DTOs; no hidden details or unsafe drill-down.
- **Notifications:** no permission inheritance; authorize at delivery and open/read time.
- **Files:** private storage and short-lived signed URL after authorization; a URL itself must not become a permanent public capability.
- **Realtime:** private channels/topics only, with database/policy checks. Start with polling/refetch if revocation semantics are not proven.
- **Exports:** authorize each included record, use the same field allowlist, record sensitive export events and short-lived delivery links.
- **Logs:** no secrets, credentials, full private content, or cross-team payloads; restrict log access.
- **Saved views:** filters never expand the owner's current authorization.

---

## 13. API and business-service boundaries

Use domain service/use-case functions as the only place for business mutations. Example operations:

- `createTask`, `updateTask`, `transitionTaskStatus`, `assignTask`, `archiveTask`, `restoreTask`;
- `createProject`, `createMilestone`, `publishProjectUpdate`;
- `submitWorkRequest`, `triageWorkRequest`, `askRequesterForInfo`, `acceptRequest`, `createTasksFromRequest`, `publishRequestUpdate`, `closeRequest`;
- `startTimer`, `stopTimer`, `createManualTimeEntry`, `correctTimeEntry`;
- `createAccessGrant`, `approveAccessGrant`, `revokeAccessGrant`, `expireAccessGrants`, `removeTeamMember`;
- `promoteIdeaToTask`, `promoteIdeaToWorkRequest`, `createLibraryItem`.

These functions own validation, permissions, state transitions, transactions, activity/audit writes, and notification-outbox side effects. Do not duplicate the same business logic independently in a server action and a route handler.

### 13.1 Mutation rules

- Validate all untrusted input on the server using typed schemas.
- Resolve IDs from canonical database records; never trust a submitted `team_id`, `org_id`, `assignee_id`, role or permission array without checking it against the current actor and record.
- Validate state transitions and allowed fields on the server.
- Use a transaction for logically coupled writes (task creation + activity + request link + outbox event where feasible).
- Use idempotency keys for retriable operations, invitation acceptance, timer start/stop where useful, request-to-task creation, scheduled jobs and webhooks.
- Use optimistic concurrency/version checks for stale edits and board ordering.
- Paginate task/activity/search lists; do not return entire workspaces by default.
- Return generic not-found/forbidden responses where distinguishing them would disclose a private resource.
- Use rate limits for authentication, search-heavy operations, invitations, comment creation, request creation, attachment upload and expensive export endpoints.
- Server actions and route handlers are public entry points to untrusted input even if only called by the app UI; authorize each call.

---

## 14. Security threat model and required mitigations

The tracker contains internal business information and potentially sensitive engineering context. Security testing must focus on cross-team and cross-user access, not merely login success.

| Threat / failure mode | Required mitigation and test |
|---|---|
| Guessed task UUID or changed URL exposes another team | Object-level authorization on every read/write; test arbitrary IDs from another team |
| `team_id`, `assignee_id`, role or grant scope tampering | Resolve authoritative relationships on server; DB constraints; negative tests |
| Admin role silently reads all data | No admin content bypass; test admin without membership/grant against every private surface |
| Summary grant drills down into tasks | Separate DTO/query and no hidden links; direct task endpoints remain denied |
| Shared request leaks linked developer tasks | Separate shared request resources from internal notes/task links; test query joins, API responses, notifications and search |
| Realtime subscription continues after revocation | Private channel authorization; revalidation/expiry; remove subscriptions and test revocation timing |
| Service credential bypasses RLS | Keep elevated keys server-only; normal data path uses user's session; static/build secret checks and credential-path tests |
| SQL injection / unsafe query composition | Parameterized queries/SDK filters; never interpolate user input into SQL/order-by expressions |
| XSS in task descriptions/comments/Library | Safe Markdown/rich-text sanitization, output encoding, CSP; no raw untrusted HTML |
| CSRF/session abuse | Provider/Next.js recommended session cookie handling, SameSite protections, origin/CSRF strategy for mutations, secure session rotation/revocation |
| Invitation replay/guessing | Provider invitation flow or high-entropy expiring tokens, atomic consumption, rate limit and replay tests |
| Private attachment URL shared elsewhere | Private bucket, per-record authorization before signed URL, short TTL and revocation plan |
| Unsafe upload or malicious document | Allowlisted file types, size limits, content-type/signature checks, safe download headers, malware scanning or no uploads until scanning/handling is ready |
| URL preview makes server request to internal systems | Do not fetch arbitrary URLs in V1; if added, enforce SSRF-safe egress, IP/redirect allowlists and isolated fetch service |
| Notification or email leaks hidden context | Safe event payloads; authorize recipient at send and open; no private details in email by default |
| Audit log can be tampered with | Append-only app permissions, restricted database privileges, protected retention/export; log security event metadata without sensitive bodies |
| Brute force/spam/notification abuse | Rate limits, invite throttles, input size limits, per-user quotas where appropriate, operational alerts |
| Stale permission cache survives removal | Check current canonical membership/grant state for sensitive requests; short cache lifetime/revalidation; revoke refresh and active subscriptions |
| Cross-organization relation or ID collision | Explicit `organization_id`, composite FK/unique constraints, org-scope RLS and tests |
| Race condition duplicates tasks/grants/timer | Transactions, uniqueness constraints, idempotency keys and concurrency tests |
| Backup exists but cannot be restored | Scheduled backups, documented RPO/RTO, restore drill into non-production environment |

### 14.1 Audit logging policy

Audit security-relevant events such as invitation creation/revocation/acceptance, user deactivation, membership/role changes, grant issuance/approval/revocation, team settings changes, unusual export, privileged access and failed authorization patterns.

- Include actor, action, timestamp, target identifiers, scope, correlation ID and safe metadata.
- Never log passwords, session cookies, access tokens, raw invite secrets or full private note/task bodies.
- Ordinary users/admins cannot edit or delete audit records.
- Define who can read and export audit logs; an admin's ability to manage roles does not imply unlimited access to every team's task comments.
- Do not rely on application logs as the only audit store for privileged changes.

---

## 15. Consistency, background processing and reliability

### 15.1 Data consistency

- Persist timestamps in UTC; render in the user's selected timezone.
- Set `created_at`, `updated_at`, completion timestamps and actor IDs through trusted server/database behavior.
- Assign human-readable issue IDs atomically in the database.
- Treat a status transition and reorder as different actions.
- Define archive/restore behavior for parent tasks, projects, milestones and requests.
- Revalidate active membership/grants at mutation time, not only at login.
- A timer's persisted start/stop timestamps are authoritative.
- Progress, dependency and request state calculations must be deterministic and tested.

### 15.2 Transactions and idempotency

- Task mutation + activity event should commit together where feasible.
- Acceptance of a Work Request and creation of internal task links should be transactional or handled via a durable, idempotent state machine.
- Notification outbox creation should be part of the transaction for the event it represents whenever practical.
- Retried jobs and webhooks must not create duplicate notifications/tasks or duplicate external actions.
- Do not silently retry a non-idempotent action without an idempotency strategy.

### 15.3 Scheduled and asynchronous jobs

Start without a complex event bus. Add a reliable scheduler/worker for grant expiry cleanup, reminders, recurring tasks, email/digest delivery and retries only as needed.

- Expiry is checked on each authorization request; the scheduled job is for cleanup/notifications, not the sole enforcement mechanism.
- Each job records attempts, next run, last safe error category and completion state.
- Retry policy has backoff and a maximum attempt policy; dead-letter/failed jobs are visible to operators.
- A delivery failure never rolls back a committed user action.
- Jobs recheck user/resource authorization at execution time and do not blindly trust an old event payload.

### 15.4 Reliability and user-visible states

Every meaningful screen/action must support relevant states:

- loading/skeleton;
- empty/no results;
- validation error;
- saved/success confirmation;
- permission denied;
- missing/archived resource;
- stale/conflict;
- network/disconnected/retry;
- background action pending/failed where applicable.

An optimistic UI is allowed only with rollback when the server denies/fails. Do not show success before persistence is confirmed. Prevent double-submit where the operation is not naturally idempotent.

---

## 16. Performance, deployment and recovery

### 16.1 Performance principles

- Index real access/query patterns: team/status/updated time, assignee/open state, project/milestone, due date/open state, work request target/status/date, activity parent/time, notifications recipient/read/date, memberships user/team, active timer user.
- Use pagination/cursors for long lists and timelines.
- Avoid N+1 queries for board cards, member data and notification items.
- Optimize only after measuring representative queries; do not build an external search system at launch without evidence.
- Apply indexes to RLS membership predicates and test realistic queries with query plans.

### 16.2 Environment and deployment

- Separate development and production projects/credentials; staging is recommended for releases and migrations.
- Maintain `.env.example` with key names and explanations only; no secrets.
- Validate required environment variables at startup/build.
- Migrations are the sole canonical source of schema changes. Do not depend on undocumented manual production edits.
- CI must run lint, typecheck, unit/integration/security tests, migration-from-empty test and production build.
- Protect production branches, use code review and passing CI before deployment.
- Define rollback strategy for application deploys and forward/backward-compatible database migrations. Avoid destructive schema migration before compatible application code has shipped.
- Use secure headers, a CSP appropriate to the chosen app/deployment, TLS, secret management and dependency update checks.

### 16.3 Backups and recovery

- Set a realistic recovery point objective (RPO) and recovery time objective (RTO) for a small startup; document them, do not merely assume provider defaults are enough.
- Confirm database backup coverage and attachment-storage backup/retention separately.
- Perform an actual restore into a non-production environment before production launch and periodically thereafter.
- Protect backup access separately from app users and log recovery actions.
- Document owner/admin account recovery and provider-console emergency access.

### 16.4 Monitoring and logs

- Structured server logs with request/correlation IDs.
- Track application errors, failed jobs, database policy/test failures, repeated authorization denials, email failure and storage issues.
- Redact tokens, passwords, invite secrets and private work content by default.
- Operational health endpoints must not expose environment configuration, secrets, internal resource identifiers or private workspace state.

---

## 17. Test plan and release gates

The authorization model is not considered tested because a founder can log in and see the right home page. Tests must attempt denied access through alternate routes and direct data requests.

### 17.1 Required security matrix

Create test identities for:

- anonymous visitor;
- Main Team founder/member;
- Developer Team member;
- Developer Team lead;
- workspace admin without developer membership;
- admin who has dashboard-summary grant only;
- user with full team-read grant;
- revoked/expired grant holder;
- removed/deactivated member;
- requester who can view one request but not linked tasks;
- member of two explicitly assigned teams.

For each relevant role, test SELECT/read, INSERT/create, UPDATE/edit and DELETE/archive on all exposed tables/resources and APIs. Use explicit fixture data with unique secret marker strings in private task titles/comments/files, then assert those markers never appear in denied query results, counts, notifications, logs, exports or search.

### 17.2 Required authorization tests

1. Anonymous user cannot read any private workspace data.
2. Developer cannot read Main Team tasks by direct UUID, issue key, URL, search, export or relationship query.
3. Main Team founder cannot read Developer Team board, task, private comments, internal notes, activity, detailed time entries, attachments or hidden project details by default.
4. Admin without team membership/grant cannot read team content through regular app queries.
5. Dashboard-summary grant can read only its allowlisted aggregates; task detail, project names, board columns and task counts that permit re-identification stay denied if not approved.
6. Full team-read grant authorizes only its exact target team/scope and does not allow writes, grant issuance, role change or membership management.
7. Grant issue/approval self-grant paths are denied; a sensitive team-wide grant without second approval is denied.
8. Expired/revoked grants and removed memberships stop access to normal requests, search, signed URL issuance and realtime.
9. Requester reads shared request messages but cannot read internal notes, linked task IDs or developer comments through joins or direct IDs.
10. Altering `org_id`, `team_id`, `project_id`, `assignee_id`, status or role in input cannot cross scope or bypass validation.
11. Search autocomplete, saved views, dashboards, aggregates, task activity, notifications, exports and files all enforce identical visibility rules.
12. A notification created before revocation does not expose content after revocation.
13. Time-entry policies distinguish personal detail from authorized aggregates.
14. RLS/grants are verified for every exposed table and SELECT/INSERT/UPDATE/DELETE operation as applicable.
15. Views, database functions, scheduled jobs and elevated credential paths do not accidentally bypass RLS/authorization.
16. Multiple teams in one organization and a future second organization do not permit cross-scope joins.
17. Audit events exist for privileged changes but contain no secrets or private body content.

### 17.3 Functional and concurrency tests

- Invitation create, accept, expire, revoke and concurrent acceptance.
- Create/assign/status-transition/comment/review/complete/reopen/archive/restore task.
- Board drag and click/tap alternative both work; denied move rolls back.
- Board order is stable on refresh and under concurrent reorder attempts.
- Stale edits return a conflict instead of silently overwriting new values.
- Parent/subtask/checklist progress works according to documented rules.
- Project/milestone calculations handle zero eligible tasks, canceled tasks and archive states.
- Dependency self-link/cycle prevention works under concurrent requests.
- Work Request submit, clarify, accept, private tasks link, publish update, deliver, close and reopen operate idempotently.
- Founder/request audience cannot view linked task IDs or internal notes.
- Timer start/stop survives navigation and prevents two active timers per user; manual corrections leave history.
- Parking Lot promotion preserves origin linkage and respects the target scope.
- Scheduled reminders respect timezone, preference, current authorization and idempotency.
- Archive/restore and membership removal preserve historic actor references.

### 17.4 Accessibility, reliability and quality

- Core flows work using keyboard alone, visible focus, accessible labels, sensible dialog focus, and screen-reader naming.
- Board functionality has a non-drag alternative; test reduced-motion settings once UI is implemented.
- Test common desktop/mobile viewport widths and zoom; no horizontal overflow for essential flows.
- Test the browser refresh/re-login path for all persisted data.
- Failures are truthful and recoverable; no placeholder buttons or fake “saved” states.
- Tests run from a clean database created solely from committed migrations and seed fixtures.
- Typecheck, lint, unit/integration/security tests and production build pass in CI.

### 17.5 Release-gate checklist

Do not call the secure core launch-ready until all are true:

- [ ] Main Team and Developer Team are private and tested.
- [ ] Founder-to-developer requests work end-to-end without board access.
- [ ] Explicit summary and full-team grants behave differently and are revocable.
- [ ] No unreviewed elevated credential path exists for normal CRUD.
- [ ] Database relationships enforce org/team consistency.
- [ ] Access tests pass for both allowed and denied operations.
- [ ] Search, notification, file and aggregate paths have corresponding access tests.
- [ ] Migrations create the environment from empty state.
- [ ] Backup/restore procedure has been exercised.
- [ ] No critical/high security findings remain open.
- [ ] UI supports the core work flow accessibly, not only visually.

---

## 18. Phased implementation plan

The new codebase should be built in verified phases. The coding agent must not generate the entire product in one uncontrolled pass or claim multiple unfinished modules complete at once.

### Phase 0 — Product contract and secure engineering foundation

- Approve this specification, capability matrix, grant semantics and Work Request audience policy.
- Confirm the stack and exact auth/database access pattern.
- Define database entities, constraints, RLS policy plan and migration conventions.
- Bootstrap a fresh repository, environment validation, typecheck/lint/test/build scripts, CI and safe seed fixtures.
- Implement initial workspace/bootstrap path and test users for Main Team/Developer Team.
- Write representative permission tests before adding broad CRUD.

**Exit gate:** clean migration + seeded workspace; base authentication works; private team data is inaccessible without explicit rights; ordinary data access uses the user-scoped RLS path.

### Phase 1 — Authorization and private team skeleton

- Invite-only authentication, profile, workspace membership, private teams, team roles and access-grant request/approval lifecycle.
- Central policy functions and RLS for initial tables.
- Team switching based only on explicit membership/grants.
- Audit trail for all membership/role/grant changes.

**Exit gate:** cross-team negative tests pass across route/API/database; admin without content grant cannot access private team data.

### Phase 2 — Core task engine and Kanban

- Tasks, issue key generation, status workflow, priority/assignment/due dates, comments, activity history and archive/restore.
- One-level subtasks/checklists.
- Board/list using the same task records, filters, keyboard/click alternative to dragging, concurrency/error behavior.
- My Work and team dashboard.

**Exit gate:** ordinary task lifecycle is complete; board changes persist reliably; all direct-ID and team-boundary tests pass.

### Phase 3 — Projects and controlled Work Requests

- Projects/milestones and deterministic progress rules.
- Request create/triage/clarification/accept/decline/commitment/publication/closure.
- Separate shared request discussion and private internal notes/tasks.
- Atomic/idempotent request-to-private-task workflow.

**Exit gate:** founder commissions and tracks work; developers execute privately; all shared/private message and relationship tests pass.

### Phase 4 — Daily collaboration and knowledge

- Notification inbox, contextual comments/mentions if enabled, Parking Lot, Library, search and activity timelines.
- Each module receives matching permission tests, empty/error states and responsive/accessibility validation.

**Exit gate:** team can use the product for normal daily work without a second tracker for the agreed core scope.

### Phase 5 — Time, dependencies and workflow polish

- Timer/manual time entries with defined privacy; dependencies; WIP warnings; saved views; basic templates; reminders and grant expiry jobs.
- Add private attachments only after security and storage requirements are fulfilled.

**Exit gate:** timer concurrency, dependency cycle prevention, scheduled-job idempotency and access tests pass.

### Phase 6 — Insights and integrations

- Decision Log, project updates if not completed earlier, flow metrics, email digest, GitHub/GitLab integration and optional approved AI assistance.
- Implement only features with an owner, measurable purpose, access/data policy and failure behavior.

**Exit gate:** every expansion feature has a test plan, permission boundary, disconnect/disable path and clear support/ownership.

---

## 19. Definition of done

A module is not done because its page renders or its code compiles. It is done when all relevant conditions below are met.

### Product

- The intended user can complete the main workflow without confusing steps.
- The feature has empty, loading, error, success, validation, forbidden and conflict behavior as relevant.
- Data persists through refresh/re-login.
- Board/list/detail views reflect the same canonical state.
- Historical events explain meaningful changes.
- The resource is discoverable only by its authorized audience.
- All visible controls work or are clearly disabled with a reason.

### Security

- Every server entry point authorizes the canonical resource/action.
- RLS and SQL grants are tested for all exposed table operations.
- No elevated secret is present in the client bundle, source control or public environment variables.
- Cross-team and cross-organization data cannot leak through joins, relationships, notifications, files, search, counts, activity, reports or exports.
- Grant expiry/revocation and membership removal are enforced at request time.
- Sensitive administration leaves a protected audit event.

### Engineering

- Typecheck, lint, unit/integration/security tests and production build pass.
- Database can be built from scratch using committed migrations and tests.
- Domain logic is not duplicated between route handlers/server actions/client components.
- Transactions/idempotency cover operations likely to be retried.
- No unresolved critical/high security findings remain.
- Setup, deployment, migration, backup/restore and troubleshooting documentation is accurate.

---

## 20. Decisions locked for implementation and UI/UX

The companion UI/UX specification defines visual identity, layout, navigation and motion, and implementation must not weaken these product or security contracts.

1. Fresh codebase, database, and deployment; no legacy audit or migration work.
2. Two private launch teams: Main Team / Founders and Developer Team.
3. L0–L5 metadata never grants permissions.
4. Workspace Owner/Admin has no automatic private-content bypass.
5. Team membership is explicit; multiple team membership is allowed only by explicit assignment.
6. Founders submit developer work through Work Request/Intake by default.
7. Request audience and target team can see shared request content; private developer tasks/notes/time details remain private.
8. The target team owns triage and decides committed priority/date.
9. Dashboard-summary grant is distinct from team workspace read/edit.
10. Grants have exact scopes, reason, issuer, timestamp, optional expiry, approval rules, and revocation.
11. No self-grants; broader private access requires second approval.
12. One primary assignee per task; reviewer/watchers are separate.
13. Kanban is the primary execution view; Board/List/My Work share canonical tasks.
14. A board action must have a non-drag alternative and work by keyboard.
15. Subtasks are one level in V1; checklists are lightweight steps.
16. Blocker is initially a flag/reason, not necessarily a status column.
17. Time tracking is P1, with personal detail and team aggregate permissions separated.
18. Normal data requests use the authenticated user's Supabase context and RLS; elevated operations are isolated and audited.
19. Cross-team object relationships are constrained in the database; application checks alone are not enough.
20. Work Request internal notes and shared messages are different access-controlled resources.
21. Parking Lot and Library are intentional product modules, not inherited legacy implementations.
22. No surveillance metrics, unnecessary HR/chat suite, premature microservices, or speculative AI.
23. Accessibility, loading/error/conflict behavior, security tests and operational recovery are product requirements, not polish tasks.
24. The final coding master prompt must instruct the coding agent to implement phase-by-phase, inspect its own changes, run the defined tests, and report honestly what passed/failed.
25. The visual system, themes, screen hierarchy, component behavior, motion rules and UI review gates are defined in `qmatus_team_tracker_ui_ux_spec_v1.md`; it is a mandatory companion, not an optional inspiration board.
26. The functional/technical specification owns domain truth, access control, data boundaries and security. No visual or interaction choice may weaken those requirements.
27. For any conflict between documents, enforce security/privacy and functional correctness first; then preserve the approved visual tokens and interaction patterns where compatible. Document the conflict rather than silently omitting a requirement.

---

## 21. Current research sources

This section links to source material that informed the specification. Product docs change over time; verify exact API syntax and provider configuration against the current documentation when implementation begins.

### Team work, triage, boards and projects

- Linear Teams: https://linear.app/docs/teams
- Linear Triage: https://linear.app/docs/triage
- Linear workflows/status categories: https://linear.app/docs/configuring-workflows
- Atlassian WIP limits: https://www.atlassian.com/agile/kanban/wip-limits/
- Asana project management: https://help.asana.com/s/article/managing-projects
- Asana dependencies: https://help.asana.com/s/article/use-dependencies-to-kick-work-off-at-the-right-time
- Asana timeline: https://help.asana.com/s/article/plan-and-execute-projects-with-timeline?language=en_US
- ClickUp tasks: https://developer.clickup.com/docs/tasks
- ClickUp time tracking: https://help.clickup.com/hc/en-us/articles/6304106812823-Track-time-on-tasks
- GitHub Projects: https://docs.github.com/en/issues/planning-and-tracking-with-projects
- Basecamp: https://basecamp.com/

### Security, authentication and database

- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP API Security 2023 — Broken Object Level Authorization: https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Next.js Authentication Guide: https://nextjs.org/docs/app/guides/authentication
- Supabase Server-Side Auth / SSR: https://supabase.com/docs/guides/auth/server-side
- Supabase Users and invitation flow: https://supabase.com/docs/guides/auth/users
- Supabase secure data: https://supabase.com/docs/guides/database/secure-data
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Column Level Security: https://supabase.com/docs/guides/database/column-level-security
- Supabase Realtime authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase Storage bucket security: https://supabase.com/docs/guides/storage/buckets/fundamentals
- PostgreSQL 18 Row Security Policies: https://www.postgresql.org/docs/18/ddl-rowsecurity.html
- WCAG 2.2 / dragging movements: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/

### UI/UX design, taste, motion and accessibility

- Qmatus UI/UX Design System & Screen Specification: `qmatus_team_tracker_ui_ux_spec_v1.md`
- Taste Skill v2: https://github.com/Leonxlnx/taste-skill (use anti-generic review principles; upstream explicitly excludes dashboards/app screens from its direct scope)
- Emil Kowalski `emil-design-eng` skill: https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md
- Emil Kowalski Animations on the Web: https://animations.dev/
- Impeccable design skill: https://impeccable.style/
- Linear display options: https://linear.app/docs/display-options
- Linear issue selection and keyboard actions: https://linear.app/docs/select-issues
- Atlassian color foundations: https://atlassian.design/foundations/color/
- Radix UI accessibility: https://www.radix-ui.com/primitives/docs/overview/accessibility
- Motion for React accessibility: https://motion.dev/docs/react-accessibility
- WCAG 2.2: https://www.w3.org/TR/WCAG22/

---

## Companion UI/UX specification

The functional contract above is paired with `qmatus_team_tracker_ui_ux_spec_v1.md`. That document locks the Quiet Precision design direction, independently composed Light/Dark themes, color and typography tokens, navigation hierarchy, screen behavior, Kanban presentation, Work Request surfaces, motion principles, responsive rules, accessibility standards and visual quality gates. The final coding prompt must read both documents and must not treat the UI/UX specification as permission to change team isolation or authorization semantics.

---

## Final recommendation

Build a **secure, private, team-isolated work tracker** whose daily workflow is exceptionally good: create a clear task, assign one accountable owner, move it through a readable Kanban board, expose blockers, keep collaboration attached to work, and retain the decisions and history that explain delivery.

The distinctive feature is not the board alone. It is the combination of a **controlled Work Request boundary**, real team privacy, clear ownership, low-friction execution and explicit access grants. The founder can ask for and track the outcome of developer work without silently entering the private Developer Team workspace. The developer can do real execution work without unrelated people browsing the internal board. An authorized exception exists when needed, but it is deliberate and auditable.

Do not try to build every P1/P2 feature at once. Implement the secure data model and permission tests first, then ship complete end-to-end vertical slices. A narrow, reliable first release is better than a visually impressive product with broken authorization or half-working workflows. The visual identity and detailed screen behavior are locked in the companion UI/UX specification; they express this contract and must not redefine it.
