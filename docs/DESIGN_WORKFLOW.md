# Design workflow and evidence

The visual contract is the UI/UX spec v1 ("Quiet Precision"). `DESIGN.md` summarizes the
tokens; `src/app/globals.css` is the only place colour, radius, shadow, scrim and motion
values live. This file records how the three requested design skills were actually used,
what changed because of them, and what was inspected in a real browser.

## Skill installation (2026-10-16, Phase 0)

None of the skills were installed (no `~/.claude/skills`, no project `.claude/skills`).
The official repositories were cloned to a scratch directory, read, and the skill folders
copied into this project's `.claude/skills/` (project scope; no global files touched, no
installer scripts run, `.claude/settings*.json` untouched).

| Skill | Source (commit) | Installed path | Identity confirmed |
| --- | --- | --- | --- |
| Taste — `design-taste-frontend` | github.com/Leonxlnx/taste-skill (`f624f37`) | `.claude/skills/design-taste-frontend/` | frontmatter `name: design-taste-frontend`, "tasteskill v2" |
| Emil — `emil-design-eng`, `animate`, `find-animation-opportunities`, `review-animations`, `improve-animations`, `animation-performance` | github.com/emilkowalski/skills (`2d22863`) | `.claude/skills/<id>/` | each SKILL.md frontmatter name matches |
| Impeccable — `impeccable` v4.6.0 (engine 0.1.15) | github.com/pbakaus/impeccable (`8a0e198`), `.claude/skills/impeccable` | `.claude/skills/impeccable/` | frontmatter `name: impeccable`, `version: 4.6.0` |

**Session limitation (honest):** skills copied mid-session are not registered as slash
commands until Claude Code reloads, so `/impeccable …` and the Emil skills were *not*
invoked as commands. Their SKILL.md and reference files were read and their workflows
followed directly, which is what each section below records. Restart Claude Code to use
them as slash commands. The Impeccable engine binary was used for real: its launcher
downloaded the version-pinned binary from the official GitHub release and verified the
SHA-256 sidecar before running `impeccable context` and `impeccable detect`.

## Taste (`design-taste-frontend`)

- **Scope check:** the skill's own description ends "Not for dashboards or app screens".
  The specs require no public marketing page, so there is no in-scope surface. Its full
  workflow (`draw.mjs` directions, photo/hero recipe, `inspect.mjs`) was **not run**, by
  its own instruction, and no marketing page was invented to use it.
- **Principles applied (allowed as general guidance):** decisions taken from the subject
  rather than category defaults. This produced the audience seam (below), which comes
  from QMatus's actual distinguishing mechanism, the request boundary. Also: no centred
  hero, no icon tiles, no eyebrow labels, and judging real rendered screens at several widths.

## Impeccable

| Step | When | What happened | Changes caused |
| --- | --- | --- | --- |
| `init` (reference `init.md`) | Phase 0, before UI | PRODUCT.md written from the canonical specs. The init interview was answered from the documents, as the build brief instructs, and that is labelled in PRODUCT.md. | `PRODUCT.md` |
| new-work / `document` seed (`document.md`, `operate.md`, `mode-operate.md`) | Phase 0 | Mode recorded as **Operate**. "The brief wins": the spec's tokens and restrained palette are kept even though operate.md warns about grey-plus-one-accent screens. Signature move chosen per mode-operate: **the audience seam**. | `DESIGN.md`, `AudienceSeam` component used on task discussion, request page, intake, accept dialog and grant confirmation |
| `craft-floor.md` | Before first UI edit | Browser surfaces themed (selection, caret, scrollbars, focus ring), tabular numerals, no eyebrow labels, no gradient text, no glass. | `globals.css` base layer |
| `impeccable context` (engine) | Design review | Loaded PRODUCT.md/DESIGN.md successfully. | — |
| `impeccable detect --json src` (engine) | Critique + audit | **0 findings** (exit 0) across `src`. In-page overlay injection was not possible because the app's CSP (`script-src 'self'`) blocks the detector script, which is the intended behaviour. Recorded as the fallback signal. | — |
| `critique` (reference `critique.md`) | After board/panel/list/My Work were wired to seeded data | See report below | Filters popover, priority glyph, drag handle, panel focus, mobile title wrap, two overflow fixes |
| `audit` (reference `audit.md`) | After core flows | See report below | Scrim/shadow tokenized, toast target size, radio-group keyboard pattern, contrast unit test |

