# Verification report

Date: 2026-11-27 · Branch `feat/interactive-prototype` · Chromium (Playwright 1.65) on macOS.

## Results

| Check | Command | Result |
|---|---|---|
| Unit tests (workflow engine) | `pnpm test` | **22 / 22 pass** |
| Browser tests | `pnpm test:e2e` | **29 / 29 pass** (about 2 min) |
| Production build | `pnpm build` | Pass. Main chunk 601 kB (192 kB gzip); routes are lazy-loaded |
| Production preview smoke test | `pnpm preview` + 5 deep links | No console errors, no horizontal overflow |
| Screenshots | `pnpm screenshots` | 87 images in `docs/screenshots/` |

### Unit tests (`src/engine/workflow.test.js`)
Chunk planning (600 s → 7 chunks; 1–30 min always valid; non-partitionable handling) · six gates in order ·
no approval without a human decision · H1 confirmation required · H1 rejection, regeneration and refusal of the
rejected version · direct H1 edit → new revision + PDF re-render + stale refusal · H4 targeted rejection keeps other
chunks · transcript edit keeps H1–H3 · H6 AUDIO route keeps earlier gates and archives the old render ·
RENDER_ONLY needs changed settings · CONTENT route resets every gate · concurrent projects with one blocked ·
job deduplication · notification deduplication and resolution · budget stop + retry without loss ·
reconciliation of jobs finished while the browser was closed · prompt version preservation · categories map only
to existing stages, cannot be destroyed while referenced, reassignment keeps snapshots · web Skills cannot be
verified · seeded demo consistency.

### Browser tests (`e2e/`)

| PRD scenario | Test | Notes |
|---|---|---|
| D01 Quick start | ✅ | Validation errors, prompt default, processing state, toast, H1 deep link; asserts **no request leaves localhost** |
| D02 H1 rejection | ✅ | Feedback ≥ 10 characters; regenerated r3 contains the feedback; approval then opens H2 |
| D03 All six gates | ✅ | H1 → H6 with automatic stages between; 6 approvals in history; paired PDF download |
| D04 Concurrent projects | ✅ | Independent progress; refresh; exactly one job per stage (no duplicates) |
| D05 Prompt versioning | ✅ | Completed lecture keeps v1 (“Library is now v3”); new lecture uses v3 |
| D06 Budget stop + retry | ✅ | Explicit blocked state, retry refused while still over budget, fix in Settings, retry resumes, transcripts untouched |
| D07 Phone review from a notification (390 px) | ✅ | Reject chunk 02 only; no horizontal scroll |
| D08 H6 targeted AUDIO rejection | ✅ | Only chunk 02 regenerated; H1–H4 decisions untouched; 2 renders kept |
| D09 Prompt categories | ✅ | Create + map, use at intake (library-only category not offered), delete blocked, archive with reassignment, snapshot kept |
| D10 Direct correction + stale link | ✅ | r3 created, PDF re-rendered, stale deep link explained, decision bound to r3 |

Quality suite: axe WCAG 2.2 A/AA scan of 16 page states · keyboard skip link, navigation, dialog focus trap and
return · refresh/reopen persistence · H2 NONE and unverified-Skill acknowledgment · a review changed in another tab
is refused · empty workspace + first-run checklist + 404 · no-results search · disconnected provider → blocked →
reconnect → retry · notification read/unread, filters, simulated delivery log · draft resume, start, archive.
Responsive suite: no horizontal overflow on 17 screens at 1440, 1280, 768, 390 and 320 px · prompt CRUD · Skills
import/verify · H3 storyboard edit · H4 transcript edit · phone menu and sticky decision bar.

## Deployment verification (GitHub Pages)

Live site: https://youssefelkondakly.github.io/lecture-studio/ · Repository: https://github.com/YoussefElkondakly/lecture-studio

