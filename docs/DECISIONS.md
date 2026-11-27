# Decisions, assumptions and baseline conflicts

Status legend: **Developer** = chosen by the developer in the PRD · **Prototype** = provisional choice made while
building, reversible, to validate with Dr. Ashraf · **Baseline** = preserved from the existing n8n workflow.

## 1. Sources consulted

- `prd.json` v0.2.0 and `LECTURE_STUDIO_PROTOTYPE_MASTER_PROMPT.md` (requirements contract).
- Parent repository, read-only: `diagrams/lecture_to_video_v4.mmd`, `docs/APPROVAL_GATES.md`,
  `docs/DOCTOR_GUIDE.md`, `templates/01–06`, `templates/lecture_master_template.md`,
  `helper/app/state.py` (stage derivation, `record_decision`) and `helper/app/chunks.py` (60–90 s rules).
  Nothing in the parent repository was modified and nothing is imported from it at runtime.

## 2. How baseline rules were preserved

| Baseline rule (APPROVAL_GATES.md / state.py) | Prototype implementation |
|---|---|
| Stage is recomputed from files, SHA-256 fingerprints and the approval log | `computeProgress()` derives the stage from artifacts and approvals every time. Fingerprints are an FNV-1a stand-in for SHA-256. |
| An approval is valid only while its fingerprint matches | `approvals[gate].fp === gateFingerprint(project, gate)`. Invalidation falls out of how fingerprints are composed (content → H1–H6; storyboard → H3, H4; transcript chunk → H4, its voice, H5, H6; voice → H5, H6; render settings → H6). |
| Decisions only while the project is at that gate and files are unchanged since the page opened | `decide()` refuses `STALE_STAGE` and `STALE_VERSION`. The review page keeps the version it opened and warns when it changes underneath. |
| A rejected identical artifact can never pass | Rejected fingerprints/artifact IDs are stored in `rejectedKeys`; approval of them is refused. |
| H1 needs a confirmation tick; H5 needs explicit acceptance of out-of-range chunks; H6 needs “I watched the complete video” | Same, as checkboxes next to the Approve button. |
| H4 rejection lists chunk IDs or ALL; H5 lists specific audio IDs, never ALL | Same; validated in the engine. |
| H6 routes RENDER_ONLY / VISUALS / AUDIO+IDs / TRANSCRIPT+IDs / CONTENT; identical re-render rejected | Same; RENDER_ONLY requires a changed gap or fade setting. |
| 60–90 s chunks, 600 s → 7–10 chunks, contiguous IDs | `chunks.js` is a port of `helper/app/chunks.py` (7 × 85–86 s for 10 min). |
| Automated tools never approve | Only the review UI calls `decide()`. Seeded history is labelled “seeded demo history”. |
| STOP on 429, BLOCK on 402/403/404, no silent fallback | Explicit *Action needed* state with the error, the fix and Retry. No other provider or model is tried. |

## 3. Conflicts between the baseline and the new PRD, and how they were resolved

| # | Baseline | New PRD direction | Resolution |
|---|---|---|---|
| C1 | Mode A: the doctor copies prompts into Gemini, Claude and AI Studio and uploads files back | “Human-in-the-loop, not human-in-the-middle”; zero manual transfers | All transfers are automatic simulated jobs. No copy/paste or upload steps exist in the prototype. |
| C2 | H2: the doctor types the Skill names Claude Web shows | Skills library with verification states; explicit selection or NONE | H2 selects from the Skills library. Unverified/web-only Skills need an explicit acknowledgment; NONE is always valid. |
| C3 | Free tier, zero spend | API-first V1 with a USD 10–20/month target | Mock budget ($20 adjustable example), warning threshold, stop/warn enforcement, explicit budget-stop state. |
| C4 | H1 approval restricted to logged-in `DOCTOR_EMAILS` | Single doctor; authentication out of scope | One persona; decisions record “Dr. Ashraf Elbasel”. V1 must bind decisions to an authenticated reviewer. |
| C5 | A PDF-only change resets only H1 | “Never edit the PDF independently as canonical text” | The PDF cannot be edited; it is always re-rendered from the canonical text, so the PDF-only case never occurs. |
| C6 | After a content change, audio stays valid if its transcript text is unchanged | Same rule | Simplified: a content change regenerates all transcripts (new versions), so audio is regenerated too. Approvals reset exactly as in the baseline. **Backlog:** reuse audio when regenerated text is byte-identical. |
| C7 | A draft-frames-only change resets H3 only | Not addressed | Draft frames are derived from storyboard text in the prototype, so frames change only with the storyboard (H3 + H4 reset). |
| C8 | Timing policy STOP / ADJUST / FINAL_SHORT for non-partitionable durations | Preserve timing exception choices | Durations are whole minutes and always partitionable, so the intake offers *Ask me at audio review* or *Allow a short final chunk*. The planner keeps the ADJUST logic for other inputs. |

## 4. Independent design decisions (Prototype — reversible)

1. **Visual identity.** PRD Theme A tokens used verbatim. The memorable element is the *production line*:
   12 stations where the six human gates are bold markers and machine steps are quiet nodes, so
   “human in the loop” is visible at a glance. No gradients, no decorative charts.
