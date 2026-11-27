# Design system — “Clinical clarity” (PRD Theme A)

Tokens live in `src/index.css` (`:root` + `@theme inline`). Components never use raw hex values for status.

## Colour

| Token | Value | Use |
|---|---|---|
| `--ls-bg` | `#F5F7FA` | Page background |
| `--ls-surface` | `#FFFFFF` | Panels, inputs |
| `--ls-text` | `#142B45` | Text (13.4:1 on background) |
| `--ls-muted` | `#52647A` | Secondary text (5.65:1) |
| `--ls-primary` | `#153C63` | Navy: sidebar, primary buttons, selected state |
| `--ls-accent` | `#087F76` | Teal: approve/continue, focus ring, approved gates (4.88:1 on white) |
| `--ls-border` | `#D8E1EA` | Dividers only |
| `--ls-input-border` | `#7C8EA3` | Form-control boundaries (3.36:1) — documented adjustment |
| Status: review | `#92400E` on `#FFF3D6` | Needs review (6.4:1) |
| Status: processing | `#174E87` on `#E7F1FF` | Processing / Revising (7.4:1) |
| Status: completed | `#166534` on `#E8F5EC` | Completed / approved (6.4:1) |
| Status: blocked | `#991B1B` on `#FEECEC` | Action needed (7.3:1) |
| Status: draft | `#475569` on `#EEF2F6` | Draft / archived (6.7:1) |

Colour is never the only signal: every status has an icon and a text label.

## Typography

| Role | Face | Size |
|---|---|---|
| Page titles, greeting, document headings | Source Serif 4 (semibold) | 30–40 px |
| Section titles | Source Sans 3 semibold | 20 px |
| Body / UI | Source Sans 3 | 17 px (`text-base`), 15 px (`text-sm`), 13 px minimum (`text-xs`) |
| Lecture documents, transcripts | Source Serif 4 | 17 px, line-height 1.75, ≤ 72 ch |
| Egyptian Arabic content | Noto Naskh Arabic | 18 px, line-height 1.95, isolated `dir="rtl" lang="ar-EG"` region, each block `dir="auto"` |

Numbers that change (counts, timings) use tabular figures.

## Spacing, shape, elevation

- 4 px grid; page gutters 16 px (phone) / 32 px (laptop); panel padding 20 px.
- Radius by hierarchy: panels 14 px, controls 8 px, badges 6 px.
- Borders instead of shadows. Shadows only on overlays (dialogs, popovers, toasts).
- Motion 150–200 ms and only in response to actions. `prefers-reduced-motion` disables animation.

## Components

| Pattern | Implementation |
|---|---|
| Buttons | `Button` variants: default (navy), accent (teal, approve), outline, secondary, ghost, destructive, link. Heights 36/40/44 px. Navigation uses `ButtonLink` (a real link). |
| Status | `StatusBadge`, `ToneBadge`, `GateCode` (serif gate code on amber) |
| Production line | `ProductionRail` (horizontal on tablet/desktop, vertical list on phone) and compact `GatePips` |
| Forms | Visible labels, help text, inline errors with `role="alert"`, an error summary that receives focus, native selects, `ChoiceGroup` (radio fieldset) |
| Dialogs | shadcn/Base UI `Dialog` and `AlertDialog` (focus trap, Escape, focus return), sticky footer |
| Empty states | `EmptyState` (heading + action) |
| Loading | Route-level skeletons; job states shown as text with a labelled demo timer (no fake percentages) |
| Errors | Alert with what happened, what was kept, the fix and Retry |
| Navigation | Expanded navy sidebar (≥ 1024 px), a sheet menu on smaller screens, header bell with unread count |
