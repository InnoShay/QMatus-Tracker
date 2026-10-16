# Implementation plan and status

Status values: **Done** (implemented and tested) · **Partial** (implemented, some
verification missing) · **Blocked** (needs external configuration) · **Deferred**
(deferred by the spec, or explicitly out of this session) · **Not built**.

## Phases

| Phase | Scope | Status |
| --- | --- | --- |
| 0 Foundations | Specs read; skills installed and applied; Next 16 + Supabase scaffold; tokens, fonts, themes; env validation; migrations from empty; seed; lint/type/test/build scripts | Done |
| 1 Identity and privacy | Invite-only auth, invitations, sign-in/out, recovery, org/teams/memberships, grants with second approval, audit, RLS, team switcher | Done |
| 2 Tasks | Task model, keys, workflow, board (drag, keyboard, menu), list (sort, bulk), panel and page, comments, checklist, subtasks, labels, archive, My Work | Done |
| 3 Projects and Work Requests | Projects/milestones/progress/health; request submit/draft/triage/needs-info/accept with private tasks/publish/deliver/close/reopen/decline; shared vs internal separation | Done |
| 4 Collaboration and knowledge | Inbox (non-leaking), Parking Lot with promotion, Library (links), scoped search, admin/settings | Done |
| 5 P1 workflow quality | Time tracking (timers, manual entries, corrections, My Time, lead totals); task dependencies/blockers | Done |
| 5 P1 workflow quality (rest) | Saved views, reminders, grant-expiry job | Deferred (see below) |
| 6 P2 | Integrations, reports, AI | Deferred by spec |

## Requirement matrix (P0, spec §6.1)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Invite-only auth; accept, expiry, revoke, resend (re-invite revokes the previous one), error states | Done | `foundation.sql` invitation RPCs; e2e "invitations"; DB anon sign-up test |
| Recovery (password reset) | Partial | `/forgot-password` → Supabase mail (Mailpit locally) → `/auth/callback` → `/reset-password`; not covered by an automated test |
| Org, private teams, memberships, role presets, audit | Done | DB tests; admin pages |
| Scoped grants: summary vs content, second approval, no self-grant, expiry, revocation | Done | `team-isolation.test.ts` grants block; e2e summary-only |
| Server authz, RLS, SQL grants, security tests | Done | 68 DB tests as 12 identities + anon (38 P0 + 16 time tracking + 14 dependencies) |
| My Work | Done | grouped by due, review queue, followed requests, in-place panel |
| Team dashboard (aggregates, summary DTO) | Done | Redesigned 2026-10-16 (D-030): flow chart, tiles, queue, projects, milestones, attention; `team_dashboard_summary` for summary-only; e2e `dashboard.spec.ts` (working-day simulation, role views, render tour) |
| Kanban board (+ non-drag + keyboard) | Done | e2e menu move, keyboard drag, illegal transition |
| List view (sortable, bulk with partial failures) | Done | `task-list.tsx`, `bulk-actions.ts`; e2e list persistence (bulk not e2e-tested) |
| Task create/edit/detail, status/priority/assignee/reviewer/due/type, labels, archive/restore | Done | panel and page; DB integrity tests |
| One-level subtasks, checklists | Done | DB test "one level"; UI in the panel |
| Projects and milestones with deterministic progress | Done | `progress.ts` unit-tested |
| Work Request workflow with internal notes and links | Done | `work-requests.test.ts` (11 tests); e2e boundary journey |
| Comments, activity history | Done | author-only edit, tombstones (DB test); activity rendered in plain language |
| In-app notifications | Done | pointer-only rows; RLS recipient-only (DB test); revoked → "no longer available" |
| Parking Lot with promotion (same team → task; other team → new request) | Done | UI; same-team promotion uses an RPC; not e2e-tested |
| Library (links) | Done | http(s) only (DB CHECK + Zod); no fetching |
| Scoped search | Done | DB tests that markers never leak; e2e admin search |
| All UI states: loading, empty, filtered-empty, error, forbidden, conflict | Partial | built: static shape-matched skeletons (workspace, board), empty/filtered-empty, error boundary, not-available, conflict; offline drafts are not preserved |
| Responsive, both themes, accessibility baseline | Partial | dark is the default (D-028); render tour asserts no console errors and no horizontal overflow for 5 roles × both themes × desktop/mobile; contrast unit-tested from the real tokens; screen-reader and zoom not manually verified |
| Migrations, seed, CI-ready scripts | Done | `npm run check`, `test:db`, `test:e2e` (no CI config committed) |
| Backup and restore drill | Blocked | needs a hosted Supabase project |