2. **Typography.** Source Serif 4 for page titles and the documents under review (manuscript feel), Source Sans 3
   for the interface, 17 px body, and Noto Naskh Arabic for RTL content. All fonts are bundled so the demo works offline.
3. **Contrast adjustments.** Form-control borders use `#7C8EA3` (3.36:1) because PRD `#D8E1EA` is 1.32:1
   (it remains the divider colour). Teal text on a teal tint uses `#066B63`.
4. **Native `<select>` for form dropdowns** (styled), for dependable keyboard, screen-reader and phone behaviour.
   shadcn/Base UI is used for dialogs, sheets, tabs, menus, checkboxes, switches, popovers and tooltips.
5. **Navigation buttons are real links** (`ButtonLink`), not `role="button"` anchors.
6. **Gate confirmations sit next to Approve** in a sticky decision panel (phone: inline panel plus a sticky bar).
   An Approve button that can't be used yet stays focusable and explains why.
7. **After an approval**: if the next step is a human gate (H1 → H2), it opens directly; otherwise the next job starts
   and the doctor returns to the review inbox (or Home when nothing else waits).
8. **H1 layout.** Source and draft side by side by default only from 1600 px. At 1280–1440 px the draft gets full width, and “Show source” opens it beside the draft (from 1400 px) or above it.
   Canonical text and paired PDF are two views of the same revision. Changed lines are highlighted and marked “(changed)”.
9. **Prompt selection policy** (open question Q15): saved per-stage defaults pre-fill everything. The doctor
   may override at intake (A), H2 (B and B2), H3 (C) and H4 (D). The chosen version is snapshotted.
10. **Prompt versioning.** Changing title, category or text creates a new immutable version. Description/tags are
    metadata. Used prompts cannot be deleted (archive instead); unused ones can, with confirmation.
11. **Category archive** offers an optional reassignment of active prompts. Historical snapshots keep the old name.
12. **Notifications.** One review-ready event per project/gate/version, plus *issue* and *completed* events.
    In-app toast plus email/push logged as “Simulated — not sent”. Superseded review events resolve automatically.
13. **Status vocabulary.** Needs review / Processing / Revising / Action needed / Completed / Draft / Archived, always
    icon + text. No percentages; the demo timer is labelled as such.
14. **Default job speed “Fast demo”** so a live demo shows lectures moving. Tests use *Manual*.
15. **Synthetic content** is clearly labelled, uses placeholder values (“Value A — verify”) and avoids clinical claims.
16. **Git.** Work is on `feat/interactive-prototype`. Phases 0–3 were built together because the shell, engine
    and screens are interdependent, and were committed as one verified commit. Later phases are separate commits.
17. **No AI co-author trailers** in commits, per the user's explicit instruction.

## 5. Skills used

| Skill | Status | How it was used |
|---|---|---|
| `frontend-design` | Installed (`.claude/skills`) | Design plan, the single bold element, avoiding templated defaults, copy guidance |
| `ui-ux-pro-max` | Installed | Ran its design-system generator. Adopted flat style, 150–200 ms transitions and a 44 px target guideline. Rejected its orange CTA and teal borders because they conflict with the PRD palette. |
| `shadcn` | Installed (`.agents/skills`) | Base UI components with `tsx: false`, semantic tokens, composition rules |
| `web-design-guidelines` | **Not installed** | Substitute: an independent audit against the published Vercel Web Interface Guidelines and WCAG 2.2, plus axe-core |
| `webapp-testing` | **Not installed** (`.claude/skills/webapp-testing` is empty) | Substitute: `@playwright/test` and `@axe-core/playwright` directly (the same tooling the skill wraps) |

## 6. Publication (public repository and GitHub Pages)

1. **Pre-publication history cleanup.** A security scan of the full Git history found no credentials, keys or
   medical records. It did find content that should not be public, all in the initial commit, which predates the
   prototype work:
   - the doctor's age in `prd.json`,
   - a company project name in the build brief,
   - local agent tooling (`.claude/`, `.agents/`, `skills-lock.json`, including third-party skill bundles).

   Because nothing had been pushed yet, the local history was rewritten with `git filter-repo`. It removed those
   paths from every commit and redacted the two phrases. Commit messages, authors and dates are unchanged, and the
   original history is kept on local, never-pushed `backup/pre-publication-*` branches. The agent files remain on
   disk and are now in `.gitignore`.
2. **Routing.** Clean URLs with an absolute Vite base (`/lecture-studio/`) and a matching React Router basename.
   `404.html` (a copy of `index.html`) is the deep-link fallback. HashRouter was rejected because it changes every
   URL and deep link. The redirect-script technique was rejected as unnecessary complexity.
3. **Deployment mechanism.** The official GitHub Pages Actions flow (`upload-pages-artifact` + `deploy-pages`), with
   the Pages site created once via the API as `build_type: workflow`. The reference project pushed to a `gh-pages`
   branch because `GITHUB_TOKEN` cannot *create* a Pages site. Creating it once with the owner's credentials removes
   that limitation, so no build branch is needed.
4. **Demonstration notice.** Every page shows that this is a demonstration prototype, that AI processing is
   simulated, and that real medical records, patient information or API credentials must not be entered.
5. **Commit identity.** Commits keep the author identity already used in the owner's other public repositories.
