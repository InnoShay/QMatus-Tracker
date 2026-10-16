---
name: QMatus Team Tracker
north_star: Signal Graphite
brand:
  brand-primary: "#3F66E0"   # cobalt from the logo notch: navigation, interaction, focus
  brand-ember: "#F0642E"     # warm signal: metrics, highlights, needs-attention
  note: "Global variables in src/app/globals.css :root. Change them and both themes follow."
colors:
  # Every token is light-dark(light, dark) in globals.css; values below are light / dark.
  app-bg: ["#F3F4F6", "#0A0B0E"]
  rail: ["#ECEEF2", "#0E0F13"]
  surface: ["#FFFFFF", "#14161B"]
  surface-raised: ["#FFFFFF", "#1A1D23"]
  surface-subtle: ["#EEF0F3", "#1A1D23"]
  surface-hover: ["#F2F4F7", "#20232A"]
  text-primary: ["#0E1116", "#F3F4F7"]
  text-secondary: ["#454C5A", "#B6BCC8"]
  text-tertiary: ["#5C6474", "#8B93A2"]
  border-subtle: ["#E1E4E9", "#22252D"]
  border-strong: ["#CFD4DC", "#30343E"]
  border-control: ["#7C8595", "#5E6678"]
  accent: "brand-primary mixed toward ink (light) / toward white (dark)"
  ember-strong: "brand-ember 80% + black (filled highlight, white text 4.6:1)"
  success: ["#13774C", "#4FDCAA"]
  warning: ["#8A5300", "#F6C35B"]
  danger: ["#B4232F", "#FF7D90"]
  violet: ["#6340C9", "#B9A4FF"]
  sky: ["#0B6A8A", "#6FD3F2"]
  chart: { light: ["#3F66E0", "#E2572A", "#13936A", "#7A52E0"], dark: ["#6683F2", "#E8652F", "#1FA878", "#9B7DF2"] }
typography:
  family-sans: "Geist (variable, self-hosted via @fontsource-variable/geist)"
  family-mono: "Geist Mono (issue keys and technical values only)"
  page-title: { fontSize: 28px, lineHeight: 36px, fontWeight: 600, tracking: -0.025em }
  dashboard-title: { fontSize: 30px, lineHeight: 36px, fontWeight: 600 }
  section: { fontSize: 16px, lineHeight: 22px, fontWeight: 600 }
  body: { fontSize: 14px, lineHeight: 20px, fontWeight: 400 }
  label: { fontSize: 13px, lineHeight: 18px, fontWeight: 500 }
  meta: { fontSize: 12px, lineHeight: 16px, fontWeight: 400 }
  figure: { fontSize: 34-40px, fontWeight: 500, tracking: -0.035em, unit: "half size, tertiary" }
rounded: { xs: 5px, sm: 8px, md: 12px, lg: 16px, xl: 20px, overlay: 16px, pill: "segmented controls, search, chips only" }
spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
motion:
  ease-out-ui: "cubic-bezier(0.23, 1, 0.32, 1)"
  ease-drawer: "cubic-bezier(0.32, 0.72, 0, 1)"
  duration: { hover: 120ms, fast: 150ms, standard: 180ms, panel: 220ms }
---

# Design System: QMatus Team Tracker

> Implementation summary of the canonical UI/UX specification
> (`docs/qmatus_team_tracker_uiux_and_product_specs/qmatus_team_tracker_ui_ux_spec_v1.md`).
> If this file and the spec disagree, the spec wins; fix this file.
> Tokens live in code in `src/app/globals.css` only.

## Overview

> 2026-10-16 redesign: the world below replaces "Quiet Precision" (see DECISIONS D-030).
> Sections after Colors still apply where they don't conflict.

