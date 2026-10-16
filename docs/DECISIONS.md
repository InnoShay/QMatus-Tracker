# Decisions

Short ADR-style records. "Spec" refers to the canonical documents in
`docs/qmatus_team_tracker_uiux_and_product_specs/`. Where the specs leave a choice open,
the narrowest safe option was taken; where privacy and convenience conflicted, the more
restrictive rule won.

**D-001 · No official logo found → text wordmark.** The workspace and Docs folder contain
no logo asset (searched SVG/PNG/WebP and names containing "logo"/"qmatus"). A restrained
text wordmark "QMatus" is used (`src/components/brand/wordmark.tsx`). Replace it with the
official asset in `public/brand/` when supplied; no logo was invented.

**D-002 · npm, not pnpm.** The folder had no lockfile, and pnpm isn't installed; enabling
corepack would modify global shims. npm is used consistently with one lockfile.

**D-003 · Brand casing.** The specs' titles use "Qmatus"; the build brief makes "QMatus"
authoritative. All editable UI copy uses "QMatus". The spec files are left untouched.

**D-004 · Admins cannot add themselves to a team.** Spec allows admins to manage
membership but forbids self-granting content access. Self-enrolment would be an implicit
bypass, so `admin_add_team_member` rejects `profile = caller`. Another admin must do it.

**D-005 · Membership is managed by workspace admins only in V1.** Spec allows team-lead
delegation "if delegated"; no delegation feature is built, so leads approve grants and
triage but do not change membership.

**D-006 · Default workflow transitions.** Backlog → Ready → In Progress → In Review → Done
with Canceled as a terminal alternative. Done is reachable only from In Progress or In
Review; any active state can be canceled; Done/Canceled can reopen. Blocked is a flag with
a required reason (spec §7.6). The graph is data (`task_status_transitions`), enforced by trigger.

**D-007 · "Team management" grants deferred.** Spec §4.4 lists it as separately delegated;
it is excluded from the `grant_scope` enum so it cannot be issued accidentally.

**D-008 · Next.js Cache Components disabled.** The scaffold enabled it. Its private
caches can keep session-derived content for minutes, conflicting with "revocation takes
effect on the next request". All routes are dynamic and re-authorize per request.

**D-009 · CSP allows inline scripts.** Next's App Router bootstraps with inline scripts;
a nonce pipeline is a follow-up. All other directives are strict and no third-party
origins are allowed (fonts are self-hosted).

**D-010 · Invitations are copy-link.** No email sender is configured, so the inviter
copies a single-use link shown once. Only owners can invite admins; invitations can't
create owners. Password-reset emails use Supabase's mailer (Mailpit locally).

