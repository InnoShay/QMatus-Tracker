<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## QMatus Team Tracker — working rules

- Requirements: `docs/qmatus_team_tracker_uiux_and_product_specs/` (canonical; never edit). Status and decisions: `docs/`.
- Security first: ordinary reads/writes go through `createClient()` (user JWT, RLS). The secret key is used only in `src/server/privileged/admin.ts`; don't add CRUD there.
- Schema changes are new files in `supabase/migrations/`; then `npm run db:types`. Every new table needs RLS, explicit grants, team-scoped composite FKs and a test in `tests/db`.
- UI uses semantic tokens from `src/app/globals.css` only (see `DESIGN.md`); no raw colours in components.
- Before handing off: `npm run check`, `npm run test:db`, `npm run test:e2e` (the last two reset the local database).