**Signal Graphite.** Dark is the main theme: layered graphite panels that read as
objects (each surface one visible step up, a hairline edge and a faint lit top edge),
large quiet figures, and two brand signals taken from the QMatus logo: **cobalt**
(the logo's detached notch) for navigation, interaction and focus, and **ember** for
metrics and "needs attention". A small supporting palette (mint, amber, rose, violet,
sky) carries state, status and chart series, each with exactly one job. Light mode
is the same roles on paper-white panels.

**Signature move: the notch.** The logo's detached cobalt square marks "you are here"
(the active navigation item) and the sign-in brand panel. Used nowhere else.

**Charts** (recharts): one y-axis, 2px lines over a faint wash, crosshair tooltip
listing every series, legend keys beside the headline figures, a "Show as table"
view, clean ticks. Series order is fixed (created = chart-1, completed = chart-2) and
validated for colour-vision deficiency with the dataviz checker in both modes.

**Glass and light (D-032).** Floating chrome is glass (`.qm-glass`, `.qm-glass-panel`):
the header, mobile nav, menus, command palette, toasts and dialog backdrops, over a fixed
ambient light from the two brand colours. Panels (`.qm-card`, `.qm-spot`) catch a soft
cobalt spotlight and lit edge under the cursor. Primary buttons have a lit top edge, a
brand glow and a 2–3px magnetic lean. The sidebar has one gliding hover highlight.
Skeletons breathe with a slow sheen. Route changes settle in 220ms (fade + 4px rise).
The native cursor is never replaced.

**Greeting.** An original one-stroke "hello" is written on, held briefly, then dissolves
into the app. Once per browser session, never blocking, off under reduced motion.

The original "Quiet Precision" notes follow for context.

**Quiet Precision (superseded).** A well-made engineering instrument: state is unmistakable, the
important thing is immediately findable, and the surface never competes with the work.
Warm-neutral paper and ink in light; layered charcoal in dark (composed separately, not
inverted). Signal blue is reserved for interaction, focus and selection.

Mode: **Operate** (Impeccable). Familiar product affordances; brand lives in precise
details. Anti-references: purple/blue gradients, glow, glassmorphism, nested cards,
hero sections inside the app, pill-everything, icon-in-rounded-square tiles, eyebrow
labels over headings, animated counters, confetti.

**Signature move — the audience seam.** Every surface that mixes audiences draws the
boundary explicitly: a hairline rule with a lock/eye label naming who can see the
content below it ("Shared with requester", "Developer Team only"). Privacy becomes a
visible part of the layout instead of a hidden rule. Issue keys in IBM Plex Mono are the
second recurring detail.

## Colors

Tokens are listed in the frontmatter and mirrored 1:1 as CSS custom properties.

### Named rules
- **One accent.** `accent` marks links, focus, selection and the single primary action
  per region. Modules never get their own brand colour.
- **Status is a badge, not a fill.** Status/priority colours appear as small labelled
  badges or icons; cards never take a status-coloured background.
- **No opacity-derived text.** Secondary text uses `text-secondary`/`text-tertiary`.
- **Status pairs** (light / dark): Backlog `#475467 on #F2F4F7` / `#D0D5DD on #2D333D`;
  Ready `#344054 on #EAECF0` / `#D0D5DD on #2A303A`; In progress `#1D4ED8 on #EFF6FF` /
  `#A9C7FF on #1D3152`; In review `#854D0E on #FEF3C7` / `#F5D08A on #3D2F19`;
  Done `#166534 on #DCFCE7` / `#8ED7AC on #1C3A2B`; Blocked `#B42318 on #FEF3F2` /
  `#FFADA8 on #432427`.

## Typography

IBM Plex Sans throughout; one family carries headings, labels, data and body. IBM Plex
Mono only for issue keys (`DEV-42`, `REQ-7`) and tabular technical values. Fixed rem
scale (no fluid type). Sentence case. Tabular numerals for counts and dates. Body never
below 14px; metadata 12px.

## Layout

- Shell: 240px sidebar (64px collapsed) + 56px top bar on ≥1024px; content padding 24px,
  32px at ≥1440px. Forms and prose cap at ~680px.
- Board columns 280px, horizontally scrolling inside a dedicated scroll region.
- Task detail: 460px side panel on ≥1024px; full-screen sheet below.
- <768px: compact top bar, bottom navigation (My Work, Board, Requests, Inbox, More),
  list-first board with a status selector instead of five cramped columns.
- Four-pixel spacing scale; no one-off values.

## Elevation & Depth

Flat by default: surfaces and hairline borders separate regions. One soft shadow for
floating layers (`0 8px 24px -6px rgb(16 24 40 / 0.18), 0 2px 6px -2px rgb(16 24 40 / 0.10)`),
a stronger one for a dragged card. Dark mode relies on surface contrast and borders.

## Shapes

Radii 4 (badges) / 6 (controls) / 8 (cards) / 10 (contained surfaces) / 12 (overlays).
Circles only for avatars and radio controls.

## Components

- **Buttons**: primary (action-bg), secondary (surface + border-strong), quiet
  (transparent), danger. 36px desktop, 40px on touch. Loading keeps geometry.
- **Inputs**: visible label, 36px, `border-control` boundary, focus ring 2px
  `focus-ring` with 2px offset; errors below field, announced.
- **Task card**: key (mono, meta) → title (2 lines) → up to two labels + `+N` → footer
  with priority icon, due cue, blocked marker, subtask/comment counts, assignee initials.
- **Badges**: 4px radius, text + optional icon; never colour alone.
- **Menus/dialogs/drawers**: Radix primitives; drawer always enters from the right.
- **Empty states**: one sentence of why + one relevant action; no illustrations.

## Motion

Default is no motion. Hover/focus colour 120ms; menus 150ms fade + 4px translate; drawer
220ms `ease-drawer` translateX; toasts 180ms; drag follows the pointer, drop settles
150ms without overshoot. All motion is interruptible and removed (or reduced to opacity)
under `prefers-reduced-motion`. See docs/DESIGN_WORKFLOW.md for the motion inventory.
