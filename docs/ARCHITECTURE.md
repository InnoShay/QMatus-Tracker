# Architecture

A modular monolith (spec §10): one Next.js application, one Supabase project. Domain
boundaries are folders, not services.

```text
src/
  app/                    routes, layouts, error/not-found boundaries (UI composition only)
    (auth)/               sign-in, invite/[token], forgot/reset password, no-access
    (workspace)/          authenticated shell: my-work, inbox, requests, search, settings, admin
      t/[team]/           team routes: dashboard, board, list, tasks/[key], projects, intake, ideas, library
    auth/confirm|callback route handlers for one-time recovery links
  features/<domain>/      server actions ("use server"), Zod schemas, domain UI components
    auth · tasks · requests · projects · knowledge · notifications · admin · settings · search
  server/
    auth/viewer.ts        resolves the viewer from CURRENT DB state on every request
    policies/             central policy helpers (mirror of SQL app.can_* functions)
    dal/                  server-only data access with explicit column allowlists (DTOs)
    privileged/admin.ts   the ONLY secret-key code path (2 narrow operations)
    rate-limit.ts         fixed-window limiter for abuse-sensitive actions
  components/ui|shell     presentation-only components; never an authorization point
  lib/                    env parsing, Supabase server client, dates, errors, theme
  types/                  generated DB types + typed overlay for trigger-managed columns
supabase/migrations/      the schema, RLS, grants, triggers and RPCs (source of truth)
scripts/                  seed-dev, bootstrap-workspace, fixtures, local env writer
tests/unit|db|e2e         Vitest unit, Vitest-against-real-DB RLS suite, Playwright
```

## Request flow (spec §10.4)

1. A client component calls a server action with untrusted input.
2. The action validates with Zod and calls `requireViewer()`, which re-reads the session
   and the viewer's org membership, team memberships and active, unexpired grants.
3. A policy helper decides what to *offer* and returns a non-revealing error early.
4. The DAL writes or reads through `createClient()` — a session-bound Supabase client
   carrying the user's JWT — so **RLS is the enforcement point**, independent of the app.
5. Triggers derive ownership (`org_id`, `team_id`), keys, actors and timestamps; validate
   transitions, assignees, one-level subtasks and immutable fields; and write activity
   and notification rows in the same transaction.
6. Multi-step domain operations are single SQL functions (`move_task`,
   `accept_work_request`, `submit_work_request`, `issue_grant`, `decide_grant`, …), so
   they are atomic and guarded by expected-version/expected-status checks.
7. The action maps database errors to user-safe messages (`lib/errors.ts`) and calls
   `revalidatePath`, so the UI only shows success after the server confirmed it.

## Data access rules

- No route, component or action reads with the secret key. `src/server/privileged/admin.ts`
  exposes `createInvitedIdentity` and `revokeAllSessions` only, both called after the
  acting user's authority was already checked under RLS.
- DTOs are built from allowlisted columns. The shared Work Request DTO never joins
  internal tables; the internal DTO is fetched only for readers of the receiving team.
- Search (`search_workspace`) is `SECURITY INVOKER`: every branch is RLS-filtered.
- The dashboard summary (`team_dashboard_summary`) is the one aggregate endpoint for
  summary-grant holders; it returns six counts and suppresses values under 3.
- Notifications store pointers only; titles are resolved at read time under RLS, so a
  revoked user sees "no longer available" instead of stale content.

## Rendering, caching and freshness

- Every workspace route is dynamic. Cache Components is disabled (DECISIONS D-008) so no
  private data is cached across requests; revocation applies on the next request.
- Realtime is not used. Pages refresh after each confirmed mutation; this is the spec's
  preferred safe default until private-channel revocation is proven.

## UI architecture

- Board, List and My Work render the same `TaskCard` DTO from one query, and share the
  URL-encoded filter model (`features/tasks/filters.ts`).
- Board moves are optimistic with rollback: local state changes, `move_task` confirms
  (version-checked), and a failure restores the snapshot and shows the server's reason.
- The task detail is one component used in a side panel (`?task=KEY`, preserving the
  board/list/My Work underneath) and as a full page (`/t/[team]/tasks/[key]`).
- Theme is a cookie read by the root layout, so the right tokens render before first
  paint; the profile stores the preference across devices.

## Storage, files and integrations

V1 ships links only (Library, request links). No uploads, no server-side URL fetching,
no realtime and no third-party integrations (spec §7.16, §7.21). See DECISIONS.
