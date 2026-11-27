# Lecture Studio — interactive prototype

A clickable, fully simulated prototype of a lecture-to-video workspace for Dr. Ashraf Elbasel.
AI-to-AI hand-offs happen automatically; the doctor is asked only at the six human approval gates (H1–H6).

> **Everything is simulated.** No AI provider is called, no API key is requested or stored, no email or push
> notification is sent, and no money is spent. All lecture content is synthetic and is **not medical guidance**.

## Run it

Requirements: Node.js 20+ and pnpm 10 (`corepack enable` provides pnpm).

```bash
pnpm install
pnpm dev
```

Open **http://localhost:5180**. The first visit loads the synthetic demo automatically.

| Command | What it does |
|---|---|
| `pnpm dev` | Development server on http://localhost:5180 |
| `pnpm build` then `pnpm preview` | Production build, served on http://localhost:5181 |
| `pnpm test` | Vitest unit tests for the workflow engine (22 tests) |
| `pnpm test:e2e` | Playwright browser tests: PRD scenarios D01–D10, accessibility, responsive, CRUD (29 tests) |
| `pnpm screenshots` | Regenerates `docs/screenshots/` at 1440, 1280, 768, 390 and 320 px |

First-time Playwright setup: `pnpm exec playwright install chromium`.

## Reset the demo

**Settings → Demo controls → Reset demo data** restores the synthetic lectures, prompts and settings
(with confirmation). **Start with an empty workspace** shows the first-run experience.
Data lives only in this browser's `localStorage` (key `lecture-studio:demo-state`, schema version 1).

## Controlling the simulation

Settings → Demo controls:

- **Job speed** — *Fast demo* (3–7 s per job, default), *Relaxed* (20–60 s) or *Manual* (jobs wait for
  “Finish running jobs”; used by automated tests).
- **Finish running jobs now** — also available on any lecture that is processing.
- **Fail the next job** — quota (429), timeout or offline, to demonstrate the blocked state and retry.
  Budget, credential and model errors come from real settings (lower the budget, disconnect a provider,
  or pick a model marked “unavailable”).

Jobs store a due time. If you close the tab, nothing runs, but on reopening, work that would have finished
is reconciled immediately and you're told how many jobs finished while you were away. In V1, a real server
runs jobs around the clock.

## A five-minute walkthrough for Dr. Ashraf

See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). In short: start a lecture → leave → get notified →
review and correct → approve → it continues by itself → finish → deliverables.

## What's real vs simulated

| Real in the prototype | Simulated |
|---|---|
| Workflow rules: six gates, version-bound approvals, invalidation, targeted revisions, 60–90 s chunk plan | All AI generation (Gemini, Claude, TTS) and rendering |
| Persistence, refresh/reopen recovery, cross-tab sync | Provider connections, model lists, costs, budget |
| Prompt library, versions, categories, Skills records | Skill import and verification |
| Downloads: canonical Markdown, a paired PDF generated in the browser from that exact text (English), storyboard, transcripts, manifest | Email/push delivery (logged as “Simulated — not sent”) |
| Sample audio and video files (clearly labelled placeholders) | Measured audio durations, render report |

## Project structure

```
src/
  engine/        Pure, deterministic workflow simulator (no React) — replaceable by a real API later
    workflow.js    stage derivation, jobs, decisions, direct edits, notifications
    library.js     prompts, categories, Skills, settings operations
    chunks.js      60–90 s chunk planning (port of the baseline helper rules)
    content.js     synthetic lecture text, storyboard, transcripts, audio measurements
    seed.js        synthetic demo fixtures, produced by driving the real engine
  state/store.jsx  React binding: persistence, 1 s simulation clock, toasts, test hooks
  pages/           Screens (Home, Lectures, NewLecture, LectureDetail, Reviews, review/*, Prompts, Skills, Notifications, Settings)
  components/app/  Product components (production rail, status badges, pickers, dialogs)
  components/ui/   shadcn/ui components (Base UI, JSX)
e2e/               Playwright tests and the screenshot generator
docs/              Progress log, decisions, verification, design review, demo script, backlog, screenshots
public/samples/    Synthetic audio/video (regenerate with scripts/generate-samples.sh on macOS)
```

## Documentation

- [docs/PROTOTYPE_PROGRESS.md](docs/PROTOTYPE_PROGRESS.md) — phases, commits, what changed
- [docs/DECISIONS.md](docs/DECISIONS.md) — assumptions, independent design decisions, baseline conflicts
- [docs/VERIFICATION.md](docs/VERIFICATION.md) — test results, accessibility findings, known limitations
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — tokens, typography, components
- [docs/DESIGN_REVIEW.md](docs/DESIGN_REVIEW.md) — consultation questionnaire for the next iteration
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) — recommended demonstration journey
- [docs/BACKLOG.md](docs/BACKLOG.md) — prioritized improvements and ideas
