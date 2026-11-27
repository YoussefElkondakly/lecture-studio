# Backlog — prioritized improvements and ideas

Not in scope for this prototype unless noted. Priorities: **P1** next prototype iteration · **P2** before V1 ·
**P3** later or idea.

## Prototype iteration 2 (after the design review)

| P | Item | Why |
|---|---|---|
| P1 | Apply Dr. Ashraf's answers from `DESIGN_REVIEW.md` (density, typography, H1 layout, defaults) | Validate before V1 |
| P1 | Word-level diff between revisions (currently line-level highlighting) | Faster re-review of small AI revisions |
| P1 | “Resume where I left off” card on Home (last opened review and scroll position) | Clinic interruptions |
| P1 | Per-chunk transcript comments at H4 (instead of one note for all selected chunks) | More precise revision requests |
| P1 | Reuse audio when a regenerated transcript is byte-identical (baseline rule, see DECISIONS C6) | Lower cost |
| P2 | Arabic PDF export with an embedded Arabic font and shaping | Downloadable paired PDF for Egyptian Arabic |
| P2 | Lecture presets (prompt set + preferences) as an alternative to per-stage defaults | Open question Q15 |
| P2 | Quiet hours and reminder rules for notifications | Open question Q08 |
| P2 | Saved views and filters on My lectures | Many concurrent lectures |
| P2 | Bulk-approve is **deliberately not offered** (every gate is a separate decision) — revisit only if requested | Safety |

## Functional V1 (requires an explicit go-ahead)

| P | Item |
|---|---|
| P1 | Backend with durable job queue, idempotent retries and server-side scheduling (jobs run while the browser is closed) |
| P1 | Authentication; decisions bound to the authenticated doctor (baseline `DOCTOR_EMAILS` rule) |
| P1 | Official Google Gemini (text + TTS) and Anthropic APIs behind provider adapters; capability and model discovery |
| P1 | Server-side secret storage; administrator-only provider settings |
| P1 | Real usage ledger and budget enforcement with provider price provenance |
| P1 | Private artifact storage with real SHA-256 fingerprints; reuse the Python helper's validation and FFmpeg rendering |
| P2 | Claude Skills import/verification through the API with versioning |
| P2 | Email and Web Push delivery with delivery status |
| P3 | Optional local automation path if API costs exceed the budget |

## Ideas (unprioritised)

- Keyboard shortcuts in reviews (A = approve after confirmation, R = request changes, J/K = next/previous chunk).
- Audio waveform with the measured-duration marker.
- “Explain this change” summary generated for each AI revision.
- Printable review checklist per gate.
- Arabic interface localisation (UI is English-only by decision).
