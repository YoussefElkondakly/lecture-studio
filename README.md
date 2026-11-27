# Lecture Studio — interactive prototype

A clickable, fully simulated prototype of a lecture-to-video workspace for Dr. Ashraf Elbasel.
AI-to-AI hand-offs happen automatically; the doctor is asked only at the six human approval gates (H1–H6).

> **Everything is simulated.** No AI provider is called, no API key is requested or stored, no email or push
> notification is sent, and no money is spent. All lecture content is synthetic and is **not medical guidance**.
> Do not enter real medical records, patient information or API credentials.

**Live demo:** https://youssefelkondakly.github.io/lecture-studio/ (GitHub Pages, deployed automatically from `main`).

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
| `pnpm build:pages` | Production build for GitHub Pages (base `/lecture-studio/`, adds `404.html` and `.nojekyll`) |
| `node scripts/serve-pages.mjs` | Serves `dist/` like GitHub Pages at http://127.0.0.1:4174/lecture-studio/ |
| `PAGES_URL=<site url> pnpm test:pages` | Verifies a deployed (or emulated) Pages site: routes, deep links, assets, downloads, phone layout |

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

## Deployment (GitHub Pages)

```
local development ──► feature branch ──► pull request / merge ──► main
                                                                   │
                          GitHub Actions: .github/workflows/deploy.yml
                          verify: pnpm install --frozen-lockfile → unit tests → browser tests
                                  → pnpm build:pages → hosted-site tests against a Pages emulator
                          deploy (main only, after verify passes): upload-pages-artifact → deploy-pages
                          live-check: waits for the new build on the CDN → Playwright tests the public URL
                                                                   │
                              https://youssefelkondakly.github.io/lecture-studio/
```

- **Every push to `main` that passes verification updates the public site.** Pushes to other branches and pull
  requests run the same verification without deploying. A manual run is available from the Actions tab
  (*Run workflow*). It deploys only when run on `main`.
- Deployments never overlap (`concurrency: pages`, not cancelled mid-way). A newer push supersedes an older
  verification run.
- The workflow uses only the built-in `GITHUB_TOKEN` with the minimum permissions (`contents: read` to verify,
  `pages: write` + `id-token: write` to deploy). No personal tokens or secrets are stored in the repository.
- Pages is configured with source **GitHub Actions** (`build_type: workflow`), set once through the GitHub API.
- **Where the tests run:** all tests run on free GitHub Actions runners (unlimited minutes for public repositories).
  GitHub Pages only serves the finished static files. The `live-check` job tests the public site after every
  deployment and uploads its screenshots as the `live-site-verification` artifact. A failing live check marks the
  run red but does not roll back. Fix forward with a new commit to `main`.

**Routing on static hosting.** The app keeps clean URLs (`/lecture-studio/lectures/:id/review/H1`). Vite builds
with an absolute base of `/lecture-studio/` (`VITE_BASE_PATH`), and React Router uses the same basename. GitHub Pages
has no server-side rewrites, so `404.html` is a copy of `index.html`: a refresh or a direct link to any screen loads
the app, which then renders the screen from the URL. Such first loads return HTTP 404 status with the full app.
Browsers are unaffected, but link-preview bots may show a 404. Local development is unchanged (base `/`).

**Data on the hosted site** stays in each visitor's browser (`localStorage`). Nothing is sent anywhere, and every
visitor gets their own synthetic demo.

### Making changes

1. `git switch -c feat/<change>` from `main`, then develop with `pnpm dev`.
2. Before pushing: `pnpm test && pnpm test:e2e && pnpm build:pages`.
3. Push the branch (CI verifies it), open a pull request, and merge into `main` when green.
4. The merge deploys automatically. Watch it in the repository's **Actions** tab.

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
