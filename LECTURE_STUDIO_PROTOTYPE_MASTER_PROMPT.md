# Lecture Studio — Interactive Prototype Master Prompt

## Mission

Act as a senior product designer, UX researcher, React frontend architect and QA engineer. Build a polished, fully interactive, laptop-first browser prototype of Lecture Studio in this new independent repository. The prototype is the first product-discovery deliverable: Dr. Ashraf Elbasel will use it, give feedback, and we will refine requirements before building the real backend. Do not just produce a plan, static mockup, Figma design, or screenshots. Deliver a runnable application.

Read `prd.json` (v0.2.0) in full before writing code. It is the requirements contract. The older project at https://github.com/YoussefElkondakly/ashraf-elbasel-n8n, branch `feat/finalize-for-remote`, supplies the workflow baseline through `diagrams/lecture_to_video_v4.mmd` and `docs/APPROVAL_GATES.md`. Consult those read-only if accessible. The new PRD supersedes the old manual handoff, zero-spend and n8n implementation assumptions for the target experience. Keep six gates and their existing rejection/invalidation semantics. Do not change the old repository or copy company code into this personal project. If a source is unavailable, rely on the explicit PRD and record the limitation.

## 1. Fixed product and design decisions

- One primary user: Dr. Ashraf, an experienced, technology-positive medical professor. Respect his competence; design for interruptions, readability and efficient professional decisions, not age stereotypes.
- Business goal: human-in-the-loop, not human-in-the-middle. AI-to-AI transfers, job execution and resumption are automatic in the target product. Human review remains mandatory. Multiple lectures can progress independently while the doctor is at his clinic.
- Home layout: review-first productivity dashboard with clear labeled sidebar, prominent Start new lecture action, pending reviews, active lectures, and meaningful counts derived from shared state.
- Palette: clinical navy/teal, light-first. Use the exact baseline tokens from PRD: background #F5F7FA, surface #FFFFFF, text #142B45, primary #153C63, accent #087F76, muted #52647A, border #D8E1EA. Adjust only for tested contrast/accessibility and document any adjustment.
- Laptop is the primary target (1280x800 and 1440x900). Mobile is a secondary, responsive review experience; do not design a mobile-only interface.
- English interface, correct isolated RTL for Egyptian Arabic lecture content. No dark mode in this milestone.
- Direct edit where appropriate plus request AI regeneration; no in-place mutation of approved artifacts.
- Immediate notification event for each new pending approval; in-app plus simulated email and push channels. No real delivery.
- Master prompt categories are required; exact selection policy is unresolved. Use stage defaults with optional override as a reversible prototype choice, and expose explicit category-filtered selection at relevant gates. Do not add mandatory clerical checkpoints.
- Functional V1 will use official Google and Anthropic APIs first, with a $10–20/month target; the actual hard cap and model costs remain open. Local automation can be explored later if costs justify it. No real keys or API requests in this prototype.

## 2. Use skills deliberately

Inspect available project/global skills and read relevant SKILL.md files before using them. Prioritize Anthropic `frontend-design` and `webapp-testing`, and the official `shadcn` skill. If available, use a general design-review or accessibility skill; otherwise implement the checks yourself. Do not block on unavailable optional skills or install arbitrary skills without reviewing source, permissions and license. Use Playwright and @axe-core/playwright as test tooling, and Vitest for the simulation engine. A prior prototype's reusable methodology is browser smoke tests, interaction regression, visual regression and screenshots, not company UI assets or proprietary code. Local agent config folders may differ; inspect only if authorized and never copy company-specific material or change global agent settings.

Design is a deliverable, not a side effect of generating React components. Before building every screen, define the visual hierarchy, typography, layout rhythm, interaction patterns and states. Use real rendered browser screenshots to review the work. Avoid generic AI dashboard aesthetics, excessive rounded cards, giant hero sections, excessive empty space, gradients, glassmorphism, decorative graphs and gratuitous animations. Use icons consistently with text labels for important actions. Keep design tokens centralized. Prefer a restrained, premium workspace with strong readable typography, clear primary actions and accessible forms. Target WCAG 2.2 AA; test focus, keyboard navigation, contrast, 200% zoom, reduced motion and responsive reflow. Do not claim compliance from axe alone.

## 3. Technical contract