| Check | Result |
|---|---|
| CI on `main` (install → 22 unit → 29 browser → Pages build → 6 emulator tests → deploy) | Passed on every run |
| Live-site Playwright suite (`PAGES_URL=… pnpm test:pages`), from a Mac and in CI (`live-check`) | **6 / 6 pass** |
| Every navigation destination, direct deep links, refresh of nested routes, unknown route → in-app 404 page | Pass |
| Start lecture → simulated processing → notification deep link → approve (H1 → H2) and reject (H1) | Pass |
| Pending reviews, prompt categories (create + map), Skills verify, notifications delivery log, settings | Pass |
| Downloads: Markdown and in-browser PDF (`%PDF-` header verified); sample video plays (metadata loaded) | Pass |
| Persistence: a decision survives reload | Pass |
| Fonts (Source Sans 3, Source Serif 4) loaded; favicon, audio, video, captions and poster return 200 | Pass |
| No request leaves `youssefelkondakly.github.io`, so the site does not depend on localhost or the developer's Mac | Pass |
| No horizontal overflow and no console errors on 11 screens at 1440, 1280, 768, 390 and 320 px (55 checks) | Pass |
| Screenshots of the hosted application | `docs/screenshots/live/` |

Expected and harmless: a direct first load of a nested URL returns HTTP 404 status (GitHub Pages serving `404.html`)
with the full app, and the browser logs that status once. Every in-app navigation and refresh then works normally.

## Accessibility findings

Target: WCAG 2.2 AA. **This is not a compliance claim.** Automated checks plus manual review only; no assistive-technology user testing yet.

**Automated:** axe-core reports **0 violations** (tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa) on Home, My lectures,
Start new lecture, Pending reviews, Master prompts, prompt detail, Claude Skills, Notifications, Settings,
Budget, H1 (Arabic RTL), H4, H5, lecture detail, deliverables and approval history.

**Independent audit** (Vercel Web Interface Guidelines + WCAG 2.2, run by a separate reviewer) produced 20 findings.
Fixed:
- Focus indicator was a faint ring (about 1.8:1) because `outline-none` overrode the global outline. Now a transparent outline (visible in forced-colors mode) plus a solid teal ring.
- Visible labels “Needs changes” and “Regenerate” were not part of their accessible names (2.5.3) — fixed.
- Every Alert had `role="alert"` (noisy) — now only action errors announce.
- Sticky header and phone bar could hide focused controls (2.4.11) — `scroll-padding` added.
- Unsaved feedback and edits could be lost silently — drafts kept, discard confirmations, `beforeunload` guard.
- Navigation implemented as buttons (notification items, section navs) — now links with working Back.
- Category deletion had no confirmation — added.
- Markdown headings were mis-levelled and unstyled — fixed.
- Captions `<track>` without a file — real WebVTT captions added for the sample video.
- Error messages for failed edits only in a toast — now inline.
- RTL list bullets clipped, “(changed)” marker below the 13 px floor, jargon (“Fingerprint”, route enum codes) — fixed.

**Remaining / not verified:**
- Screen-reader walkthroughs (VoiceOver, NVDA) not performed.
- 200 % zoom checked indirectly via the 320 px reflow tests (equivalent CSS width), not with browser zoom.
- Gate pips (compact list indicator) expose details via `title` and an aggregate label, not as a focusable list.
- Some secondary actions are 36 px high (WCAG 2.2 minimum is 24 px; the PRD prefers 44 px).
- In-app route changes do not yet ask before discarding an open editor (the tab-close guard and Cancel confirmation do).
- Settings sections remount on switch, so unsaved edits in a section are dropped (no autosave).

## Known limitations (prototype scope)

- All AI generation, provider connections, model lists, costs, budget, Skill import/verification and notification
  delivery are **simulated**. No network request leaves the browser (asserted in D01).
- Jobs only progress while a tab is open. Finished work is reconciled on reopening; V1 needs a server.
- No authentication. Decisions record the single doctor persona.
- The paired PDF download is generated for English text only; Arabic needs an embedded font (on-screen preview works).
- Audio and video are short labelled sample clips; measured durations and the render report are simulated.
- Draft frames are drawn from storyboard text, not generated images.
- Lecture content is synthetic with placeholder values; it has not been medically reviewed and is not medical guidance.
- State is per browser (localStorage). Two tabs sync; two browsers do not.
- The main JS chunk is about 600 kB (Base UI + React + fonts CSS), which is acceptable for a local prototype.
