# Qmatus Team Tracker — UI/UX Design System & Screen Specification

**Version:** 1.0  
**Date:** 16 October 2026  
**Status:** Locked visual and interaction direction for the next implementation-planning stage.  
**Companion document:** `qmatus_team_tracker_final_spec_v3_1.md`  
**Purpose:** Define the product's visual language, light/dark themes, navigation behavior, screen-level UX, motion, accessibility and quality gates. This is not the final coding-agent prompt and does not authorize changing the functional or security contract in the companion specification.

---

## 0. Executive decision

Design Qmatus as a **quiet, high-craft engineering workspace**: precise, restrained, dense enough for real work, and comfortable to use for hours. Its interface should feel authored by a product team that understands engineering workflows—not generated from a generic SaaS template.

The product's visual personality is called **Quiet Precision**. The work itself is the visual content. Typography, spacing, state, alignment and excellent interaction feedback create the quality; decorative effects do not.

### Decisions locked

1. **Primary visual direction:** technical editorial minimalism with strong information hierarchy, a restrained signal-blue accent, neutral ink/paper surfaces and purposeful state colors.
2. **Themes:** fully designed Light, Dark and System modes. Dark is not a mechanically inverted light palette; both themes have explicit token values.
3. **No AI-slop defaults:** no purple/blue gradients, glow effects, glassmorphism, blurred blobs, arbitrary gradient backgrounds, huge marketing-style hero sections inside the app, nested-card dashboards, or meaningless animated decoration.
4. **Typography:** IBM Plex Sans for interface text and IBM Plex Mono for IDs/technical values; bundle fonts with the application rather than making runtime requests to third-party font services.
5. **Component language:** clean rectangular surfaces, restrained 6–10px radii, hairline dividers, visible keyboard focus and compact but breathable spacing.
6. **Primary workspace:** Kanban board is the main execution view; List and My Work are first-class alternatives over the same canonical data.
7. **No permission by presentation:** screens, selectors, global search, counts, activity, notifications, file links and dashboard summaries must honor the authorization rules in the product/technical specification. The UI never substitutes for server authorization.
8. **Motion:** short, purposeful, interruptible feedback. Motion clarifies state and spatial relationships; it is not a showreel.
9. **Quality loop:** every key screen is reviewed in both themes and at desktop, tablet and mobile widths. Build it, inspect real browser screenshots, fix the highest-impact issues, and inspect again.
10. **Functional truth:** no fake controls, mock data pretending to be live, success states shown before persistence, or visually complete buttons with no working behavior.

The objective is not maximal novelty. It is a recognizable, polished work tool whose craft comes from small decisions consistently executed.

---

## 1. Product context and design north star

### 1.1 Product context

Qmatus is a private internal tracker for a small startup, initially serving two distinct private teams: Main Team / Founders and Developer Team. People need to issue and triage work, execute tasks, understand blockers, collaborate in context, preserve decisions, and follow outcomes without accidentally revealing another team's private workspace.

The interface must support frequent, repeat interactions. Most people will spend more time scanning tasks, updating status, filtering boards, reading comments and switching contexts than admiring the dashboard. Speed, legibility, predictable interaction and low cognitive load outrank visual novelty.

### 1.2 Creative north star: “Quiet Precision”

Think of a well-made engineering instrument: the controls are easy to understand, state is unmistakable, important information is immediately findable, and the surface never competes with the work. Use the confidence of a professional developer tool with the calmness of a refined editorial layout. The identity comes from controlled type, disciplined alignment, precise spacing and a few deliberate accents—not from loud branding.

The app should feel:

- **Serious:** clear hierarchy, no playful confetti, no gimmick controls.
- **Human:** plain language, clear feedback, useful empty/error states.
- **Focused:** one dominant task/action at a time, secondary functions available when needed.
- **Efficient:** keyboard access, stable layout, fast scanning, saved view preferences.
- **Trustworthy:** privacy states are clear; permissions are described precisely; the interface does not overpromise.
- **Distinct:** warm-neutral light theme and ink-charcoal dark theme with a signal-blue accent, not a purple gradient or stock dashboard palette.

### 1.3 What the interface is not

It is not a marketing website. Do not use public-site conventions such as oversized hero typography, photos as decoration, rows of promotional icon cards, testimonials, animated background shapes, CTA-heavy section layouts or large empty areas that waste work space.

It is not a dashboard where every section is a card. Use a combination of aligned sections, lists, compact metrics, tables, quiet separators, and occasional contained surfaces only when containment helps a task.

It is not an attempt to reproduce Linear pixel-for-pixel. Linear informs the focus, board/list patterns and keyboard-first behavior; Qmatus needs its own token values, request-intake boundary and team-specific navigation.

---

## 2. How the three design skills are integrated

The skills are design inputs, not substitutes for product judgment. Apply the relevant methods deliberately; do not blindly execute landing-page directions against a dense internal app.

### 2.1 Taste — use its anti-generic design discipline, not its landing-page recipe

Reference: [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)

The current Taste Skill v2 explicitly scopes itself to public-facing sites and says it is **not for dashboards or app screens**. Its full landing-page recipe should therefore not be applied literally to Qmatus. Doing so could produce marketing-style compositions, photos, hero sections and novelty that are wrong for a daily-use work tracker. This is an intentional scope distinction, not an omission.

**Principles to carry into Qmatus:**

- Make visual choices that relate to the product's purpose; avoid category-default styling.
- Establish a clear art direction and a small set of deliberate rules before component work.
- Reject the predictable AI-generated combination of centered hero, pastel gradient, rounded icon tiles, many nested cards and filler microcopy.
- Judge the actual rendered interface at real sizes, rather than trusting source code or verbal descriptions.
- Review at multiple viewport widths; fix what appears in screenshots and interaction, not just what looks plausible in markup.

**Do not import:** photo-driven landing-page composition, large marketing headlines, gallery/portfolio structure, or a dramatic “one live thing” hero pattern. For Qmatus, the equivalent of Taste's authored direction is the consistent interaction language across boards, detail panels, intake, filters, task states and themes.

### 2.2 Emil Kowalski's design-engineering and motion skill

