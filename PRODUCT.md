# Product

<!-- impeccable:product-schema 1 -->

> Source: every fact below is taken from the canonical specifications in
> `docs/qmatus_team_tracker_uiux_and_product_specs/` (final spec v3.1 and UI/UX spec v1).
> Impeccable's init interview was answered from those documents, as the build brief
> instructs, rather than by asking the user again. The specs remain authoritative.

## Platform

web

## Stack

Delegated by the specification (§10.1): Next.js App Router, React, TypeScript (strict),
Supabase Auth + PostgreSQL with RLS, Tailwind CSS v4 driven by semantic tokens,
Radix primitives, Lucide icons. Package manager: npm (see docs/DECISIONS.md D-002).

## Users

- **Founders / Main Team** — plan company work, make decisions, and commission work from
  engineering. They need to submit a clear request and follow deliberately published
  progress without entering the developer workspace.
- **Developer Team** — execute daily engineering work on a private board: triage
  incoming requests, own tasks, unblock each other, and keep history attached to work.
- **Workspace admins/owners** — invite people, manage membership and issue scoped,
  audited access grants. Administrative power does not include content access.

Everyone uses the tool repeatedly through the day; scanning, updating status and
switching context matter more than first impressions.

## Product Purpose

A private internal work platform for QMatus. It replaces task lists scattered across chat
and spreadsheets with one trustworthy source of truth: what matters, who owns it, what
is blocked, what was committed, and what changed. Success means both teams use it as the
place where work is requested, planned, executed and reviewed.

## Positioning

Kanban-first execution plus a **controlled Work Request boundary**: founders commission
developer work and see only published progress; developers execute privately. Privacy is
architectural (database row-level security, composite ownership constraints), not a
setting. Admin, seniority (L0–L5) and content visibility are separate concepts.

## Operating Context

- Two private teams at launch: Main Team / Founders, Developer Team.
- Invite-only access; no public sign-up.
- Daily loop: My Work → Board/List → task detail → comment/move → done.
- Cross-team loop: request → triage → accept with private tasks → published updates → delivered → closed.
- Used on desktop most of the day, with real mobile use for reading, status updates,
  comments, requests and notifications.

## Capabilities and Constraints

- P0: auth/invitations, teams/memberships/grants, My Work, team dashboard, tasks,
  Kanban + List, projects/milestones, Work Requests, comments/activity, notifications,
  Parking Lot, Library (links), scoped search, administration, all UI states.
- P1 (after P0 is stable): time tracking, dependencies, saved views, reminders.
- Never: surveillance metrics, productivity scores, fake data, fake controls, AI that
  changes work silently.
- Terminology: "Work Request", "My Work", "Board", "List", "Parking Lot", "Library",
  "Inbox"; statuses Backlog, Ready, In Progress, In Review, Done, Canceled; Blocked is a
  flag with a reason.

## Brand Commitments

- Name: **QMatus** (capital Q, capital M, lowercase "atus") in all editable copy.
- Official logo supplied by the user on 2026-10-16: a shield-shaped "QM" mark (the
  Q frame with a detached cobalt notch, the M with a circuit texture). Shipped as two
  theme-able alpha masks in `public/brand/` (ink + notch) and as the app icon. Don't
  redraw or restyle the mark; colour comes from the theme tokens.
- Voice: precise, calm, plain-language, warm enough to be human. No startup hype.

## Evidence on Hand

- No customer content, testimonials or imagery exist. All visible data is real records
  from the local development seed (fictional `.test` users), never decorative samples.

## Product Principles

1. Privacy by architecture; deny by default; never leak existence.
2. Request is not commitment; the receiving team owns triage and dates.
3. One accountable owner per task; board, list and My Work are views of the same records.
4. Truthful state: success only after the server confirms.
5. Progress, not surveillance.

## Accessibility & Inclusion

WCAG 2.2 AA. Every drag action has a keyboard and click alternative; visible focus in
both themes; reduced motion honoured; no meaning by colour alone; usable at 320px and
200% zoom.