- React + Vite, JavaScript and JSX (not TypeScript), semantic HTML, CSS variables, selective shadcn/ui components and Lucide icons. If shadcn is configured, use `tsx: false`. Use React Router or an equivalent small routing mechanism. Choose a simple consistent styling approach (Tailwind or CSS) rather than mixing multiple libraries.
- Keep application at repository root with `src/`, clear page/component boundaries, mock service adapter, fixtures, tests and documented routes. Avoid needless architectural abstractions. Separate the deterministic workflow engine from React components so the frontend can later use a real API.
- Use versioned localStorage or IndexedDB for synthetic demo state only; no real patient information, private prompts, API keys or passwords. Persist job dueAt, versions, decisions and notification deduplication state; reconcile elapsed demo jobs when the browser reopens. Browser-only simulation does not actually run while closed: explain this accurately in demo documentation. No server, Docker, n8n, backend migration, paid services, external AI request, genuine notification permission or cloud deployment.
- Create bundled synthetic PDF, text, storyboard, image, audio and video samples where feasible. Use fictional non-clinical or clearly synthetic training content; no real medical claims or identifiable patients. Real preview/download controls must use real demo files or clearly say a fixture is unavailable. No fake model progress percentages; show stage, queue state and optional labeled simulated progress. Use a discreet persistent Demo/Prototype indicator.

## 4. Build the complete user journey

Use all eleven PRD screens. Each important navigation item, filter, dialog, form, preview, CRUD action and approval must behave meaningfully with demo data; do not add dead buttons.

**Home and lectures:** Welcome Dr. Ashraf. Prioritize needs-review, processing, completed and action-needed metrics and list pending reviews above active projects. Clicking a metric filters the relevant list. Provide search, status filter, meaningful sort, empty state and lecture detail timeline with history and next action. Create a lecture from three primary fields: title, source and content-category prompt. Show existing preference defaults (audience Doctors/Parents, English/Egyptian Arabic, PDF style, duration, ONE/TWO/MULTI speakers, voice direction), allow overrides and validate missing values. Start now enqueues the first simulated job and returns a usable dashboard. No unnecessary repeated configuration.

**Master prompts and categories:** Create, edit, duplicate, preview, archive and restore prompts. Required fields: title, category and body. Optional description/tags. Category management includes create, rename, archive/restore, stage mapping and safe reassignment. Seed content (A), storyboard (B), visual production (B2), narration (C) and voice generation (D), plus allow custom categories; unmapped categories are library-only. Never add new workflow stages from category CRUD. Filter pickers by compatible stage. Preserve immutable prompt versions and category snapshots for projects/jobs. Reject hard deletion of referenced records. Previous projects remain reproducible after library edits. Seed fictional prompts, not alleged real doctor prompts.

**Claude Skills and settings:** Separate Skills from master prompts. Show title, origin, API ID/version if simulated, verification state, edit/reference/mock import/archive and explicit NONE. A Claude Web Skill name is not proof of an API-ready skill. H2 explicitly confirms the chosen skill(s) or NONE. Settings include fake Google and Anthropic connection cards, independent model choices for content/creative/TTS, defaults, notification toggles and clearly mock usage/budget. Use a demo connect action and masked fake key; never request real keys. Demonstrate error and budget-stop states, no silent paid fallback. $20 monthly demo limit is an adjustable example, not an approved production cap.

**Workflow and reviews:** A Gemini draft + paired PDF -> H1 medical content -> H2 Skills confirmation -> B storyboard/draft frames -> H3 -> B2 final silent visuals -> C narration transcripts -> H4 -> D TTS -> H5 -> E final render -> H6 -> Completed. Preserve all six gates. H1 confirms the exact reviewed version and medical review. H2 allows skill/prompt changes before approval. H3 supports storyboard/scene notes editing. H4 supports targeted transcript editing or regeneration. H5 allows targeted audio regeneration, measured-duration acknowledgment when outside 60–90s. H6 requires full-video review confirmation and targeted correction routes RENDER_ONLY, VISUALS, AUDIO, TRANSCRIPT, CONTENT. Direct edits create new revisions and invalidate the appropriate approvals. H1 text changes regenerate paired PDF; do not edit canonical content via an independent PDF. Reject requires meaningful feedback; retain history and unrelated artifacts. Prevent stale/duplicate approval. Preserve 60–90s chunk plan, declared exceptions and ONE/TWO/MULTI speaker semantics (10 minutes needs 7–10 chunks). No approval by a mock AI. After each genuine simulated human approval automatically queue the next machine stage, or surface H2 if it is the next decision. Do not ask user to manually transfer content or paste prompts between services.

**Notifications and delivery:** Show immediate notification for each unique review-ready project/gate/artifact version, header unread count, review inbox, deep links and mark read/resolved. Simulate email and push dispatch without any network call. A stale deep link goes to the current review, never silently approves a stale artifact. Completed lecture has playable/previewable synthetic assets or transparent unavailable states, downloads and audit/version history. Show blocked states and safe retry. Independent projects must keep progressing even when one waits for review or is blocked.

## 5. Phased execution and Git

