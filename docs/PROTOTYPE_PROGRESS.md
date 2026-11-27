# Prototype progress

Branch: `feat/interactive-prototype` (local only, never pushed). Base: `main` at `3d8fd6e`.

| Phase | Scope | Commit | Verification |
|---|---|---|---|
| 0–3 | Tooling, design tokens, shadcn/Base UI, pure workflow engine + unit tests, synthetic media, all screens including the six review gates | `16eb59c` feat: build lecture studio foundation, workspace and simulated six-gate workflow | `pnpm build`, 22 Vitest tests, screenshots of every route at 1440 px (no overflow, no console errors) |
| 4 | Complete lifecycle checked end-to-end: D01–D10, accessibility, responsive, CRUD; fixes found by those tests | `5a63a5f` feat: complete simulated lecture lifecycle with end-to-end coverage | 29 Playwright tests pass; axe clean on 16 page states |
| 5 | UI/UX refinement from screenshot review and an independent guideline audit (20 findings) | `591e252` refactor: refine UI/UX from screenshot review and accessibility audit | 22 unit + 29 E2E pass |
| 6 | Final verification, documentation, 87 screenshots | docs commit (latest on the branch) | `pnpm build`, production preview smoke test, `pnpm test`, `pnpm test:e2e`, `pnpm screenshots` |

Phases 0–3 were built together because the shell, the engine and the screens depend on each other. Splitting them into
separate commits would have meant committing states that were never run. This is recorded honestly instead.

## Notable issues found and fixed during verification

| Found by | Issue | Fix |
|---|---|---|
| Engine unit test | A content change did not reset H3–H5 approvals | Content revision included in the H3/H4/H5 fingerprints |
| Screenshot review | Tabs rendered beside their content (generated `data-horizontal` selector did not match Base UI's `data-orientation`) | Selectors corrected in tabs, toggle-group and separator |
| Dev-server errors | Duplicate React copies after Vite re-optimised dependencies for lazy routes | `optimizeDeps.entries` scans all sources up front |
| E2E | Navigation buttons were announced as buttons (`role="button"` on anchors) | `ButtonLink` renders real links |
| E2E | Empty-state titles were not headings | `EmptyTitle` renders `<h2>` |
| E2E | First-run checklist hidden in the empty workspace | Shown next to the empty state |
| E2E (320–768 px) | Prompts, Settings and Deliverables overflowed horizontally | `grid-cols-1` base on every responsive grid |
| E2E | Delete buttons that refused on click | Replaced with a visible reason (“In use — archive instead”) |
| Screenshot review | Gate confirmations at the bottom of long documents, far from Approve | Moved into the decision panel |
| Screenshot review | English lines inside Arabic documents forced right-to-left | `dir="auto"` per block inside the isolated RTL region |
| Screenshot review | Draft-frame text clipped for Arabic lectures | Direction and anchor chosen per string |
| Screenshot review + audit | H1 two-column layout cramped at 1280–1440 px | Side by side by default only from 1600 px; draft first below that |
| Screenshot review | The phone floating action button covered list rows on Home | Hidden where the page has its own primary action |
| Independent audit | Faint focus ring, label-in-name, noisy alerts, silent loss of drafts, buttons used for navigation, unconfirmed delete, heading levels, empty caption track | See VERIFICATION.md — Accessibility findings |