## P1 time tracking (spec §7.13, §8.5)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Start/stop timer on an authorized task; server-side state; elapsed from server timestamps | Done | `start_timer`/`stop_timer`/`current_timer`; task detail "Your time"; e2e reload keeps the timer running |
| At most one running timer per user, enforced in the database | Done | partial unique index + per-user advisory lock; DB tests "two concurrent starts" and "same task is idempotent" |
| Manual entries with validation; corrections with history; soft delete | Done | `add_time_entry` (idempotent request id), `correct_time_entry` (version-checked), `time_entry_events`; DB + e2e |
| Owner-only visibility; team totals as a separate capability via aggregate only | Done | RLS `user_id = auth.uid()`; `team_time_totals` lead-only, suppressed under 3 people; DB tests for member, lead, admin, owner, read grant |
| Stop/flag rule on revocation, suspension, archive; documented midnight/time-zone/stale/session rules | Done | triggers + lazy settle; DECISIONS D-023; DB tests for removal, suspension, archive, grant revoke and grant expiry |
| My Time view; no surveillance metrics | Done | `/my-time` (own entries by day, running timer, correct/delete); nav "Running" dot; no per-person or ranking views |
| Estimates | Partial | `estimate_points` column exists from P0; no estimate UI was added in this slice |
| Timer start/stop shortcuts, global header timer widget | Not built | the sidebar shows a "Running" marker on My Time instead |

## P1 dependencies and blockers (spec §7.14)

Migration `20261016000600_task_dependencies.sql`; DECISIONS D-025–D-027.

| Requirement | Status | Evidence |
| --- | --- | --- |
| "Blocks / is blocked by" relation, shown and edited in the task detail | Done | `get_task_dependencies`, `add_task_dependency`, `remove_task_dependency`; "Dependencies" section (link by task key); e2e "task dependencies" |
| Blocked flag/reason without a link | Done | unchanged P0 flag; links and the flag are independent |
| No self-links or cycles, including concurrent attempts | Done | CHECK + per-org advisory lock + recursive check in the insert trigger; DB tests for 2-task loop, 3-task loop and two concurrent opposite links |
| History survives removal and archive | Done | soft removal (`removed_at`/`removed_by`), delete forbidden even for the owner role, `dependency_added`/`dependency_removed` activity on both tasks; archived blockers stay linked and count as resolved (DB tests) |
| Direct link only when the viewer can read the other task; generic state otherwise | Done | hidden end returns no id/key/title/team; activity resolves keys under RLS; DB test with a Founders blocker seen by a Dev member; e2e asserts the title and key never render |
| Warning-only (no hard enforcement) | Done | `move_task` untouched; detail says "You can still move this task"; DB test moves a blocked task |
| Board cue | Done | `task_blocker_counts` → `openBlockers` on cards (board, and the "Blocked" filter also matches); list rows and My Work rows show only the manual flag |
| Who may edit links | Done | write access to the task being edited + read access to the other end; removal needs write access to either end; read-grant holder refused (DB + e2e) |
| Other relation types ("relates to", "duplicates"), stale-blocker reminders, blocked-duration metrics | Not built | spec says "starting with" blocks; reminders/reports are separate P1/P2 items |

## Deferred or not built in this session

- **P1:** watchers and preferences,
  saved views, templates, recurring tasks, reminders and the scheduled grant-expiry job.
  Expiry is already enforced on every request; the job would only notify.
- **P1:** the decision log and structured project updates (projects have a single
  latest-update field).
- **Not built:** file uploads (deliberately links-only), single-key keyboard shortcuts,
  a shortcut help surface, MFA.
- **P2 (by spec):** GitHub/GitLab, email digests, reports, AI.

## Blocked by external setup

- A hosted Supabase project (staging and production) for deployment, SMTP, MFA and the
  backup/restore drill. Nothing was deployed or created in the cloud.

## Verification commands (all run in this session; see the final report for results)

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run format
```

```bash
npm test
```

```bash
npm run test:db
```

```bash
npm run test:e2e
```

```bash
npm run build
```