Inspect git status and files first. Work only in this new repository. Use `feat/interactive-prototype` if a base branch exists; if the repository is empty, initialize normally and create a suitable local feature branch without destructive operations. Preserve existing files/skills. You may stage and commit your own verified work; never push, create a PR, change remotes, rewrite history, add AI/agent co-author trailers, or change legitimate author identity. Never commit secrets, user data, node_modules or generated bulk test outputs. Maintain `docs/PROTOTYPE_PROGRESS.md` with phases, decisions and test evidence.

Execute these phases in order. Run relevant checks and inspect actual browser output before committing each meaningful milestone. Do not wait for approval after each phase unless an essential blocker exists; the design feedback loop follows a usable first pass.

| Phase | Deliverable | Suggested commit |
|---|---|---|
| 0 | Bootstrap app, routes, mock contract, design tokens, baseline test tooling | chore: initialize lecture studio prototype |
| 1 | Dashboard, navigation, lecture list, visual system and responsive shell | feat: build lecture workspace dashboard |
| 2 | Intake, category/prompt library, skills and settings | feat: add lecture setup and reusable prompt library |
| 3 | Deterministic jobs, H1–H6 reviews, direct edits and targeted rejections | feat: simulate lecture production and human approvals |
| 4 | Notification inbox, deliverables, error recovery, persistence and concurrent projects | feat: complete simulated lecture lifecycle |
| 5 | Polish, visual/interaction regression, accessibility checks and stakeholder demo | test: verify prototype journeys and refine usability |

For each phase, report what changed, how to see it, verification and commit hash. If a test fails, correct it; if genuinely blocked, identify the exact gap rather than faking a pass. Keep existing decisions intact and avoid redesigning unrelated pages after every phase.

## 6. QA and visual review requirements

Run unit tests for state transitions, version invalidation, stage mapping, job deduplication and notification deduplication. Run actual Playwright tests for PRD demo scenarios D01–D10: intake, H1 rejection, full six-gate flow, concurrent projects, prompt versioning, mock quota/budget stop and retry, responsive review deep link, H6 targeted rollback, category lifecycle and direct editing. Include refresh/reopen, stale reviews, keyboard navigation, dialogs/focus, no-results, empty, error, and simulated notification channel behavior. Make time deterministic with a test clock or explicit demo advancement, not flaky sleep-based tests. Test production build. Capture rendered screenshots at 1440x900 and 1280x800, 390px and 320px, especially dashboard, intake, prompt categories, H1 split review, H4/H5 and settings. Inspect screenshots for overflow, contrast, hierarchy and consistency; improve issues and rerun. Use visual regression baselines intentionally and document changes. Ensure no unexpected network calls or console errors in demo paths. Provide simple `npm run dev`, `npm run build`, `npm test`, and `npm run test:e2e` instructions (match actual scripts).

## 7. Product discovery loop, not uncontrolled scope expansion

After the first runnable prototype, prepare `docs/DESIGN_REVIEW.md` with actual screenshots and a structured set of decisions for me and Dr. Ashraf. Ask focused questions about:
- sidebar expanded/collapsed, table vs cards, metric hierarchy and preferred density;
- typography size/font and navy/teal balance;
- H1 source/draft split view vs full-width document, sticky decision bar and direct editing UX;
- how prompts are selected: saved per-stage defaults, explicit choice at relevant gates or reusable lecture presets; test category names and mapping;
- default intake settings, Skills selection, notification placement and review deep links;
- status wording, useful metrics, error guidance and how he resumes after clinic interruptions;
- branding/name/logo, actual source types, device/browser and mobile review needs.

Use visual alternatives only where they help a decision, not a new full dashboard for every choice. Record open requirements and decisions with their status; distinguish my choices from doctor-validated feedback. Update PRD and stories after feedback. Do not implement a backend, OAuth, n8n migration, live APIs, native packaging or hosting until we approve the prototype and explicitly open that phase. Keep new ideas in a backlog.

## 8. Definition of done

A runnable frontend with eleven screens, twelve user stories and ten demo scenarios from the updated PRD; coherent design system; category/prompt management; all six human approvals; simulated automated handoffs, concurrent work, persistence, notifications and revisions; tests and screenshot evidence; no real AI cost, secrets or clinical data; local phase commits; explicit limitations and unresolved design questions. Include README with exact launch/test/reset steps and a short doctor walkthrough (upload/start, leave, review, correct, continue, finish). Provide the actual localhost URL, final local commit hashes, test results and screenshot paths. Do not declare actual API automation, production authentication, server-side jobs or medical correctness verified. All are future functional V1 work.

Begin now: inspect repository, read PRD and skills, implement Phase 0 and continue. No additional architecture debate or Figma work is required before making the first usable design.