### Critique — first real screens (Board, task panel, List, My Work)

`⚠️ DEGRADED: single-context (sub-agents are not spawned in this session without an explicit user request; Assessment A then B were run sequentially)`

| # | Heuristic | Score | Key issue at review time |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 3 | Saving/Saved and server-confirmed toasts present; moves announced to screen readers |
| 2 | Match system / real world | 4 | Spec vocabulary; requester-facing labels ("Under review", "Needs your input") |
| 3 | User control and freedom | 3 | Archive/restore, Esc closes panel, confirm dialogs; no undo toast for moves |
| 4 | Consistency and standards | 3 | Filter row wrapped and mixed patterns (fixed) |
| 5 | Error prevention | 4 | Only legal transitions offered; requested vs committed dates separated |
| 6 | Recognition rather than recall | 3 | Priority glyphs nearly invisible at card size (fixed) |
| 7 | Flexibility and efficiency | 3 | ⌘K, inline create, keyboard drag, bulk actions; no single-key shortcuts yet |
| 8 | Aesthetic and minimalist design | 3 | Invisible drag handle indented every key (fixed); filters took 5 rows on mobile (fixed) |
| 9 | Error recovery | 3 | Conflicts explain and refresh; rollback on failed move |
| 10 | Help and documentation | 2 | Inline hints only; no shortcut help surface |
| | **Total** | **31/40** | Good |

**Design specificity:** authored for this product. The audience seam and the
requested-vs-committed fact strip only make sense for QMatus's boundary model. The board
itself is deliberately familiar (Operate mode: "earned familiarity").

**Priority issues and what was done**

- **[P1] Filter toolbar wrapped to two rows at 1440 and five on mobile.** It violated spec
  §10.4 ("filters live in one obvious panel"). Fixed: search and assignee stay inline; the
  rest moved into a Filters popover with an active-count badge (`task-toolbar.tsx`).
- **[P1] Priority unreadable at card size.** The Lucide signal icons rendered as dots.
  Fixed with a three-bar glyph (filled vs empty bars), urgent as a danger octagon, and
  an accessible label (`badges.tsx`).
- **[P2] Hidden drag handle indented every card key.** Fixed: the handle floats in the
  card gutter (`board.tsx`).
- **[P2] Opening the panel put a heavy focus ring on the status select.** Fixed: the panel
  container receives focus, so the title is announced (`task-panel.tsx`).
- **[P2] My Work and request titles truncated to a few words at 320px.** Fixed:
  two-line clamp on narrow screens (`work-row.tsx`, `request-rows.tsx`).

**Personas.** *Power user (Alex):* ⌘K, keyboard drag and bulk edit work; there are no
single-key shortcuts (J/K), so that's a follow-up. *First-timer (Jordan):* empty states
explain the next action, and the request form explains "request isn't a commitment" up front.

Assessment B evidence: the CLI detector reported 0 findings, and the browser overlay was
blocked by CSP (see above). Browser evidence came from the Playwright screenshot matrix.

### Audit — after core flows

| # | Dimension | Score | Key finding |
| --- | --- | --- | --- |
| 1 | Accessibility | 3 | Token contrast passes AA in both themes (unit-tested); keyboard drag works; theme radio group lacked arrow keys (fixed); single-key shortcuts and a shortcut help surface are missing |
| 2 | Performance | 3 | Board capped at 500 cards with a visible notice; no virtualisation; all routes dynamic by design |
| 3 | Theming | 4 | All colour, shadow and scrim values tokenized after the audit; dark composed separately |
| 4 | Responsive | 3 | No page overflow at 320–1440 (asserted); touch drag uses long-press; tablet uses the drawer nav |
| 5 | Implementation integrity | 4 | Detector clean; no fake controls; all data real seeded records |
| | **Total** | **17/20** | Good |