Reference: [emilkowalski/skills — emil-design-eng](https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md) and [Animations on the Web](https://animations.dev/)

Use the `emil-design-eng` skill for overall design-engineering judgment, `animate` when constructing a specific animation, and `review-animations` for a strict motion review when those skills are available. Above all, use Emil's approach to decide **whether** something should move before deciding how to animate it. Motion should provide feedback, preserve spatial continuity, explain cause and effect, or prevent abrupt state changes. Repeated micro-interactions need particular restraint because they occur dozens or hundreds of times.

**Principles to carry into Qmatus:**

- Default to no animation unless there is a user benefit.
- Match easing and duration to the interaction: quick ease-out for entrance, controlled ease-in-out for spatial movement, and quiet transitions for hover/focus/color.
- Prefer `transform` and `opacity` to animating layout-affecting CSS properties.
- Prefer interruptible CSS transitions for simple frequent states; use a motion library only for interactions that genuinely benefit from it.
- Tooltips should have a modest initial delay, then appear immediately as the user moves between nearby tooltips.
- Motion must not block input. Users can reverse, cancel or interrupt it.
- Respect `prefers-reduced-motion`; remove positional, large-scale and repetitive movement while retaining understandable state feedback.

**Qmatus interpretation:** the board should feel responsive while cards move, a task panel should enter consistently from the same edge, and a save confirmation should quietly confirm the result. Do not animate every count, pulse status indicators, bounce cards, or animate every dashboard widget on load.

### 2.3 Impeccable — the primary design-system and critique workflow

Reference: [Impeccable](https://impeccable.style/), [documentation](https://impeccable.style/docs), [audit](https://impeccable.style/docs/audit/), [DESIGN.md format](https://impeccable.style/docs/document/)

Impeccable is the most directly applicable of the three for a dashboard/product interface. Use it to establish product context, document the design system, refine hierarchy, catch UI anti-patterns and audit usability across themes and screen sizes.

**Required design workflow when implementation begins:**

1. Record product context in `PRODUCT.md`: users, tasks, privacy constraints, product purpose, accessibility needs and non-goals.
2. Record the approved visual system in `DESIGN.md`: tokens, typography, spacing, shapes, component variants, motion rules, light/dark mappings and explicit anti-references.
3. Build a small representative set of components and one real end-to-end screen before multiplying patterns.
4. Use Impeccable's applicable critique/polish/layout/typeset/colorize/animate/audit workflows when the skill is available; use the documented equivalent review checklist if it is not.
5. Inspect the running app in a real browser and take screenshots. Repair the most serious functional, accessibility and hierarchy issues before cosmetic details.
6. Re-run checks after shared components or tokens change; keep `DESIGN.md` as the source of truth rather than allowing design decisions to live only in prompts.

**Do not treat automatic design checks as proof of correctness.** They supplement browser inspection, keyboard testing, contrast checks, accessibility review, product acceptance tests and authorization tests.

### 2.4 Integration order and precedence

Apply the skills in this order:

1. **Product and privacy contract** from the companion functional specification.
2. **Impeccable** to define product context, tokens, component patterns and systematic audit.
3. **Taste principles** to challenge generic choices and make the visual direction intentional, adapted for an operational dashboard.
4. **Emil's motion principles** for each interaction where movement earns its place.
5. **Real-browser review** across representative screens, both themes and relevant widths.

If a skill recommendation conflicts with Qmatus requirements, this specification and the product/technical specification win. Never trade away security, accessibility, data clarity, team isolation or performance for visual flair.

---

## 3. Visual references and what to borrow

These references inform interaction patterns, not a copy exercise.

| Reference | Pattern to study | Qmatus application |
|---|---|---|
| [Linear — display options](https://linear.app/docs/display-options) | Board/list switching, grouping, ordering, visible fields and saved display preferences | Keep display options in one predictable control; remember personal preferences without changing canonical task data |
| [Linear — selecting issues](https://linear.app/docs/select-issues) | Keyboard selection, bulk actions, command menu and contextual actions | Add accessible bulk actions only where useful; expose the same actions through keyboard and pointer |
| [Linear — board overview](https://linear.app/changelog/issue-selection) | Compact task cards, calm board structure, restrained emphasis | Use clean columns and cards, but create a distinct Qmatus palette and card information hierarchy |
| [Atlassian Design — color](https://atlassian.design/foundations/color/) | Role-based color tokens, interaction states, theme mappings and contrast discipline | Tokenize states rather than hardcoding arbitrary colors in components |
| [Radix UI — accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility) | Focus management, keyboard behavior and semantics for complex components | Use accessible primitives as foundations and test the actual composed patterns |
| [Motion — accessibility](https://motion.dev/docs/react-accessibility) | Reduced-motion handling and motion that preserves comprehension | Respect system preferences and retain necessary state feedback with little or no movement |
| [Impeccable — audit](https://impeccable.style/docs/audit/) | Severity-ranked review across accessibility, performance, theme and responsive behavior | Make the review a repeatable release gate, not a one-time aesthetic pass |

### Inspiration boundaries

- Do not copy logos, illustrations, proprietary iconography or exact branded screens.
- Borrow interaction patterns that are proven, then apply Qmatus tokens and security boundaries.
- Do not use screenshots as implementation truth; reproduce behavior and hierarchy, not accidental visual artifacts.
- Use no stock photography in the work-management application. Real work content is the content.

---

## 4. Brand and visual-system rules

### 4.1 Signature

**Name:** Qmatus  
**Visual signature:** restrained wordmark; optional simple monogram only if a real brand asset is approved. Do not invent an elaborate logo or use an emoji as the product mark.  
**Tone:** precise, low-noise, technically literate, warm enough to feel human.  
**Visual metaphor:** a well-designed work instrument, not a futuristic AI control room.

### 4.2 Non-negotiable anti-patterns

Do not ship:

- Purple/indigo gradients, blue-purple gradient buttons, gradient text or glowing borders.
- Blurred color blobs, aurora backgrounds, decorative mesh gradients, glassmorphism or excess backdrop blur.
- A rounded rectangle behind every icon, every metric, every paragraph or every navigation item.
- Nested cards, oversized 24–32px corner radii across the application, pill-shaped everything, or multiple shadow layers on ordinary content.
- Low-contrast gray text used merely to look minimal.
- Tiny 10px body text, all-caps labels everywhere, or monospaced typography for all UI text.
- Fake activity feeds, fake avatars/photos, fabricated data, or metrics with no clear operational purpose.
- A large first-run welcome hero inside the work app; use a direct heading and the next useful action.
- Confetti or success animations for ordinary task completion.
- Skeleton screens that do not match the final layout, indefinitely spinning loaders, or controls that are only visual.
- Color as the only means of communicating priority, status, danger, membership or permission.

Minimalism means removing competing information, not removing necessary labels, contrast or affordances.

---

## 5. Color system: Light and Dark themes

The themes are independently composed. Light uses paper-like neutral surfaces; Dark uses layered charcoal surfaces. Signal blue handles primary interaction and focus. Status colors are semantic and limited in use.

### 5.1 Light theme tokens

| Token | Value | Intended use |
|---|---|---|
| `--app-bg` | `#F6F7F9` | Primary workspace canvas |
| `--surface` | `#FFFFFF` | Main content areas, menus, task detail panel |
| `--surface-subtle` | `#F1F3F6` | Sidebar, grouped areas and quiet secondary regions |
| `--surface-hover` | `#F7F8FA` | Hovered rows and quiet controls |
| `--surface-selected` | `#EAF0FF` | Selected navigation, selected rows and active view markers |
| `--text-primary` | `#101828` | Headings, task titles and primary copy |
| `--text-secondary` | `#475467` | Descriptions, form labels and meaningful secondary copy |
| `--text-tertiary` | `#626B7C` | Metadata and timestamps; never critical instructions |
| `--border-subtle` | `#E4E7EC` | Decorative separators and low-emphasis grouping |
| `--border-strong` | `#D0D5DD` | Content boundaries and stronger separators |
| `--border-control` | `#848F9F` | Input/checkbox boundaries where the boundary matters for recognition |
| `--accent` | `#2457C5` | Links, focus, selected text and primary interactive emphasis |
| `--accent-hover` | `#1D46A0` | Hover/active primary interaction |
| `--accent-soft` | `#EAF0FF` | Selected and informational backgrounds |
| `--action-bg` | `#2457C5` | Primary button background |
| `--action-fg` | `#FFFFFF` | Text/icon on primary button |
| `--success-fg` | `#1B6B46` | Success text/icon |
| `--success-bg` | `#EAF7F0` | Quiet success state |
| `--warning-fg` | `#8A4B0F` | Warning text/icon |
| `--warning-bg` | `#FFF4E5` | Quiet warning state |
| `--danger-fg` | `#B42318` | Destructive and error text/icon |
| `--danger-bg` | `#FEF3F2` | Quiet error/destructive state |
| `--focus-ring` | `#2457C5` | Visible keyboard focus ring |

### 5.2 Dark theme tokens

| Token | Value | Intended use |
|---|---|---|
| `--app-bg` | `#101216` | Primary workspace canvas; avoid absolute black |
| `--surface` | `#171A21` | Main content areas, menus and task detail panel |
| `--surface-subtle` | `#1D222B` | Sidebar and grouped secondary areas |
| `--surface-hover` | `#222833` | Hovered rows and quiet controls |
| `--surface-selected` | `#1D2C49` | Selected navigation, selected rows and active view markers |
| `--text-primary` | `#F2F4F7` | Headings, task titles and primary copy |
| `--text-secondary` | `#C0C7D2` | Descriptions, labels and secondary copy |
| `--text-tertiary` | `#929BAA` | Metadata and timestamps; never critical instructions |
| `--border-subtle` | `#2A303A` | Decorative separators and low-emphasis grouping |
| `--border-strong` | `#404857` | Content boundaries and stronger separators |
| `--border-control` | `#647084` | Input/checkbox boundaries where the boundary matters |
| `--accent` | `#8DB0FF` | Links, focus and selected text |
| `--accent-hover` | `#B3CAFF` | Hover/active text accent |
| `--accent-soft` | `#1D2C49` | Selected and informational backgrounds |
| `--action-bg` | `#2457C5` | Primary button background; preserves white-text contrast |
| `--action-fg` | `#FFFFFF` | Text/icon on primary button |
| `--success-fg` | `#7ED6A5` | Success text/icon |
| `--success-bg` | `#173326` | Quiet success state |
| `--warning-fg` | `#F5C27A` | Warning text/icon |
| `--warning-bg` | `#3D2C17` | Quiet warning state |
| `--danger-fg` | `#FF9B96` | Destructive and error text/icon |
| `--danger-bg` | `#3D1F22` | Quiet error/destructive state |
| `--focus-ring` | `#8DB0FF` | Visible keyboard focus ring |

### 5.3 Status tokens

Use status colors as small badges, an icon, a label or a slim indicator—not as full-card background fills. Pair every status color with text and/or a shape so it remains intelligible without color perception.

| Meaning | Light treatment | Dark treatment |
|---|---|---|
| Backlog / neutral | `#475467` on `#F2F4F7` | `#D0D5DD` on `#2D333D` |
| Ready / queued | `#344054` on `#EAECF0` | `#D0D5DD` on `#2A303A` |
| In progress | `#1D4ED8` on `#EFF6FF` | `#A9C7FF` on `#1D3152` |
| In review | `#854D0E` on `#FEF3C7` | `#F5D08A` on `#3D2F19` |
| Done | `#166534` on `#DCFCE7` | `#8ED7AC` on `#1C3A2B` |
| Blocked / error | `#B42318` on `#FEF3F2` | `#FFADA8` on `#432427` |

Treat these as semantic design tokens and run contrast checks on final rendered elements. The proposed core text pairs have been contrast-checked against the named base/selected surfaces (light tertiary text `#626B7C` remains at roughly 4.7:1 on `#EAF0FF`; dark tertiary text `#929BAA` is roughly 5.0:1 on `#1D2C49`). If a pair fails, adjust the token—not the font size or opacity of the text to disguise it.

### 5.4 Color usage rules

- Use one primary accent for interaction. Do not give every module its own brand color.
- A primary action has one clear filled treatment per screen or region; secondary actions are outline/quiet buttons.
- Destructive actions use danger treatment and confirm irrecoverable operations.
- Warning colors mean something needs attention; do not use amber just to decorate a “review” label.
- Most of the UI should be neutral. If everything is accented, nothing is.
- Charts and reports, when added, use a restrained, color-blind-considerate series palette and direct labels. Never encode a critical distinction only in the legend color.
- Avoid opacity-only token strategies for important states because the resulting contrast depends on the background.
- Provide a theme preview in settings only if it can be implemented accessibly; selecting a theme should update the current screen immediately.

### 5.5 Theme behavior

- Supported settings: **System**, **Light**, **Dark**.
- Default: System, respecting `prefers-color-scheme` until the user selects a preference.
- Persist explicit user preference to the user's profile when signed in; use a safe local fallback before profile data loads if needed.
- Apply theme before the first visible paint to avoid a bright flash in dark mode.
- Theme changes must not reset forms, scroll position, filters, selected tasks or open panel state.
- Do not duplicate separate CSS systems; use semantic variables for both themes.
- Test every component state in both themes: default, hover, pressed, focus, selected, disabled, loading, validation error, success, empty and overlay.

---

## 6. Typography, spacing and shape

### 6.1 Typography

**Primary interface typeface:** IBM Plex Sans.  
**Technical values:** IBM Plex Mono for issue IDs, short codes and selected numerical values only.  
**Fallback:** system sans-serif and system monospace, respectively. Bundle/self-host the approved font files via the app build so regular interface use does not depend on a third-party font request.

| Style | Size / line height | Weight | Use |
|---|---|---|---|
| Page title | 22–24 / 28–32px | 600 | Main page heading; one per page |
| Section heading | 16–18 / 22–26px | 600 | Named page sections and panel sections |
| Task title / row title | 14 / 20px | 500–600 | Task card/list row content |
| Body | 14 / 20px | 400 | Default explanatory and task body copy |
| Form label | 13 / 18px | 500 | Inputs and settings |
| Secondary metadata | 12 / 16px | 400–500 | IDs, timestamps, counts, compact supporting info |
| Button | 13–14 / 18px | 500–600 | Standard actions |
| Numeric metric | 20–24 / 28px | 600 | Only for actionable, meaningful dashboard summary figures |

Rules:

- Keep sentence case. Use uppercase only for rare short abbreviations such as IDs where appropriate.
- Avoid large headline/body contrast that belongs to marketing pages.
- Use tabular numerals for counters, durations and aligned numeric values where supported.
- Body copy should generally not fall below 14px. Metadata may be 12px when non-critical and still comfortably readable.
- Use italic type only for real semantic purposes; do not add italic serif text as decoration.
- Keep paragraphs and help copy short, with clear labels and action-oriented wording.

### 6.2 Spacing scale

Use a four-pixel base scale:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64px`

Rules of use:

- 4–8px: icon/text alignment, inline metadata, compact control spacing.
- 12px: related controls, card interior clusters, compact table row content.
- 16px: default component padding and form field groups.
- 20–24px: section separation and task detail groups.
- 24–32px: primary page padding at desktop widths.
- 32–48px: separation between major unrelated page regions.
- Avoid one-off spacing values unless a measured alignment issue justifies them; add a token if reuse is expected.

### 6.3 Shape and elevation

| Token | Value | Typical use |
|---|---:|---|
| `radius-xs` | 4px | Badges and tight labels |
| `radius-sm` | 6px | Inputs, buttons, menu items |
| `radius-md` | 8px | Task cards, compact panels |
| `radius-lg` | 10px | Larger contained surfaces |
| `radius-overlay` | 12px | Side panels/dialog surfaces |

Avoid giant pills for buttons and oversized 20–28px card radii. Use circular geometry only where the control semantics support it (avatars, radio/checkbox, icon marks).

Elevation is subtle and functional:

- Default content separation primarily uses surfaces and borders, not shadows.
- Use one soft shadow for floating menus/dialogs only when it helps separate layers.
- Dragged cards may gain a stronger shadow during the drag and return on drop.
- Do not stack multiple shadows or use colored neon shadows.
- In dark mode, use surface contrast and borders before adding shadow; large shadows often disappear or muddy the layout.

---

## 7. Layout and responsive behavior

### 7.1 Desktop application shell

Target design canvas: 1440 × 900px. The layout should also work at 1280 × 800 and wider. This is a work application, so optimize the usable workspace rather than placing the content in a narrow marketing-style centered container.

- Expanded left sidebar: approximately 240px.
- Collapsed sidebar: approximately 64px, with accessible labels/tooltips.
- Top workspace bar: approximately 56px.
- Main content padding: 24px at medium desktop, up to 32px when width permits.
- Main content must not become excessively wide for text-only forms/detail copy; use a readable max-width for forms and long descriptions.
- A task detail side panel should generally be 420–480px, with an intentional full-page fallback for deep editing or narrow screens.
- Board columns are approximately 260–288px wide and may scroll horizontally. Never shrink cards until titles and metadata become unreadable just to squeeze every column into the viewport.

### 7.2 Layout behavior

- Keep primary app navigation stable between routes. The content area, not the entire application shell, changes when navigating within a workspace.
- Use the left navigation for destinations, not repeated filter chips or actions.
- Use page toolbars for title, view, filters, and page actions in a consistent order.
- Filters should be discoverable in one place. Active filters must be visibly represented and easy to clear.
- Use breadcrumbs only when there is real hierarchy; do not add breadcrumbs to every simple page.
- Overlays should preserve context when they do not require a full-page flow. Deep forms, permission workflows and large edits may use full pages.
- Do not display disabled links to private teams if their existence itself is confidential. Only authorized destinations belong in the team switcher.

### 7.3 Responsive breakpoints and behavior

Use content-driven breakpoints; these are starting values, not a reason to break a usable layout.

| Range | Expected behavior |
|---|---|
| `≥1280px` desktop | Expanded/collapsible sidebar, full work toolbar, multi-column Kanban board with horizontal scrolling, task side panel |
| `768–1279px` tablet/small laptop | Collapsible sidebar by default where space is tight, condensed toolbars, horizontal board scrolling, collapsible filters, task detail as drawer or full page |
| `<768px` mobile | Compact top bar and navigation drawer or compact bottom navigation, list-first task presentation, status selector instead of forcing five cramped columns, full-screen task detail/edit flow, touch-friendly controls |
| Narrowest supported `320px` | No page-level horizontal overflow; long identifiers/URLs wrap or truncate with an accessible way to inspect full value |

The mobile interface is not an afterthought, but the initial product may prioritize desktop. Core actions—read task, update status, comment, submit request, respond to notification, switch theme—must remain possible on mobile.

### 7.4 Density

Default to **medium-compact** density: enough whitespace for orientation, but no wasted vertical space. Do not make every row tall or every card spacious. If a compact/comfortable density preference is added, it must be a coherent system-wide choice and must not reduce touch-target or accessibility minimums.

---

## 8. Application navigation and information hierarchy

The shell changes what is available based on the user's actual authorized memberships and grants. Founders and developers do not see identical navigation merely because they use the same application.

### 8.1 Core shell

1. **Workspace/team switcher** — shows only teams the person is currently authorized to enter. Never lists private teams as locked/teasing options.
2. **My Work** — tasks assigned to the signed-in user across only the workspaces they can access.
3. **Inbox** — notifications and actionable mentions from authorized resources.
4. **Current Team** — team-specific dashboard, Board, List, Projects, Work Requests, Parking Lot and Library as applicable.
5. **Search / command menu** — one unified entry point, but every result is authorization-scoped on the server.
6. **Profile/settings** — profile, theme, notification preferences, session/security actions and authorized administrative routes.

The exact visual grouping may be refined during implementation, but the availability and privacy constraints may not.

### 8.2 Navigation rules

- Use short labels with consistent capitalization: “My Work”, “Board”, “List”, “Projects”, “Work Requests”, “Parking Lot”, “Library”, “Inbox”, “Settings”.
- Use one icon family (Lucide or equivalent) with consistent 16–18px sizing and stroke weight. Pair core navigation icons with text when the sidebar is expanded.
- Highlight the current destination with a quiet selected surface and a clear label—not a bright neon accent bar plus a pill plus a dot.
- Show unread count only when it is actionable; do not fill navigation with unhelpful number badges.
- Global shortcuts must not fire while focus is in a text field, contenteditable region, or a screen-reader-sensitive interaction unless explicitly designed.
- Team switch is a deliberate transition. Keep the destination's team context visible in the page title or breadcrumb, but never reveal inaccessible team names.
- Preserve filter, scroll and detail-panel state where expected, without allowing stale authorization state to remain after access is revoked.

### 8.3 Team-specific information boundaries

**Main Team / Founders view** may show founder-team tasks, decisions and resources, submitted work requests and only the progress updates intentionally published for those requests.

**Developer Team view** may show the private developer board, internal tasks, engineering discussions, internal task notes and permitted time data.

A founder's submitted Work Request screen must not expose private linked task titles, assignees, estimate, comments, internal activity or developer dashboard counts unless those exact fields have been intentionally published via an explicit supported permission. The UI must not suggest that “request progress” means “developer workspace access.”

---

## 9. Core layout sketches (low-fidelity)

These sketches lock hierarchy and relative placement, not exact pixels. They are intentionally monochrome and use the token system above; no gradient or decorative imagery is implied.

### 9.1 Desktop workspace shell

```text
┌──────────────────────────────┬────────────────────────────────────────────────────────────────────────────┐
│ Qmatus                       │ Team / Project context       Search (⌘K)       Help       Profile          │
│                              ├────────────────────────────────────────────────────────────────────────────┤
│ My Work                      │ Board title                                         [New task]            │
│ Inbox                        │ Short context / breadcrumbs                                               │
│                              │ [Board] [List]   Filter   Group   Sort   Display                          │
│ CURRENT TEAM                 ├────────────────────────────────────────────────────────────────────────────┤
│ Dashboard                    │ Backlog       Ready       In Progress       In Review       Done          │
│ Board                        │ ┌─────────┐   ┌─────────┐  ┌─────────┐       ┌─────────┐     ┌─────────┐   │
│ List                         │ │ Task     │   │ Task     │  │ Task     │       │ Task     │     │ Task     │   │
│ Projects                    │ └─────────┘   └─────────┘  └─────────┘       └─────────┘     └─────────┘   │
│ Work Requests               │ ┌─────────┐   ┌─────────┐  ┌─────────┐       ┌─────────┐     └─────────┘   │
│ Parking Lot                 │ │ Task     │   │ Task     │  │ Task     │       │ Task     │                 │
│ Library                     │ └─────────┘   └─────────┘  └─────────┘       └─────────┘                 │
│                              │ ... horizontally scrollable board                                            │
│                              │                                                                            │
│ Settings                    │                                                                            │
└──────────────────────────────┴────────────────────────────────────────────────────────────────────────────┘
```

**Intent:** stable navigation, compact page toolbar, board is the dominant working surface. Columns scroll horizontally rather than shrink below a useful card width. Navigation items vary according to the authorized team and permissions.

### 9.2 Board plus task detail panel

```text
┌──────────────────────────────┬────────────────────────────────────────────┬────────────────────────────┐
│ Stable team navigation       │ Board remains visible in context            │ Task detail panel          │
│                              │ (underlay does not shift unnecessarily)      │                            │
│                              │                                             │ DEV-0042   [In Progress]   │
│                              │                                             │ Update auth tests          │
│                              │                                             │ Description                │
│                              │                                             │                            │
│                              │                                             │ Assignee  Priority  Due    │
│                              │                                             │                            │
│                              │                                             │ Subtasks / dependencies    │
│                              │                                             │ Comments                   │
│                              │                                             │ Activity                   │
└──────────────────────────────┴────────────────────────────────────────────┴────────────────────────────┘
```

**Intent:** the side panel preserves board context; it must not hide or display fields the current user is not authorized to read. At narrow widths, use a full-screen detail flow rather than squeezing the panel.

### 9.3 Work Request boundary

```text
REQUESTER / FOUNDER VIEW                         DEVELOPER INTAKE VIEW
┌─────────────────────────────────────┐          ┌─────────────────────────────────────┐
│ My Requests                         │          │ Incoming Work Requests              │
│ [New request]                       │          │ Filters / triage queue               │
│                                     │          │                                     │
│ Request title                       │          │ Request title                       │
│ Public status                       │          │ Request + impact + requested date   │
│ Last published update               │          │ [Ask] [Accept/Plan] [Decline]        │
│ Requester-visible discussion        │          │ Internal triage notes (private)     │
│                                     │          │ Linked internal tasks (private)     │
│ No private task list or comments    │          │ Publish a deliberate progress update│
└─────────────────────────────────────┘          └─────────────────────────────────────┘
```

**Intent:** these are distinct experiences backed by a deliberate shared-request boundary. The requester sees published progress; developers see intake controls and private execution. The shared request is not a disguised link into the developer board.

### 9.4 Mobile work view

```text
┌──────────────────────────────┐
│ Qmatus          Search  Me   │
├──────────────────────────────┤
│ My Work                      │
│ [Filters] [Sort]             │
│                              │
│ OVERDUE                      │
│ ┌──────────────────────────┐ │
│ │ Task title               │ │
│ │ Team · Status · Due      │ │
│ └──────────────────────────┘ │
│                              │
│ TODAY                        │
│ ┌──────────────────────────┐ │
│ │ Task title               │ │
│ │ Team · Status            │ │
│ └──────────────────────────┘ │
│                              │
│ Home     My Work    Inbox    │
└──────────────────────────────┘
```

**Intent:** mobile prioritizes reading, quick updates, comments and intake over a desktop-like five-column board. Core actions remain available without precise drag gestures.

---

## 10. Screen-by-screen specification

These are screen requirements and interaction rules, not pixel-perfect wireframes. Layout can adapt to content, but the hierarchy and behaviors must remain consistent.

### 10.1 Sign-in, invitation and session states

**Goal:** get an invited teammate into the correct workspace without exposing private team structure.

- The sign-in screen is calm and direct: Qmatus wordmark, “Sign in to Qmatus”, configured authentication controls, and only the necessary recovery/help links.
- No public marketing navigation, feature grid, testimonial area or animated backdrop.
- Keep sign-in form width around 360–420px on desktop. On mobile, use the available width with 20–24px page padding.
- Invitation acceptance explains which organization/workspace the invite is for only when the invite token is valid and the user is authorized to see it.
- Invalid, expired or revoked invitation states provide next steps without revealing membership details.
- Loading state is compact and truthful. Avoid long spinner loops where text can explain the operation.
- When session expiry occurs during work, preserve non-sensitive draft text locally where safe, explain what happened and let the user retry after sign-in. Never persist private drafts across users on shared devices.
- Do not permit self-registration if the product uses invite-only onboarding; follow the functional specification's invite-only policy.

### 10.2 Team dashboard

**Goal:** answer “What needs attention?” in a few seconds.

Do not build a generic analytics dashboard full of cards and charts. Use a clear title, one or two lines of context, one primary action and a small number of working sections.

Suggested hierarchy:

1. Page title for the active team and an immediately useful primary action.
2. One compact summary strip only if the counts drive action (for example: My open work, Needs triage, Blocked, Due soon). Counts must be clickable into their filtered view and computed only over authorized records.
3. “Needs attention” list: overdue items, blockers, requests waiting for input or approvals relevant to the current person/team.
4. “Recently active” or “Upcoming milestones” only if enough reliable data exists.
5. Useful saved views or project entry points below the urgent work, not above it.

Do not show empty metric tiles, invented trends, fake percentages or meaningless “productivity scores.” If the team has little data, the empty state should guide the next real action (create a task, submit a request, invite a member) rather than imitate a populated dashboard.

### 10.3 My Work

**Goal:** make the user's next actions obvious without requiring them to inspect each team board.

- Default list view is recommended because it scans well across due dates and statuses.
- Group by an understandable section such as Overdue, Today, Upcoming, No due date, Completed recently; do not create groups that hide tasks.
- Include a clear filter for active/completed, due date, team (only allowed teams), project and priority.
- Show task title, team/project context, status, due date when relevant and the minimum necessary metadata.
- A task from another permitted team should clearly identify its team without allowing any inference about teams the person cannot access.
- Use a “Mark complete” action only if it is allowed for the current user and status; otherwise offer a permitted action or omit it.
- Keep query and filters in the URL when possible so views can be shared/bookmarked only where sharing itself is allowed. Personal saved views stay personal unless explicitly published.

### 10.4 Kanban Board — primary workspace screen

**Goal:** scan flow, understand ownership and blockers, move work with minimal friction.

**Structure:**

- Top toolbar: team/project context, view title, filters, display options, search within the view, and a primary “New task” action.
- Board lane area: columns ordered by the team's agreed workflow. Initial recommendation: Backlog, Ready, In Progress, In Review, Done. Keep Blocked as a separately visible state/flag unless the product's workflow explicitly chooses otherwise.
- Each column header has a label and count; optional WIP indicator is introduced only if configured and explained.
- Cards have consistent alignment and restrained borders. Cards should not appear as colorful mini dashboards.
- Horizontal scroll is predictable. Column widths should remain stable during normal use.

**Task-card content hierarchy:**

1. Issue key or short ID as quiet metadata.
2. Task title as the dominant readable content, up to two lines by default.
3. At most two labels/indicators, then a `+N` overflow marker when more exist.
4. Assignee avatar/initials with accessible name, and due date only when set/relevant.
5. Small subtask progress/comment/attachment metadata only when non-zero and useful.
6. Priority shown with icon/short label where it changes action; avoid a rainbow of priority color strips.

**Card interaction:**

- Click/tap opens the task detail panel. Clicking a small interactive element on the card must not accidentally open the card.
- Dragging changes status/order only after a valid drop. Provide keyboard and contextual-menu equivalents.
- A drag preview follows the pointer smoothly and the original location remains understandable.
- Dropping into a column requires server-side permission and valid state transition. If it fails, restore the prior placement, show a concise explanation and do not fake success.
- Provide a menu for allowed status change, assignment, copy-link and other actions. Do not rely on hover to expose all critical actions.
- Multi-select and bulk action UI should only be added when fully implemented and covered by keyboard and permission tests.
- Show blocked state in text/icon as well as color. Where useful, include a concise blocker reason on the detail view, not an overflowing paragraph on every card.
- A completed item may become visually quieter, but must remain readable and discoverable.

**Board options:**

- Board/List switch is visible and stable.
- Filters/grouping/order/display options live in one obvious panel.
- Per-user sort/filter/display preferences may be remembered. Team defaults should only change through an explicit “set as team default” action.
- “Clear filters” is available whenever filters are active.
- Columns may be collapsed only if their item count remains discoverable and a path exists to restore them.

### 10.5 List view

**Goal:** provide fast scanning, keyboard accessibility, dense review and an alternative to drag-and-drop.

- Use a real semantic table/list structure where appropriate; avoid rendering a grid of card-like rows.
- Keep task title left aligned, key/status/priority and owner consistent, and due date right aligned where suitable.
- Row height around 40–44px at default density. Allow rows with longer titles to grow or wrap without clipping essential content.
- Use a subtle hover background and clear selected/focused states.
- Sorting state must be visible and announced accessibly. Column headers must act as real buttons where interactive.
- Selection checkboxes need meaningful labels, including task identity.
- Bulk actions appear only after selection and remain keyboard reachable.
- Empty and filtered-empty states must distinguish “there are no tasks” from “no tasks match these filters.”

### 10.6 Task detail panel/page

**Goal:** answer what the task is, who owns it, what is expected, what is blocking it and what changed.

Recommended order:

1. Top row: task ID, status, close/back control and overflow menu.
2. Title and primary description.
3. Key fields: assignee, priority, due date, project/milestone and estimate if used.
4. Checklist/subtasks and dependency/blocker information.
5. Discussion/comments and attachments.
6. Activity history in chronological order.

Rules:

- Use a side panel for quick inspect/edit while preserving board context; deep editing can use a full page at narrow widths.
- Show only the fields the user can see/edit. A hidden field must not leak through the DOM, a disabled input, hover text, accessibility label or client payload.
- Label internal comments clearly when their audience is private. Shared Work Request conversation must be a separate permission-controlled surface.
- Make ownership and completion criteria easy to see. Do not bury status or assignee in a collapsed panel.
- Autosave only where safe and obvious. For multi-field edits, provide clear save/cancel behavior or explicitly indicate saving state. Do not say “Saved” before confirmation.
- If another user changes the task, provide a clear conflict or refreshed-state message instead of silently overwriting edits.
- Destructive actions require confirmation and clear consequences; reversible archive actions are preferred over immediate permanent deletion.

### 10.7 Projects and milestones

**Goal:** connect day-to-day tasks with outcomes without forcing the team into a heavyweight project management tool.

- Project overview shows purpose, owner, status/health, target date, milestones and linked tasks.
- A project summary uses concise prose and current facts; avoid generic circular progress graphics unless they answer a real question.
- Milestones have clear name, owner where relevant, target date, status, associated tasks and a completion criterion.
- Health state must have a definition and not be an opaque auto-generated score. Use “On track / At risk / Off track” only if the rules are explicit or a responsible owner sets it.
- Show blockers and at-risk milestone context before decorative progress charts.
- Respect team membership and project-level grants on the page, nested lists, linked task counts and all related routes.

### 10.8 Work Requests — controlled handoff across teams

This is a signature Qmatus workflow and should be designed carefully.

**Requester/founder view:**

- “New request” form with a plain-language title, problem/outcome, reason/impact, requested timeframe (not a guaranteed due date), links/attachments and optional priority suggestion.
- Explain that the receiving team triages the request and confirms actual priority/schedule.
- Show request status, last published progress update, requester-visible comments and requested clarification. Map the canonical states to plain-language requester labels; never expose internal-only triage state, private task status or internal activity by default.
- Show no private implementation tasks, internal notes, assignee detail, detailed estimates, internal timestamps or developer-only activity unless explicitly published through a defined capability.
- Use a visible “Request progress” timeline sourced from published updates rather than reflecting every internal task event automatically.

**Developer intake view:**

- A dedicated incoming queue mapped to the canonical request lifecycle: Draft, Submitted, In Triage, Needs Information, Accepted / Planned, In Progress, Delivered, Closed, with Declined as a terminal outcome. The requester-facing labels may be simpler (for example, “Under review”), but they must map transparently to the canonical state and must not expose private implementation details.
- Each request shows requester, impact, when submitted, target timeframe requested and triage owner.
- Triage actions include ask for information, accept/reject with reason, and link/create private internal work items after acceptance.
- Separate requester-visible discussion from internal triage notes. Audience labels must be unambiguous.
- Request state and internal task state are distinct. Internal work can change without exposing every transition to the requester.
- If request status is published, preview the exact fields/wording that the requester will see.
- Access to the request does not grant access to linked internal implementation tasks. A visible reference link must lead to an authorized-safe request view or a generic no-access response.

### 10.9 Parking Lot

**Goal:** capture ideas before they become commitments, without turning the space into an ignored backlog.

- Fast capture input is prominent and low friction.
- Use a list-first view with searchable title, status (active/pinned/promoted/archived or canonical equivalents), creator and last updated time.
- Detail view contains the idea, context, notes, related links and activity.
- Promotion flow asks where the idea should go: task, project or Work Request, based on the person's permissions.
- Promotion must not silently reveal the idea to another team. The user must choose an allowed destination and see its audience before confirming.
- Provide light triage: pin, promote, archive. Avoid adding elaborate scoring, voting or strategy matrices without a real team need.

### 10.10 Library

**Goal:** keep the team's most useful references discoverable.

- Support links, documents, tools, images/files and concise descriptions according to the product specification.
- List view should be the default for many references; use thumbnails only when they provide meaningful recognition.
- Each item shows title, type, audience/team, owner or last updated where helpful.
- Link destinations should be validated; external links open safely in a new context where appropriate and are visually identifiable.
- Private files live in private storage, with time-limited authorized access. Do not render public permanent URLs for private files.
- Search and filters only return authorized items. A title must not leak just because the contents are unavailable.
- Empty state suggests adding a setup doc, repository, deployment guide or frequently used tool link.

### 10.11 Inbox and notifications

**Goal:** deliver actionable information without becoming a noisy chat feed.

- Group by unread/read or recent date only if grouping aids scanning.
- Each notification should answer what happened, who did it, which accessible resource it concerns and what action is available.
- Include mark read/unread and clear all only where their effect is obvious and reversible.
- Prefer batching low-priority updates; do not notify users for every low-value metadata change.
- Mentions, assignment changes, requests needing input and access-grant decisions are higher-value.
- If access is revoked, previously received notification records must not reveal protected content through cached text or links. Show an access-safe message and invalidate stale resource data.
- Avoid toast-only communication for important durable events. Keep important items in the inbox.

### 10.12 Search and command menu

**Goal:** reach a task, view or action fast.

- `Cmd/Ctrl + K` opens the command/search menu. Show shortcut hints only when shortcuts actually work on the platform.
- Search result groups are simple: Tasks, Projects, Requests, Library—only for accessible resources.
- Query input autofocuses appropriately and Escape closes the overlay without losing unrelated unsaved data.
- Empty query may show a few useful commands or recent authorized items; it must not expose private team labels or resource counts.
- No-result state says what was searched and offers a next step (clear filters, try another phrase); it does not imply a private resource exists.
- Search results, suggestions, autocomplete, snippets, ranking metadata and counts must be authorization-filtered server-side before display.
- Keep keyboard navigation predictable; arrow keys move selection, Enter opens/executes, Escape closes. Screen-reader announcement must follow the selected result.

### 10.13 Administration and access grants

This screen must prioritize clarity over compactness because a wrong click can expose private information.

- Members table includes identity, team memberships, role, invitation/session status and authorized actions.
- Access grants show **person + team/resource + exact permission scope + grantor + reason + created date + expiry (if any) + approval state**.
- Do not use vague labels such as “full admin access” when granting a narrower permission. Show an understandable preview: “Can view published request updates only” vs “Can read the Developer Team workspace”.
- No self-grant action is available. Broader private-team grants must use the additional approval required by the functional specification.
- Riskier permission changes use a confirmation screen with exact affected person and scope; high-risk changes display what information will become visible.
- Expired/revoked grants are visually distinct from active grants and cannot be revived accidentally by stale UI state.
- The UI must not suggest that an administrator can automatically read every team's private content.
- Audit history is read-only and has a clear timestamp/actor/action/target/outcome; do not add an ordinary edit/delete interface for audit events.

### 10.14 Settings and profile

- Group settings into Profile, Appearance, Notifications, Security/Sessions and team/workspace settings where authorized.
- Appearance includes System/Light/Dark. Theme changes apply instantly and persist.
- Notification settings should use understandable event descriptions, not a matrix of unexplained toggles.
- Session management provides clear revoke/sign-out actions where supported.
- Team settings and global organization settings must not be conflated. Only people with the relevant permission see the controls.
- Save state must be explicit. Inline save is fine for a single safe preference; complex changes should present Save/Cancel.

### 10.15 Loading, empty, error and destructive states

Every feature needs all of these states before it is considered complete:

- **Loading:** shape-matched skeleton or brief progress text; no flashing layout jumps or endless spinners.
- **Empty:** explain why the area is empty and give one useful next action. Do not decorate an empty dashboard with placeholder metrics.
- **Filtered-empty:** distinguish no data from no matches and offer “Clear filters”.
- **Error:** plain-language message, no secret/internal stack trace, and a recovery action where possible.
- **Permission denied:** do not reveal existence/content of a private resource. Use a safe, consistent response and offer access-request flow only if policy allows it.
- **Conflict:** explain that the record changed elsewhere and provide refresh/compare/retry behavior.
- **Offline/network failure:** preserve safe drafts, identify unsaved changes and avoid claiming an operation succeeded.
- **Destructive action:** state what will be deleted/revoked/archived, whether it is reversible and what downstream effect it has.
- **Success:** concise, task-related confirmation; no confetti for routine work.

---

## 11. Component design language

Use a single reusable component system with semantic tokens. `shadcn/ui` built on Radix primitives is an acceptable starting point if already chosen for the implementation, but do not ship its defaults without customization. Radix or equivalent primitives should supply accessible interactions; Qmatus owns the final visual styling, spacing, copy and state behavior.

### 11.1 Buttons

- **Primary:** solid signal blue with white label; reserved for the page's principal action.
- **Secondary:** neutral outline or surface treatment.
- **Quiet/tertiary:** transparent, low emphasis, stronger hover/focus state.
- **Destructive:** danger treatment only where the action is destructive.
- **Icon-only:** only for universally recognizable actions; otherwise provide visible text. Always provide an accessible name and tooltip when useful.
- Use a 36px default desktop control height for common actions; use 40–44px or larger touch targets on mobile where practical. Do not sacrifice hit area for visual compactness.
- Loading button state should prevent duplicate submission when necessary and explain the in-progress action; do not move the button's geometry while loading.

### 11.2 Inputs and forms

- Labels remain visible; placeholders are examples, not substitutes for labels.
- Use clear required/optional labels where ambiguity exists.
- Validation should appear near the field and be announced to assistive technology.
- Preserve user input when validation or server errors occur.
- Group related form fields; avoid giant single-column forms with every field shown at once when a clear sectioning or progressive disclosure would help.
- Controls need default, hover, focus, filled, disabled, invalid and success states in both themes.

### 11.3 Menus, dialogs and drawers

- Menus are compact and task-oriented; do not turn them into secondary pages.
- Dialogs are for focused decisions, destructive confirmations or short forms. Large task/project forms should use a page or sizeable drawer.
- Manage focus on open/close; Escape behavior must be predictable; clicking outside should not discard unsaved work without warning.
- Drawers use a consistent entrance/dismiss direction. Detail panel should not slide from different edges on different pages.
- Tooltips should appear after a modest delay; adjacent tooltips should not repeat the full delay once one is open.

### 11.4 Badges, chips and avatars

- Badges use text labels and moderate 4px corners; don't use pills for every piece of metadata.
- Chips are removable only if they actually represent removable filters/tags. Decorative chips must not look interactive.
- Keep label count restrained. Show `+N` instead of wrapping a card into multiple badge rows.
- Avatar image is optional. Initials with deterministic neutral background are acceptable; fake stock portraits are not.
- Avatar color must not imply role, skill, priority or permission unless that mapping is explicit and documented.

### 11.5 Tables and data display

- Prioritize aligned text, clear columns and quiet row separators.
- Use tabular numerals for dates/counts where available.
- Dense tables must allow horizontal scrolling or column visibility controls on smaller screens; avoid collapsing columns without a discoverable way to inspect them.
- Sorting, filtering and selected row state must have visible/accessible indicators.
- Empty tables need a purposeful empty state, not blank rows or fake samples presented as live data.

### 11.6 Icons

- Use one consistent line-icon set (Lucide is a recommendation), normally 16px in compact controls and 18px in primary navigation.
- Avoid mixing emoji, filled icons, multi-color illustrations and several icon families.
- Use an icon plus label for unfamiliar/high-impact actions, particularly permissions, delete, archive, publish, revoke and blocked state.
- Icons must not be the only accessible name for controls.

---

## 12. Motion and micro-interaction system

Motion is part of the design system but intentionally low intensity. The purpose is to make the interface feel responsive, maintain spatial understanding and confirm meaningful state change—not to keep the screen animated.

### 12.1 Motion tokens

Use these starting tokens and tune only after reviewing real interactions:

```css
:root {
  --ease-out-ui: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out-spatial: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);

  --duration-instant: 80ms;
  --duration-hover: 120ms;
  --duration-fast: 150ms;
  --duration-standard: 180ms;
  --duration-panel: 220ms;
  --duration-complex: 260ms;
}
```

These are initial design tokens, not a mandate to animate every component. Always inspect perceived speed and interruptibility in browser.

### 12.2 Interaction motion map

| Interaction | Motion | Starting timing | Why |
|---|---|---:|---|
| Hover/focus/background change | Color/background/border only, very subtle | 100–140ms | Feedback without visual noise |
| Button press | Tiny immediate visual response; no cartoon bounce | 80–120ms | Confirm input was received |
| Menu/popover open | Fade plus very small scale/translate if it improves anchoring | 120–160ms | Establish relationship to trigger |
| Tooltip first open | Short fade/scale after a delay | ~125ms after ~350ms delay | Avoid accidental tooltip flicker |
| Task detail drawer | Short opacity + horizontal transition | 180–240ms | Preserve spatial context |
| Modal open/close | Fade + minimal scale, or fade only | 140–200ms | Clear overlay state without a dramatic zoom |
| Kanban card drag | Directly follows pointer; small elevation increase | Gesture-driven | Maintain control and spatial awareness |
| Kanban drop | Brief settle into final position; no overshoot/bounce | 120–180ms | Communicate accepted drop |
| Status change outside drag | Brief color/label feedback; no full-card flight | 120–180ms | Confirm state without slowing repeat work |
| Toast | Quick fade/short vertical offset; stable exit | 160–200ms | Confirm a completed action |
| Inline save success | Small icon/label transition | 100–160ms | Show persisted state without page movement |
| Loading indicator | Only while needed; no decorative pulsing UI | State-dependent | Communicate actual waiting |

### 12.3 Motion rules

- Frequently repeated actions should be nearly instantaneous. Do not make task scanning wait for staggered card animations.
- Use CSS transitions for simple hover/state changes and other easily interrupted effects. Avoid restarting keyframe animations on rapidly changing UI states.
- Animate `transform` and `opacity` where suitable; avoid animating `height`, `width`, `top`, `left` or other layout-driving properties unless necessary and performance-tested.
- Do not animate every dashboard count from zero. Counts should be readable immediately.
- No infinite decorative animation, shimmer that continues after content is ready, pulsing notification dots, animated gradient backgrounds or confetti.
- Drag interactions must remain responsive and keyboard accessible; animation may never be the only signal that an action worked.
- All motion is interruptible. A user must not wait for an animation to finish before opening another task, closing a panel or reversing a choice.
- Use one motion system, not overlapping animation libraries. CSS is the default; add Motion for React only when layout continuity/gesture behavior measurably improves UX.

### 12.4 Reduced motion

- Honor `prefers-reduced-motion: reduce` from the first implementation.
- Disable large positional/scale transforms, auto-playing movement, parallax and nonessential layout animation.
- Prefer a brief opacity/color transition or immediate state change instead.
- Do not remove necessary feedback; replace movement with a visible status, outline, label or icon change.
- Test board drag/drop and drawer flows with reduced motion enabled. Accessibility is not complete if only the home screen respects it.

---

## 13. Accessibility and usability baseline

Target **WCAG 2.2 AA** for the web application. A visually attractive screen that cannot be navigated or understood is not accepted.

### 13.1 Contrast and color

- Normal body text: at least 4.5:1 contrast against its rendered surface.
- Large text and meaningful control boundaries/state indicators: at least 3:1 where WCAG requires it.
- The proposed primary/secondary text colors are selected for strong contrast; all final combinations, including badge text, disabled/error states, focus rings and hover states, must still be measured.
- Never use disabled opacity to the point that text becomes unreadable; explain why a disabled action is unavailable when the reason matters.
- Status, priority, permission and error meaning must include text, shape or icon—not color alone.

### 13.2 Keyboard and focus

- Every interactive action is reachable by keyboard in a logical order.
- Focus indicator is clearly visible in both themes and is not clipped by overflow containers.
- Board items can be moved/updated without drag; context menu or keyboard action is available.
- Menus, dialogs and drawers manage focus and return it to the invoking control on close.
- Escape closes transient UI unless doing so would lose unsaved work; in that case, ask for confirmation.
- Global shortcuts avoid capturing keystrokes while users are typing.
- Provide a shortcut-help surface or documented shortcut hints. Do not invent shortcuts in labels unless implemented.

### 13.3 Semantics and assistive technology

- Use semantic buttons, links, labels, headings, tables/lists and form error associations.
- Accessible names must identify the resource as well as the action (e.g. “Open task QMT-123: Update auth tests”).
- Status changes, toasts and form validation should be announced in a non-disruptive live region when appropriate.
- Avatar initials and icon-only controls need accessible labels. Decorative icons are hidden from the accessibility tree.
- Moving an item between columns should announce its new status to the initiating user where feasible.
- Don't put meaningful content only in a tooltip, hover state, placeholder or color.

### 13.4 Target size and touch

- Target at least 24 × 24 CSS px where WCAG allows; aim for 36–44px touch targets for common controls.
- Small decorative icons may be smaller, but their interactive hit area must be large enough.
- Task card menus and inline buttons must not require precise pointer placement.
- Dragging cannot be the only way to reorder or change task status.

### 13.5 Reading and zoom

- Verify layout at 200% browser zoom and narrow reflow widths.
- Don't clip form errors, task titles or permission explanations.
- Maintain adequate line-height and spacing for longer comments and descriptions.
- User-supplied titles/URLs and translated or long names must not break the layout.

---

## 14. Performance and implementation guidance

These are UI-system recommendations; the functional spec remains the authority for authentication, data access, security and domain logic.

- Keep a single source of truth for tokens in CSS variables/design tokens. Components must consume semantic tokens, not hard-coded hex values spread across files.
- Keep shared UI components presentation-focused. Authorization and business rules remain on the server/domain side as defined in the companion specification.
- Do not render all team data client-side and hide it with CSS. The server must return only authorized DTOs.
- Avoid unnecessary animation libraries and heavy dashboard chart packages before charts have a demonstrated need.
- Lazy-load non-critical detail content, but do not make the primary board feel segmented by excessive suspense boundaries or layout shifts.
- Use skeletons only when their shape closely matches the eventual screen. For very short operations, keep the layout still and provide no loader or a tiny inline indicator.
- Preserve stable geometry for task cards so asynchronous labels/avatars do not make the board jump repeatedly.
- Theme is set before visible paint; font loading must avoid excessive layout shift.
- Keep browser dev console free of React key, hydration, accessibility and asset errors in supported workflows.
- Implement an intentional empty/loading/error state for each data-dependent module, rather than a blank page.

### Suggested UI implementation foundations

- Next.js App Router + React + TypeScript, consistent with the companion architecture.
- Tailwind CSS or an equivalent token-driven styling system; do not mix several competing style approaches.
- Radix primitives (or equally accessible alternatives) for menus/dialogs/selects/checkboxes where they genuinely help; customize them using Qmatus tokens.
- A consistent icon set such as Lucide.
- CSS transitions first; use a single motion library only for justified complex transitions.
- A reliable drag-and-drop library with keyboard support for Kanban, selected after checking current maintenance, accessibility and framework compatibility.

The exact package versions and APIs must be verified when the final coding plan is written. This document does not mandate an unreviewed dependency just because a skill uses it in an example.

---

## 15. Design QA and visual regression protocol

UI quality is verified against rendered behavior, not asserted by the agent. Every representative review should include both themes and the widths that exercise layout changes.

### 15.1 Mandatory viewports

- Desktop: 1440 × 900px and 1280 × 800px.
- Tablet: approximately 1024 × 768px and 768 × 1024px.
- Mobile: 390 × 844px and 320 × 720px.
- Verify at 200% browser zoom and with reduced motion.

### 15.2 Representative screen matrix

Review at least these screens before the UI is approved:

1. Sign-in and valid invitation acceptance.
2. My Work in a populated and empty state.
3. Team Dashboard in populated, low-data and no-access contexts.
4. Kanban board with long titles, many labels, blocked cards, due dates, no tasks and many tasks.
5. Task detail with comments, checklist, attachment and conflict/error states.
6. Work Request submission, requester tracking, developer intake and request needing information.
7. Project/milestone detail with blocked or at-risk status.
8. Parking Lot capture/search/promotion.
9. Library items and private-file access handling.
10. Search/command menu and no results.
11. Inbox with unread/empty/error states.
12. Access-grant creation, second approval, expiry/revocation and audit detail.
13. Settings with Light, Dark and System themes.

### 15.3 Review sequence

For every representative screen:

1. Load real seeded test data, not hard-coded demo markup presented as live product behavior.
2. Inspect both Light and Dark mode.
3. Inspect normal, hover, keyboard focus, selected, disabled, loading, empty, error and long-content states.
4. Test keyboard-only navigation and relevant screen-reader semantics.
5. Check at required responsive widths and 200% zoom.
6. Trigger real operations and confirm visible success only after the server confirms persistence.
7. Test a denied or revoked permission using a non-authorized test identity; ensure the UI, result count, URL and notification don't expose protected details.
8. Capture a screenshot, rank the findings by severity, fix the most serious issue and repeat.
9. Run design checks (including Impeccable audit/detector if installed), type checks, lint, tests and the appropriate end-to-end suite.
10. Record any intentionally accepted issue with its reason and follow-up owner; never silently ignore a critical defect.

### 15.4 Visual quality rubric

Score each category from 0–5 during review:

| Category | 0 | 5 |
|---|---|---|
| Hierarchy | No clear focal point | Primary action and information are immediately obvious |
| Typography | Inconsistent, cramped or generic | Consistent scale, legible at real work density |
| Spacing/alignment | Arbitrary gaps, misaligned controls | Deliberate, repeatable rhythm and stable alignment |
| Color/theme | Poor contrast or inconsistent theme mapping | Semantic, restrained and correct in both themes |
| Data density | Empty decoration or overwhelming clutter | Useful information fits the workflow with no noise |
| Interactions | Missing/unclear states | Predictable pointer/keyboard states and honest feedback |
| Motion | Decorative, slow or disorienting | Brief, purposeful, interruptible and reduced-motion aware |
| Responsive | Broken or overflow-heavy | Core actions work at all required widths |
| Accessibility | Visual-only, weak focus/labels | Keyboard, contrast, semantics, touch and zoom verified |
| Product fit | Generic SaaS template | Clearly built around Qmatus's actual team workflows |

Target: **at least 4/5 in every category** for a screen to be accepted. A high average does not compensate for a low accessibility, privacy or interaction score. Any security/privacy leak, blocked core task or missing keyboard path is a release blocker regardless of score.

### 15.5 Release-blocking UI defects

- Any private team/resource name, task content, count or file is exposed to an unauthorized person.
- A user can trigger an action through UI/API without permission; backend authorization tests are owned by the functional spec.
- Primary text, controls or focus states fail required contrast/accessibility behavior.
- A critical workflow requires drag-only or pointer-only interaction.
- A control looks actionable but doesn't work or gives false success feedback.
- Theme switch breaks readability, hides selected state or causes a persistent flash.
- Mobile/narrow layout loses access to a core action or causes major page overflow.
- Reduced-motion settings are ignored in major motion behaviors.
- An unrecoverable action lacks confirmation or consequence clarity.

---

## 16. Definition of UI/UX done

A screen/module is complete only when all are true:

- Its hierarchy, layout and states follow this specification or have a documented, approved exception.
- It uses semantic design tokens and shared components rather than one-off styles for repeated patterns.
- Light, Dark and System behavior is correct and persisted as specified.
- Responsive states are checked at the agreed viewports.
- Pointer, keyboard and appropriate touch paths work.
- It includes loading, empty, filtered-empty, error, permission-denied, success and conflict states relevant to the module.
- Content is real and derived from authorized server data; no fake live data.
- Color, focus, labels, semantics, zoom and reduced motion are tested.
- High-risk Work Request and permission surfaces have been checked for accidental data disclosure.
- The screen has been inspected in a real browser at least once after changes, not just reviewed as JSX/CSS.
- Impeccable or equivalent critique/audit has been run, important findings fixed, and the final result rechecked.
- Test results and known limitations are reported honestly.

---

## 17. Handoff to the final coding master prompt

The final implementation prompt should use **both** this UI/UX document and `qmatus_team_tracker_final_spec_v3_1.md`.

- The product/technical specification defines what the system does, who can access it, data boundaries, architecture, domain rules, security, reliability and acceptance criteria.
- This UI/UX specification defines how users experience it: visual language, tokens, themes, hierarchy, navigation, responsive behavior, components, motion and visual quality gates.
- These documents are complementary. Do not collapse them into an ambiguous list of features.
- Security and domain rules prevail if a design choice conflicts with them.
- Before substantial UI implementation, the coding agent should establish `PRODUCT.md` and `DESIGN.md` using the approved context/tokens, then work in vertical slices: build, test behavior, inspect screenshots, critique, fix, and re-test.
- The final master prompt must instruct the agent to read the actual installed versions of Taste/Emil/Impeccable skill files before using them. If the skills aren't installed, the agent must either install from the official/maintainer repository with user-approved setup or follow the equivalent rules in these documents; it must not claim to have run a skill it could not access.
- The Taste skill's current upstream scope exclusion for dashboards/app screens must be respected. Apply its anti-generic and real-browser evaluation principles, not its landing-page recipe.
- Do not start implementation from a vague instruction such as “make it premium.” Use these tokens, screen requirements, motion rules and acceptance gates as the actual contract.

---

## 18. Sources and further reading

All references below inform design methods and interaction patterns. They are not instructions to copy another product's branding. Verify current skill versions and dependency APIs when implementation begins.

### Skills and design workflow

- Taste Skill v2: https://github.com/Leonxlnx/taste-skill
- Taste Skill screen-scope note (`Not for dashboards or app screens`): https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md
- Emil Kowalski `emil-design-eng` skill: https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md
- Emil Kowalski `animate` skill: https://github.com/emilkowalski/skills/tree/main/skills/animate
- Emil Kowalski `review-animations` skill: https://github.com/emilkowalski/skills/tree/main/skills/review-animations
- Emil Kowalski's Animations on the Web: https://animations.dev/
- Impeccable home and install documentation: https://impeccable.style/
- Impeccable command/reference documentation: https://impeccable.style/docs/
- Impeccable audit: https://impeccable.style/docs/audit/
- Impeccable colorize: https://impeccable.style/docs/colorize/
- Impeccable `DESIGN.md` structure: https://impeccable.style/docs/document/

### Product UI inspiration and accessibility

- Linear display options: https://linear.app/docs/display-options
- Linear issue selection and keyboard/bulk actions: https://linear.app/docs/select-issues
- Linear Kanban/selection interface: https://linear.app/changelog/issue-selection
- Atlassian color foundations and dark mode: https://atlassian.design/foundations/color/
- Radix UI accessibility: https://www.radix-ui.com/primitives/docs/overview/accessibility
- Motion for React accessibility/reduced motion: https://motion.dev/docs/react-accessibility
- Apple Human Interface Guidelines — Motion principles: https://developer.apple.com/design/human-interface-guidelines/motion
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C WCAG 2.2 — dragging movements: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/

---

## Final design recommendation

Build Qmatus around **quiet visual confidence and excellent daily interaction**. Use an ink-and-paper neutral system, signal blue only where it clarifies interaction, IBM Plex typography, crisp 6–10px corners, restrained borders, a carefully composed dark theme, and very short purposeful motion. Make the Kanban board visually excellent but never let it be the only way to work. Keep founder requests and developer execution visibly distinct. Make every state truthful, every interaction accessible and every private boundary obvious to the application even when it isn't exposed visually.

The standard is not “looks impressive in a single screenshot.” The standard is **looks coherent, works quickly, remains readable, respects privacy, and feels polished after a teammate has used it all day**.
