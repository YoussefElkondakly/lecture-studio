// Workflow vocabulary — mirrors prd.json `workflow` and the baseline docs/APPROVAL_GATES.md.

export const SCHEMA_VERSION = 1
export const STORAGE_KEY = 'lecture-studio:demo-state'

/** Ordered production line. Machine stages produce artifacts; gates are human decisions. */
export const STATIONS = [
  { id: 'A', kind: 'machine', name: 'Lecture content', long: 'Generate lecture content and paired PDF', provider: 'google', task: 'content' },
  { id: 'H1', kind: 'gate', name: 'Medical content', long: 'Medical content review' },
  { id: 'H2', kind: 'gate', name: 'Claude Skills', long: 'Confirm Claude Skills' },
  { id: 'B', kind: 'machine', name: 'Storyboard', long: 'Generate storyboard and draft frames', provider: 'anthropic', task: 'creative' },
  { id: 'H3', kind: 'gate', name: 'Storyboard', long: 'Storyboard and draft visuals review' },
  { id: 'B2', kind: 'machine', name: 'Silent visuals', long: 'Produce final silent visuals', provider: 'anthropic', task: 'creative' },
  { id: 'C', kind: 'machine', name: 'Narration scripts', long: 'Generate narration transcripts', provider: 'anthropic', task: 'creative' },
  { id: 'H4', kind: 'gate', name: 'Transcripts', long: 'Narration transcript review' },
  { id: 'D', kind: 'machine', name: 'Voices', long: 'Generate narration voices', provider: 'google', task: 'tts' },
  { id: 'H5', kind: 'gate', name: 'Audio', long: 'Generated audio review' },
  { id: 'E', kind: 'machine', name: 'Final render', long: 'Render final video', provider: 'local', task: 'render' },
  { id: 'H6', kind: 'gate', name: 'Final video', long: 'Final video review' },
]

export const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s]))
export const GATES = STATIONS.filter((s) => s.kind === 'gate').map((s) => s.id)
export const MACHINE_STAGES = STATIONS.filter((s) => s.kind === 'machine').map((s) => s.id)

/** Stages a prompt category may be mapped to (never extended by category CRUD). */
export const PROMPT_STAGES = [
  { id: 'A', label: 'Lecture content (A)' },
  { id: 'B', label: 'Storyboard (B)' },
  { id: 'B2', label: 'Visual production (B2)' },
  { id: 'C', label: 'Narration transcripts (C)' },
  { id: 'D', label: 'Voice generation (D)' },
]
export const PROMPT_STAGE_IDS = PROMPT_STAGES.map((s) => s.id)

export const STATUS = {
  DRAFT: 'DRAFT',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  BLOCKED: 'BLOCKED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
}

/** Display grouping used by badges and filters (PRD status_tokens). */
export const STATUS_META = {
  DRAFT: { label: 'Draft', tone: 'draft' },
  QUEUED: { label: 'Queued', tone: 'processing' },
  PROCESSING: { label: 'Processing', tone: 'processing' },
  REVISION_REQUESTED: { label: 'Revising', tone: 'processing' },
  NEEDS_REVIEW: { label: 'Needs review', tone: 'review' },
  BLOCKED: { label: 'Action needed', tone: 'blocked' },
  COMPLETED: { label: 'Completed', tone: 'completed' },
  ARCHIVED: { label: 'Archived', tone: 'draft' },
}

export const H6_ROUTES = [
  { id: 'RENDER_ONLY', label: 'Render only', target: 'E', help: 'Re-render with changed render settings. Everything else stays approved.' },
  { id: 'VISUALS', label: 'Visuals', target: 'B2', help: 'Regenerate the silent visuals. Transcript and audio approvals stay.' },
  { id: 'AUDIO', label: 'Audio', target: 'D', help: 'Regenerate the listed voice chunks only, then re-review audio.', needsIds: true },
  { id: 'TRANSCRIPT', label: 'Transcript', target: 'C', help: 'Revise the listed transcript chunks, then their voices.', needsIds: true },
  { id: 'CONTENT', label: 'Medical content', target: 'A', help: 'Change the canonical lecture content. Every gate must be approved again.' },
]

export const AUDIENCES = ['Doctors', 'Parents']
export const LANGUAGES = ['English', 'Egyptian Arabic']
export const PDF_STYLES = ['USMLE', 'Parent Education', 'Other']
export const SPEAKER_MODES = [
  { id: 'ONE', label: 'One speaker', speakers: ['Narrator'] },
  { id: 'TWO', label: 'Two speakers', speakers: ['Lecturer', 'Resident'] },
  { id: 'MULTI', label: 'Three or more', speakers: ['Lecturer', 'Resident', 'Nurse educator'] },
]
export const TIMING_POLICIES = [
  { id: 'ASK', label: 'Ask me at audio review', help: 'Chunks measured outside 60–90 s need your explicit acknowledgment at H5.' },
  { id: 'FINAL_SHORT', label: 'Allow a short final chunk', help: 'The last chunk may be shorter than 60 s as a declared exception.' },
]

export const FAILURE_CODES = {
  QUOTA: { label: 'Provider quota exceeded (429)', fix: 'Wait for the provider quota to reset, then retry. Finished work is kept.' },
  BUDGET: { label: 'Monthly budget limit reached', fix: 'Raise the demo budget limit or switch enforcement to warn-only in Settings, then retry.' },
  CREDENTIAL: { label: 'Provider credential invalid', fix: 'Reconnect the demo account in Settings › Providers, then retry.' },
  MODEL: { label: 'Selected model unavailable', fix: 'Choose another model for this task in Settings › Providers, then retry.' },
  TIMEOUT: { label: 'Provider timed out', fix: 'Retry. If it keeps happening, check the provider status later.' },
  OFFLINE: { label: 'Network offline', fix: 'Reconnect to the internet, then retry. Nothing was lost.' },
}

/** Mock USD costs per job — clearly labelled as illustrative estimates in the UI. */
export const MOCK_COST = { A: 0.06, PDF: 0, B: 0.14, B2: 0.22, C: 0.08, D: 0.03, E: 0 }

export const SPEEDS = {
  fast: { label: 'Fast demo', help: 'Each simulated job takes a few seconds.', min: 3000, max: 7000 },
  relaxed: { label: 'Relaxed', help: 'Jobs take 20–60 seconds, closer to a real wait.', min: 20000, max: 60000 },
  manual: { label: 'Manual', help: 'Jobs wait until you press “Finish running jobs”. Used by automated tests.', min: Infinity, max: Infinity },
}

export const CHUNK_MIN_S = 60
export const CHUNK_MAX_S = 90