Fixed from the audit: scrims and the raised shadow tokenized (`--scrim*`,
`--shadow-raised`); toast dismiss 24→40px on touch; radio-group keyboard pattern on the
theme control; `tests/unit/contrast.test.ts` added (38 token pairs plus the focus ring and
control borders).

## Emil Kowalski motion skills

- **`emil-design-eng` / `find-animation-opportunities`** (read before motion work): gate
  every candidate on frequency, purpose, speed and function.
- **`animate`**: motion was built from that inventory with CSS transitions and
  `@starting-style` only (no motion library).
- **`review-animations`** (run on the implemented UI): 4 findings, all fixed (below).
- **`improve-animations`, `animation-performance`**: installed, but not needed. The
  review produced no performance regressions beyond the box-shadow keyframe, which was
  deleted rather than optimised.

### Motion inventory (find-animation-opportunities gate)

| Surface | Decision | Purpose · frequency | Recipe |
| --- | --- | --- | --- |
| Task side panel | Animate | Spatial consistency · occasional | `translateX(24px)`+opacity → 0, 220ms `--ease-drawer`, always from the right |
| Menus / popovers | Animate | Origin · tens/day | opacity + `scale(0.97) translateY(-2px)`, 150ms ease-out, Radix transform-origin |
| Dialogs | Animate | State · occasional | opacity + `scale(0.98)`, 180ms, centred |
| Toasts | Animate | Preventing a jarring change | `translateY(8px)`+opacity, 180ms |
| Button press | Subtle | Feedback · tens/day | `scale(0.97)`, 150ms ease-out |
| Card drag | Gesture | Spatial | overlay follows pointer; drop 150ms ease-out; neighbours 180ms ease-out |
| **Command menu (⌘K)** | **Rejected** | Keyboard, 100+/day | no animation (Emil: never animate keyboard surfaces) |
| Dashboard counts | Rejected | Data being read | no count-up |
| Status change outside drag | Rejected | Frequent | immediate label/colour change plus toast |
| Card hover lift | Rejected | Tens/day, no purpose | border colour only |

### `review-animations` findings on the implemented UI

| Before | After | Why |
| --- | --- | --- |
| `.qm-settle` keyframe on `box-shadow` after drop | deleted | non-GPU property, keyframe restarts on rapid drops; "Saving…" plus toast already confirm |
| Drag overlay `rotate(0.6deg)` | none | personality mismatch for a crisp tool |
| dnd-kit default `transform 250ms ease` | `180ms cubic-bezier(0.23,1,0.32,1)` | weak built-in easing; inside the UI budget |
| dnd-kit motion ignored reduced motion | `transition: null`, `dropAnimation: null` under `prefers-reduced-motion` | standard 8 |

**Verdict: Approve** after fixes. Reduced motion keeps opacity changes and removes all
movement (`globals.css` media block, `use-reduced-motion.ts`). Keyboard-initiated
surfaces don't animate.

## Real-browser visual review coverage

Captured with Playwright in the installed Chrome (`VISUAL=1 … visual.spec.ts`) after a
fresh seed, with reduced motion on. Every capture also asserts **no page-level
horizontal overflow**.

- **All six viewports** (1440×900, 1280×800, 1024×768, 768×1024, 390×844, 320×720) in
  **light and dark**: sign-in, My Work, Board, Board + task panel, List, request (team
  view), request (founder view).
- **1440 and 390** in both themes: dashboard, intake, request needing info, new request,
  project, Parking Lot, Library, Inbox, admin members, access grants, audit log,
  summary-only dashboard, read-only grant board, not-available, settings, empty My Work.
- **Inspected by eye:** board (light 1440/1280, dark 1440 + panel), mobile board (light
  390), My Work (dark 320), founder request (light 1440), plus earlier iterations in the
  in-app browser.
- **Overflow defects found and fixed:** the Members table's `sr-only` header escaped its
  scroll container (fixed with a `relative` wrapper on all tables), and the intake grid
  child lacked `min-w-0` at ≤390px.
- **Not done:** true 200% browser zoom (reflow was covered by the 320–768 widths, not
  zoom itself); screen-reader testing with VoiceOver/NVDA (semantics and live regions
  were checked in code and through Playwright's accessibility queries); a physical touch device.