**D-011 · Requesters see the team, not individual developers, on status events.** Shared
messages keep their authors (it's a conversation); published status/update events are
attributed to the receiving team to avoid exposing who is doing internal work.

**D-012 · Summary-grant small-number suppression.** Counts below 3 are returned as null
("Fewer than 3") to summary-only viewers (spec §7.4 subtraction risk).

**D-013 · Issue keys.** `PREFIX-n` per team (e.g. `DEV-42`), from a counter table that
team readers can't query (so the key reveals nothing beyond what they can see).
Requests are `REQ-n` org-wide.

**D-014 · Ordering.** `rank` is a numeric midpoint between neighbours, computed only by
`move_task`; status+order moves are version-checked (stale → conflict). Pure reorders
and status changes share one validated RPC, which is the one mutation that may touch both.

**D-015 · P1 time tracking deferred in the P0 session.** Superseded: the time-tracking
slice was built later (migration `20261016000500_time_tracking.sql`); see D-022–D-024.

**D-016 · Links-only Library and requests.** No uploads or server-side URL fetching
(spec §7.16 defers uploads until storage policies are tested; avoids SSRF).

**D-017 · Fonts self-hosted** (now Geist and Geist Mono via `@fontsource-variable/*`, see D-030; originally `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`)
(OFL). No runtime font CDN request.

**D-018 · DB and browser tests reset the local database.** `test:db`/`test:e2e` run
`supabase db reset` + seed first so results never depend on leftover data; the seed and
helpers refuse non-local hosts.

**D-019 · Taste skill not run in full.** Its own frontmatter says "Not for dashboards or
app screens", and the spec requires no public marketing page. Its anti-generic principles
were applied; its draw/recipe workflow was not (see DESIGN_WORKFLOW).

**D-020 · Typed overlay for trigger-managed columns.** Generated Insert types mark
`org_id`, `creator_id`, keys etc. as required, but triggers derive them. `src/types/db.ts`
relaxes exactly those columns; the generated file stays untouched.

**D-021 · Default seed timezone.** Fixture profiles use `Asia/Kolkata` to exercise
non-UTC date rendering; real users choose their zone in Settings.

**D-022 · Team time totals are a lead-only aggregate.** Spec §4.2 says team totals need
"a separate capability", which leads have "if granted by policy". The policy chosen: the
team's own active lead may call `team_time_totals(team, from, to)`; nobody else may —
not members, grant holders of any scope, admins or owners. It returns one number for the
period (no rows, notes, people or per-person/per-task split) and returns null with
`suppressed: true` when fewer than 3 people logged time, so one person's hours can't be
read off the total. No grant scope confers it (adding one would need an enum change and
an approval rule; not needed yet). The dashboard shows it to leads only.

**D-023 · Timer rules (spec §7.13 "define how the app handles…").**
- *One running timer:* starting on another task stops the running one (`switched`);
  starting again on the same task returns it unchanged. A partial unique index and a
  per-user advisory lock make concurrent starts end with exactly one running timer.
- *Access lost:* the running timer is stopped, never left writing. Membership removal,
  suspension, edit-grant revocation, task archive and team archive stop it in the same
  transaction (`access_lost` / `suspended` / `task_archived`), unless the user can still
  write the team another way. A grant that simply *expires* has no event, so every time
  operation (and `current_timer()`, called when a task or My Time renders) first settles
  the caller's timer, ending it at the grant's expiry instant rather than when noticed.
- *Session expiry / closed browser:* the timer keeps running server-side; elapsed time is
  `now − started_at` from the server, so it survives navigation, reloads and devices.
- *Stale timer:* never auto-capped (no scheduled job). Entries over 12 hours are flagged
  on My Time for the owner to correct.
- *Midnight and time zones:* instants are stored in UTC. An entry belongs to the day it
  started in the owner's profile time zone and is never split; manual entries whose end
  is at or before the start run into the next day. Changing the profile time zone
  regroups days; it never changes stored instants.
- *Validation for manual entries and corrections:* end after start, at most 24 hours,
  not in the future, not starting more than 90 days ago, and no overlap with the owner's
  other entries (a database exclusion constraint). Running timers can't be corrected or
  deleted until stopped.

**D-024 · Who may log time, and what the owner keeps.** Logging (start, manual, correct,
delete) requires write access to the task's team: members, leads and edit-grant holders.
Read and collaboration grant holders can read tasks but not log time. Entries are only
ever readable by their owner (and not while the account is suspended). After losing
access to a task the owner still sees their own entries, but the task shows as "no
longer available" and the entry can't be changed. Corrections and deletes keep an
owner-only, append-only history (`time_entry_events`) and deletes are soft. Personal
time actions are not written to `audit_events`, because admins and leads read the audit
log and it would expose personal time.

**D-025 · What a viewer learns about a blocker they can't read.** Spec §7.14 asks for
"a privacy-safe generic blocker state". A Dev member whose task is blocked by a private
Founders task sees one row, "A task you can't view", with its open/resolved state and
when it was linked, and the board counts it. They do not get its id, key, title, team or
status label. Disclosing open vs. resolved is the deliberate trade-off: without it the
cue can't say whether the team is still waiting. The link's activity row keeps the other
task's UUID as a pointer (needed to show the key to people who can read it); a UUID
reads nothing under RLS.

**D-026 · Dependencies are warning-only.** Spec §7.14: avoid hard enforcement until a
workflow is chosen. Nothing refuses a status change or board move because of an open
blocker; the detail says "You can still move this task" and the card shows a cue. An
archived, completed or canceled blocker counts as resolved. The manual blocked
flag/reason stays separate: a link doesn't set it, and the "Blocked" filter matches
either.

**D-027 · Who may link, and how links are kept.** Adding a link needs write access to
the task being edited and read access to the other task, linked by its issue key (keys
are unique per organization). That allows a person in two teams to record a cross-team
blocker; a member of one team can't link to a task they can't read. Removing needs write
access to either end, so the blocked team can clear a link to a task it can't see.
Links are never deleted: removal sets `removed_at`/`removed_by` and writes
`dependency_removed` on both tasks; archived tasks keep their links but take no new
ones; at most 50 live links per task. Cycles are refused for the whole graph, across
teams, under a per-organization lock.

**D-028 · Dark is the default theme.** The user named dark as the main theme. A missing
theme cookie now renders dark, and new profiles default to `dark` (migration
`20261016000700_dark_default_theme.sql`). Existing profiles keep their stored choice;
Light and System stay available in Settings and the account menu.

**D-029 · No backdated history in the seed.** The dashboard's Flow chart counts tasks
created and completed per day. Seed tasks are created at seed time, so the chart shows
only real activity since then. Letting the seed (service role) write historical
`created_at`/`completed_at` would mean relaxing the task triggers; that was refused as a
security weakening and is not done. Real use fills the chart over time.

**D-030 · "Signal Graphite" visual refresh (supersedes "Quiet Precision").** At the
user's request, using their logo and a reference dashboard as inspiration:
- Brand colours are two global variables (`--brand-primary` cobalt, `--brand-ember`)
  in `globals.css`; every other colour is a `light-dark()` token derived from them or
  from the supporting palette, so changing the brand is a two-line edit. The old "one
  accent" rule is replaced by cobalt = interaction and ember = attention/metrics, plus
  mint/amber/rose/violet/sky each with one job (state, status, series).
- `tests/unit/contrast.test.ts` resolves `light-dark()` and `color-mix()` and checks
  every text pair at 4.5:1, focus and control borders at 3:1 and chart series at 3:1,
  in both modes.
- Fonts: Geist + Geist Mono, self-hosted (no runtime CDN).
- Charts: recharts 3. The chart palette was validated with the dataviz palette checker
  (lightness band, chroma, CVD separation, contrast) for light and dark.
- Team dashboard rebuilt around the questions the user picked: flow over time
  (created vs completed, 14/30 days, deltas vs the previous period), what needs me
  (queue + attention banner + needs-attention list incl. dependency blockers),
  projects (progress = completed/non-canceled tasks) and milestones (dated timeline).
- The logo ships as alpha masks so the theme paints it (ink = text colour, notch =
  `--brand-primary`).
- Relative times in client components render through `RelativeTime`
  (`suppressHydrationWarning` on that node only). This fixes a real hydration mismatch
  ("3 min ago" vs "2 min ago") that the new render tour caught on the List view.
