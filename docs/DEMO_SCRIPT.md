# Demonstration journey for Dr. Ashraf (about 15 minutes)

Before the session: **Settings → Demo controls → Reset demo data**, and keep job speed on *Fast demo*.
Use a laptop browser at full width. Say up front: “Everything here is simulated — no AI is called and nothing is sent.”

## 1. Start the day (2 min) — Home
- The greeting summarises what needs him: 3 reviews waiting, 1 lecture processing, 1 needing attention.
- Point out that **Waiting for your review** is oldest first, and each row opens the exact version to review.
- About 30 seconds after loading, the *Iron-deficiency anaemia* lecture finishes its automatic steps and a
  **“H4 · Transcripts ready for review”** pop-up appears: this is the immediate notification.

## 2. Start a lecture and leave (2 min) — Start new lecture
- Lecture name, a demo source (e.g. *oral-rehydration-clinic-notes.txt*), and the content prompt (already defaulted).
- Show the preferences summary, then **Change preferences** (audience, Egyptian Arabic, PDF style, duration → chunk plan).
- **Start now** opens the lecture: “You can leave — you'll be notified when H1 is ready.” Click **Back to Home**.

## 3. Review medical content in Egyptian Arabic (3 min) — H1
- Open *Neonatal jaundice* (H1). Original source on the left, draft on the right (right-to-left).
- Revision r2 is an AI revision after an earlier rejection. Changed lines are highlighted.
- Switch to **Paired PDF**: the same revision, rendered from the same text.
- **Edit text** → add one sentence → **Save new revision**. The PDF re-renders and the review comes back as r3.
- Tick the confirmation → **Approve and continue**. H2 opens straight away (it's also a human step).

## 4. Confirm Skills and prompts (1 min) — H2
- Verified vs unverified vs web-only Skills, and **NONE** as a valid answer. Prompts for the next stages are pre-filled.
- Approve: the storyboard job starts by itself.

## 5. Targeted correction (3 min) — H4 and H5
- *Asthma action plans* (H4): read a chunk, use **Jump to**, tick **Needs changes** on chunk 02 →
  **Request changes** with a reason. Only chunk 02 is rewritten; the others stay untouched.
- *Growth charts* (H5): play a voice clip (sample audio). Chunk 03 measures 91 s, so approval needs an explicit
  timing acknowledgment, or regenerate just that chunk.

## 6. Something goes wrong (2 min) — Action needed
- *What to expect at a vaccination visit* is paused: provider quota exceeded (429). Finished work is kept,
  and nothing switches to another provider. Click **Retry D**.
- Optional: **Settings → Budget & usage**. Lower the limit to $1 and approve something → explicit budget stop.

## 7. Final video and deliverables (2 min) — H6 and Completed
- *Bronchiolitis* → **Deliverables**: sample video, downloads (Markdown, PDF generated from the approved text,
  storyboard, transcripts, manifest), approval history with fingerprints and prompt versions.
- If time allows, take *Growth charts* through H5 → H6 and open **Request changes → Audio → chunk 02** to show
  correction routes.

## 8. Questions for him
Use [DESIGN_REVIEW.md](DESIGN_REVIEW.md). Note his answers as *doctor-validated* separately from the developer's choices.

### Recovery tips during the demo
- Something processing too long → open the lecture → **Finish running jobs now (demo)**.
- Lost the thread → **Settings → Demo controls → Reset demo data**.
