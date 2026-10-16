# Security model

Implements spec §3–5 and §12–14. The database is the enforcement point; application
policies decide what to offer and produce non-revealing errors.

## Principles as implemented

| Principle | Where it is enforced |
| --- | --- |
| Default deny | `alter default privileges … revoke` for `anon`/`authenticated`; RLS on every table; each grant is explicit in the migrations |
| Admin ≠ content access | `app.can_read_team` checks membership or content grant only; admins cannot add themselves to a team (`admin_add_team_member`) or grant themselves access (`issue_grant`, CHECK constraint) |
| Seniority ≠ permission | `profiles.level` is never read by any policy or function |
| No self-grants / second approval | CHECK `grantee_id <> issuer_id`, approver ≠ grantee/issuer; `issue_grant` makes content grants `pending`; `app.can_approve_grant` = team lead, or another admin only if the team has no lead |
| Expiry/revocation on next request | Helpers compare `expires_at > now()` and `status = 'active'` on every call; no cache of permissions |
| Removal/suspension on next request | Helpers require `team_memberships.active` and `organization_memberships.state = 'active'`; suspension also revokes provider sessions |
| Cross-team integrity | Composite FKs include `team_id` for project, milestone, parent, assignee, reviewer, labels, checklist, comments, activity, request task links, both ends of task dependencies |
| Non-revealing errors | `42501`/`P0002` map to one generic message; unknown and private team URLs render the same "not available" page |
| Append-only audit | No grants for UPDATE/DELETE, plus triggers that reject UPDATE/DELETE/TRUNCATE even for the owner role |

## Roles and capabilities

| Capability | Owner | Admin | Team lead | Team member | Requester (any member) | Summary grant | Read grant | Collab grant | Edit grant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Read team workspace | via membership/grant | via membership/grant | own team | own team | — | — | ✓ | ✓ | ✓ |
| Comment | ″ | ″ | own team | own team | — | — | — | ✓ | ✓ |
| Create/edit tasks, projects, ideas, library | ″ | ″ | own team | own team | — | — | — | — | ✓ |
| Triage Work Requests | ″ | ″ | own team | own team | — | — | — | — | — |
| Submit Work Requests | ✓ | ✓ | ✓ | ✓ | ✓ (`can_request`) | | | | |
| Team summary counts | ″ | ″ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Log own time (timer, manual, correct) | ″ | ″ | own team | own team | — | — | — | — | ✓ |
| See task dependencies | ″ | ″ | own team | own team | — | — | ✓ | ✓ | ✓ |
| Add/remove task dependencies | ″ | ″ | own team | own team | — | — | — | — | ✓ |
| Read time entries | own only | own only | own only | own only | own only | own only | own only | own only | own only |
| Team time totals (aggregate) | — | — | own team | — | — | — | — | — | — |
| Invite/suspend, manage membership | ✓ | ✓ (not self, not admins unless owner) | — | — | — | — | — | — | — |
| Issue grants | ✓ (never self) | ✓ (never self) | — | — | — | — | — | — | — |
| Approve content grants | if no team lead | if no team lead | own team (not if issuer/grantee) | — | — | — | — | — | — |
| Revoke grants | ✓ | ✓ | own team | — | — | — | — | — | — |
| Read audit log | workspace | workspace | own team's events | — | — | — | — | — | — |

"Team management" grants (spec §4.4) are deferred and not representable (DECISIONS D-007).

## Work Request boundary

- Shared tables: `work_requests`, `work_request_audience`, `work_request_messages`,
  `work_request_status_events` (requester-safe by construction).
- Internal tables: `work_request_triage`, `work_request_internal_notes`,
  `work_request_task_links` — readable only by readers of the receiving team.
- `app.can_read_request` = submitter, explicit audience, or receiving-team reader.
  Drafts are visible to the submitter only.
- Linked private tasks stay under task RLS. Requesters see published status events with
  the team (not individual developers) as author, and requester-facing labels.

## Time tracking (P1)

- `time_entries` and `time_entry_events` have one SELECT policy each: `user_id = auth.uid()`
  (entries also require an active org membership). No role — lead, admin, owner, grant
  holder — reads another person's rows or notes. There are no INSERT/UPDATE/DELETE grants;
  all writes go through `start_timer`, `stop_timer`, `add_time_entry`,
  `correct_time_entry`, `delete_time_entry` (SECURITY DEFINER, caller-authorized,
  serialized per user by an advisory lock, history written in the same transaction).
- Logging requires `app.can_write_team` on the task's team. Unknown and unreadable tasks
  both return `P0002` with the same message; readable read-only tasks return `42501`.
