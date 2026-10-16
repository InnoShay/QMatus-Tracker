# QMatus Team Tracker

A private, team-isolated work tracker for QMatus. Founders and the Developer Team plan,
execute and review work on a Kanban-first board, and founders commission developer work
through a controlled **Work Request** boundary without seeing the developer workspace.

Canonical requirements live in `docs/qmatus_team_tracker_uiux_and_product_specs/`
(final spec v3.1 and UI/UX spec v1). Everything else in `docs/` describes what is built.

| Doc | What it covers |
| --- | --- |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phases, requirement status matrix, blockers, verification commands |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modules, data flow, DAL/policy/privileged boundaries |
| [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) | Roles, grants, RLS, test identities, secret handling |
| [docs/DESIGN_WORKFLOW.md](docs/DESIGN_WORKFLOW.md) | Quiet Precision system, skill evidence, visual review coverage |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decision records and deviations from the specs |
| [PRODUCT.md](PRODUCT.md) / [DESIGN.md](DESIGN.md) | Impeccable product context and design-system summary |

## Stack

Next.js 16 (App Router, React 19, TypeScript strict) · Supabase Auth + PostgreSQL 17 with
row-level security · Tailwind CSS 4 with semantic tokens · Radix primitives · Lucide icons ·
dnd-kit · Zod · Vitest · Playwright. Package manager: **npm** (lockfile committed).

## Prerequisites

- Node.js 22+ (developed on 24)
- Docker Desktop running (for the local Supabase stack)
- Google Chrome (browser tests use the installed Chrome; no browser download)

## Local setup

```bash
npm install
```

```bash
npm run db:start
```

```bash
npm run db:env
```

`db:env` writes `.env.local` from the running local stack (local default keys only).
Then create the schema from the committed migrations and load development fixtures:

```bash
npm run db:reset
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Open <http://localhost:3000>. Fixture accounts are listed in `scripts/fixtures.ts`
(fictional `.test` emails). They share a local-only password defined there
(override with `SEED_PASSWORD`). Useful identities:

| Sign in as | Shows |
| --- | --- |
| `priya@qmatus.test` | Developer Team lead: board, intake triage, approvals |
| `leo@qmatus.test` | Developer Team member |
| `iris@qmatus.test` | Founder / requester: no developer board, sees published request progress |
| `rhea@qmatus.test` | Workspace owner + Main Team lead (no developer access) |
| `sam@qmatus.test` | Workspace admin with no team content access |
| `marcus@qmatus.test` | Admin with a Developer Team **summary-only** grant |
| `tara@qmatus.test` | Read-only grant to the Developer Team |
| `noor@qmatus.test` | Member of both teams |

Local email (password resets) is captured by Mailpit at <http://127.0.0.1:54324>.

## Environment variables

See [.env.example](.env.example). Only `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` reach the browser. `SUPABASE_SECRET_KEY` is
server-only and is used exclusively by `src/server/privileged/admin.ts` (invited account
creation, session revocation on suspension). `APP_URL` builds invitation links.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run typecheck` · `npm run lint` · `npm run format` | Strict TS, ESLint (incl. React compiler rules), Prettier check |
| `npm test` | Unit tests (filters, dates, policies, contrast tokens, safe rendering) |
| `npm run test:db` | **Resets the local DB**, seeds, then runs RLS/authorization tests as real signed-in users |
| `npm run test:e2e` | **Resets the local DB**, seeds, then runs Playwright journeys in Chrome |
| `VISUAL=1 npm run test:e2e:only -- visual` | Screenshot matrix (6 viewports × light/dark) into `artifacts/screenshots/` with overflow checks |
| `npm run build` | Production build |
| `npm run check` | typecheck + lint + unit tests + build |
| `npm run db:types` | Regenerate `src/types/database.ts` from the local schema |
| `npm run bootstrap -- --owner-email … --owner-name "…"` | One-time workspace bootstrap for a new environment (see below) |

`test:db` and `test:e2e` refuse to touch anything but a local Supabase host.

## Migrations and seeds

- `supabase/migrations/*.sql` are the only source of schema truth, applied in order by
  `supabase db reset` (local) or `supabase db push` (linked project).
- `scripts/seed-dev.ts` is development-only fixture data. It refuses non-local URLs and
  creates content by signing in as fixture users, so triggers and RLS run for real.
- Never seed a production project with fixtures.

## First deployment (not performed by this build)

1. Create separate Supabase projects for staging and production. In Auth settings,
   disable public sign-up and set the minimum password length to 12.
2. `supabase link` to the project, then `supabase db push` to apply migrations.
3. Set the four env vars in the hosting provider (secret key server-side only).
4. Run `npm run bootstrap -- --owner-email you@company.com --owner-name "Your Name"`
   with `ENV_FILE` pointing at that environment's env file. It creates the
   organization, the two teams and the owner, and prints a one-time password link.
   The owner then invites everyone else from **Members**.
5. Configure SMTP in Supabase for password-reset emails. Invitations are copy-link
   by design until an email sender is chosen.
6. Before launch: run a restore drill from backups into staging (spec §16.3).

## Troubleshooting

- **"Missing Supabase env"**: run `npm run db:start` then `npm run db:env`.
- **"Email logins are disabled"**: `supabase/config.toml` must keep `[auth.email] enable_signup = true`
  (that flag enables the email provider); public sign-up is off via `[auth] enable_signup = false`.
- **DB tests fail with seed errors**: run `npm run test:db` (it resets and reseeds first).
- **Sign-in says "Too many failed attempts"**: the in-memory limiter resets after 15 minutes or on server restart.