- Composite FKs tie each entry to a task of the same team, the team to the org and the
  user to an org membership. A partial unique index allows one running timer per user;
  an exclusion constraint prevents overlapping live entries.
- Team totals: `team_time_totals` only for the team's lead, one suppressed aggregate
  (DECISIONS D-022). It is the only way team-level time leaves the table.
- Stop rule on revocation (D-023): triggers on membership, org state, grant status, task
  and team archive stop running timers; grant expiry is settled lazily at the expiry
  instant on the next time operation or render.
- No surveillance: no screenshots, idle detection, activity scoring, per-person team
  views, rankings or mandatory timesheets. Personal time is not copied to `audit_events`.

## Task dependencies (P1)

- `task_dependencies` stores both ends as composite `(team_id, task_id)` FKs plus
  `(org_id, team_id)` FKs to teams, so a link can't cross organizations or name the
  wrong team for a task.
- No INSERT/UPDATE/DELETE grants. `add_task_dependency(task, other_key, direction)`
  needs `app.can_write_team` on the task being edited and `app.can_read_team` on the
  other task; an unknown key, a key in another org and a task in an unreadable team all
  return the same `P0002` message. `remove_task_dependency` needs write access to
  either end (so a team can clear a link to a task it can't see).
- Direct SELECT on the table requires reading **both** ends. The task detail uses
  `get_task_dependencies(task)` (SECURITY DEFINER, requires reading that task), which
  returns the other end's id/key/title/team/status only when the caller can read it;
  otherwise only `visible = false`, direction, `resolved` and the link time (D-025).
  `task_blocker_counts(ids)` counts open blockers for tasks the caller can read.
- Activity rows store the other task's id only, never its key or title; the DAL
  resolves keys under RLS and shows "a task you can't view" otherwise.
- Integrity: self-link CHECK, partial unique index on live pairs, and a cycle check
  serialized by a per-org transaction advisory lock (concurrent opposite links can't
  both succeed). Rows are append-only (ends immutable, removal one-way, DELETE
  forbidden by trigger).

## Secrets

- `.env.local` is gitignored; `.env.example` holds placeholders only.
- `SUPABASE_SECRET_KEY` is read only in `src/server/env.ts` (`server-only` import) and
  used only in `src/server/privileged/admin.ts`. A build scan confirmed the secret value,
  its variable name and `service_role` are absent from `.next/static`.
- Invitation tokens: 256-bit random, shown once to the inviter, stored as SHA-256,
  consumed atomically by `accept_invitation` (row lock, single use, email must match).

## Web hardening

CSP (`default-src 'self'`, no third-party script/font origins, `frame-ancestors 'none'`,
`form-action 'self'`), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
`Permissions-Policy`; Supabase SSR cookies (HttpOnly session handling by `@supabase/ssr`);
server actions include Next's origin check against CSRF. User text renders through
`RichText`, which never interprets HTML and links only http(s) URLs with
`rel="noopener noreferrer nofollow"`. Post-login redirects accept same-origin paths only.
Rate limits: failed sign-ins (8 per 15 min per IP+email), invite acceptance, password
reset, search, task creation, comments, request submission, invitation creation.
The limiter is in-memory per instance; a multi-instance deployment must move it to a
shared store (documented gap).

## Test identities (scripts/fixtures.ts)

owner (Rhea), founder/requester (Iris), admin without content (Sam), dev lead (Priya),
dev members (Leo, Ada), summary-only grant (Marcus), read grant (Tara), member of both
teams (Noor), suspended (Jules), removed from team (Kai), expired grant (Elena), plus an
anonymous client. `tests/db` exercises each against real RLS; `tests/e2e` repeats the
critical denials through the browser.

## Known gaps (not yet verified or implemented)

- MFA for admins (provider feature not configured locally).
- Shared-store rate limiting for multi-instance hosting.
- Nonce-based CSP (`script-src` currently allows `'unsafe-inline'` for Next bootstrap).
- File uploads and signed URLs: not built, by design for V1.
- Backup/restore drill: requires a hosted project; not performed.
- Task dependencies: for a blocker the viewer can't read, `resolved` (open vs.
  completed/canceled/archived) is disclosed, and the activity row's `data.task` holds
  that task's UUID (an opaque pointer that reads nothing under RLS). Both are
  deliberate (D-025); titles, keys and teams are never disclosed.
- Time tracking: the lazy settle for an expired edit grant runs only when that user next
  uses time tracking or opens a task/My Time; until then the row still reads as running in
  the database (the stored end time is set to the expiry instant once settled). No
  scheduled job settles it earlier.
