// Synthetic demo fixtures. Seeded projects are produced by driving the real engine with
// scripted decisions, so their history, versions and notifications are internally consistent.
import { SCHEMA_VERSION } from './constants.js'
import { DEMO_SOURCES } from './content.js'
import { createPrompt, createCategory, createSkill, mockImportSkill, verifySkill, archiveSkill, editPrompt } from './library.js'
import { computeProgress, createProject, decide, finishRunningJobs, getProject, startDraft } from './workflow.js'
import { clone } from './util.js'

const MIN = 60_000

export function baseState(now, { speed = 'fast' } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { seededAt: now, onboardingDismissed: false, onboardingSteps: {} },
    counters: {},
    profile: {
      displayName: 'Dr. Ashraf Elbasel',
      shortName: 'Dr. Ashraf',
      role: 'doctor',
      locale: 'en',
      defaults: {
        audience: 'Doctors', language: 'English', pdfStyle: 'USMLE', pdfStyleOther: '', durationMin: 10,
        speakerMode: 'ONE', voiceDirection: 'Calm, warm and unhurried — clinic teaching pace.', timingPolicy: 'ASK',
      },
      notificationPrefs: { inApp: true, toast: true, email: true, push: true, reviewReady: true, issues: true, completed: true },
      stageDefaults: { A: null, B: null, B2: null, C: null, D: null },
      defaultSkills: { ids: [], none: false },
    },
    providers: {
      google: {
        provider: 'google', label: 'Google (Gemini)', status: 'connected', maskedIdentifier: 'demo-google-••••-4c1e', credentialRef: 'demo-ref-google',
        lastCheckedAt: now - 3 * 60 * MIN, lastCheckResult: 'Demo account connected. No real credential was requested or stored.',
        models: { content: 'gemini-pro-text', tts: 'gemini-tts-flash' },
        catalog: [
          { id: 'gemini-pro-text', label: 'Gemini Pro — text', tasks: ['content'], cost: 'Unknown (to be priced in V1)' },
          { id: 'gemini-flash-text', label: 'Gemini Flash — text', tasks: ['content'], cost: 'Unknown (to be priced in V1)' },
          { id: 'gemini-experimental', label: 'Gemini Experimental — text', tasks: ['content'], cost: 'Unknown', unavailable: true },
          { id: 'gemini-tts-flash', label: 'Gemini Flash TTS', tasks: ['tts'], cost: 'Unknown (to be priced in V1)' },
          { id: 'gemini-tts-pro', label: 'Gemini Pro TTS', tasks: ['tts'], cost: 'Unknown (to be priced in V1)' },
          { id: 'legacy-tts', label: 'Legacy TTS voice', tasks: ['tts'], cost: 'Unknown', unavailable: true },
        ],
      },
      anthropic: {
        provider: 'anthropic', label: 'Anthropic (Claude)', status: 'connected', maskedIdentifier: 'demo-anthropic-••••-9b07', credentialRef: 'demo-ref-anthropic',
        lastCheckedAt: now - 3 * 60 * MIN, lastCheckResult: 'Demo account connected. No real credential was requested or stored.',
        models: { creative: 'claude-sonnet' },
        catalog: [
          { id: 'claude-opus', label: 'Claude Opus', tasks: ['creative'], cost: 'Unknown (to be priced in V1)' },
          { id: 'claude-sonnet', label: 'Claude Sonnet', tasks: ['creative'], cost: 'Unknown (to be priced in V1)' },
          { id: 'claude-haiku', label: 'Claude Haiku', tasks: ['creative'], cost: 'Unknown (to be priced in V1)' },
          { id: 'claude-retired', label: 'Retired model (demo)', tasks: ['creative'], cost: 'Unknown', unavailable: true },
        ],
      },
    },
    budget: { currency: 'USD', period: 'monthly', limit: 20, warningPct: 80, enforcement: 'stop' },
    demo: { speed, injectFailure: null },
    categories: [],
    prompts: [],
    promptVersions: [],
    skills: [],
    projects: [],
    jobs: [],
    decisions: [],
    notifications: [],
    deliveryLog: [],
    usage: [],
    activity: [],
  }
}

const PROMPTS = [
  {
    key: 'A_doctors', cat: 'A', title: 'Structured lecture extraction — doctors',
    description: 'Fictional example. Full-content extraction with review flags for a clinician audience.', tags: 'USMLE, full content',
    body: `FICTIONAL EXAMPLE PROMPT — not Dr. Ashraf's real prompt.

You are an educational medical-lecture editor. Work only from the attached source and the lecture preferences.
Never invent facts, numbers, studies, quotations, guidelines or references.

1. Create ONE canonical Markdown document (lecture_master.md) containing all educational content — objectives,
   every section, all numbers with units, tables as Markdown tables, and a written description of every figure.
2. Mark anything that needs the doctor's verification under "Medical-review flags".
3. The paired PDF is rendered from this exact Markdown. Do not produce a separate, different PDF text.

Audience: {{AUDIENCE}} · Language: {{LANGUAGE}} · PDF style: {{PDF_STYLE}}`,
    v2: `FICTIONAL EXAMPLE PROMPT — not Dr. Ashraf's real prompt. (v2: adds a source-mapping section.)

You are an educational medical-lecture editor. Work only from the attached source and the lecture preferences.
Never invent facts, numbers, studies, quotations, guidelines or references.

1. Create ONE canonical Markdown document (lecture_master.md) containing all educational content — objectives,
   every section, all numbers with units, tables as Markdown tables, and a written description of every figure.
2. Add "References and source mapping": map each section to the source page or slide.
3. Mark anything that needs the doctor's verification under "Medical-review flags".
4. The paired PDF is rendered from this exact Markdown. Do not produce a separate, different PDF text.

Audience: {{AUDIENCE}} · Language: {{LANGUAGE}} · PDF style: {{PDF_STYLE}}`,
  },
  {
    key: 'A_parents', cat: 'A', title: 'Parent-friendly lecture extraction',
    description: 'Fictional example. Plain-language extraction for parent education, Egyptian Arabic aware.', tags: 'parents, Arabic',
    body: `FICTIONAL EXAMPLE PROMPT.

Rewrite the attached teaching source as a complete parent-education lecture. Keep every fact exactly; change only the
wording to plain language. When the language is Egyptian Arabic, use natural Egyptian colloquial wording (not Modern
Standard Arabic) and keep the precise medical term in parentheses where helpful.

Output the canonical Markdown only; the PDF is rendered from it.`,
  },
  {
    key: 'B_scenes', cat: 'B', title: 'Scene-by-scene storyboard',
    description: 'Fictional example. Storyboard table with timing that sums to the target duration.', tags: 'storyboard',
    body: `FICTIONAL EXAMPLE PROMPT.

Using only the approved lecture_master.md, create storyboard.md as a table of scenes:
Scene ID · Source heading · Target seconds · On-screen text (short) · Visual description · Figure reproduced?
Scene durations must add up to the target duration. Create one draft frame per scene. Do not change medical facts.`,
  },
  {
    key: 'B2_clean', cat: 'B2', title: 'Clean clinical slide visuals',
    description: 'Fictional example. Final silent frames in a calm clinical style.', tags: 'visuals, 16:9',
    body: `FICTIONAL EXAMPLE PROMPT.

Produce the complete silent visual sequence for the approved storyboard: numbered 1920×1080 frames in viewing order.
Use a calm clinical palette, large readable type and no decorative clip-art. Never claim a file exists that you did not create.`,
  },
  {
    key: 'C_chunks', cat: 'C', title: 'Timed narration in 60–90 s chunks',
    description: 'Fictional example. Narration transcripts following the chunk plan exactly.', tags: 'narration, timing',
    body: `FICTIONAL EXAMPLE PROMPT.

Write narration transcripts that follow the chunk plan exactly (each chunk 60–90 seconds of speech).
Transcripts contain only the words to be spoken — no headings, timecodes or stage directions.
TWO or MULTI speakers: start every line with the speaker label. Fill in chunk_manifest.json.`,
  },
  {
    key: 'C_dialogue', cat: 'C', title: 'Two-speaker teaching dialogue',
    description: 'Fictional example. Lecturer–resident dialogue format for case discussions.', tags: 'dialogue, TWO',
    body: `FICTIONAL EXAMPLE PROMPT.

Write the narration as a natural dialogue between a lecturer and a resident. The resident asks the questions a learner
would ask; the lecturer answers using only the approved content. Keep each chunk within 60–90 seconds.`,
  },
  {
    key: 'D_calm', cat: 'D', title: 'Calm, consistent voice direction',
    description: 'Fictional example. Voice style instructions reused for every chunk, Egyptian Arabic aware.', tags: 'voice, Arabic',
    body: `FICTIONAL EXAMPLE PROMPT.

Speak in natural Egyptian colloquial Arabic (not Modern Standard Arabic) when the lecture language is Egyptian Arabic.
Calm, warm, unhurried clinic pace. Keep the same voice for each speaker in every chunk. Pronounce medical terms as in the pronunciation guide.`,
  },
  {
    key: 'X_quiz', cat: 'X', title: 'Board-style vignette ideas',
    description: 'Fictional example in a library-only category (not mapped to any stage).', tags: 'quiz',
    body: `FICTIONAL EXAMPLE PROMPT.

Suggest three board-style vignettes based on the approved lecture content, each with a single best answer and a short explanation.`,
  },
]

const CATEGORIES = [
  { key: 'A', name: 'Lecture content', description: 'Prompts that turn a source into the canonical lecture text.', stageIds: ['A'] },
  { key: 'B', name: 'Storyboard', description: 'Scene planning and draft frames.', stageIds: ['B'] },
  { key: 'B2', name: 'Visual production', description: 'Final silent visuals.', stageIds: ['B2'] },
  { key: 'C', name: 'Narration transcripts', description: 'Timed narration chunks.', stageIds: ['C'] },
  { key: 'D', name: 'Voice generation', description: 'Voice and pronunciation direction for TTS.', stageIds: ['D'] },
  { key: 'X', name: 'Board review ideas', description: 'Library-only — not mapped to a workflow stage.', stageIds: [] },
]

function seedLibrary(state, now) {
  let s = state
  const catIds = {}
  for (const c of CATEGORIES) {
    const r = createCategory(s, c, now - 30 * 24 * 60 * MIN)
    s = r.state
    catIds[c.key] = r.result.id
  }
  s.categories.forEach((c) => { c.seeded = true })
  const promptIds = {}
  for (const p of PROMPTS) {
    const r = createPrompt(s, { title: p.title, categoryId: catIds[p.cat], description: p.description, tags: p.tags, body: p.body }, now - 20 * 24 * 60 * MIN)
    s = r.state
    promptIds[p.key] = r.result.id
  }
  s.profile.stageDefaults = { A: promptIds.A_doctors, B: promptIds.B_scenes, B2: promptIds.B2_clean, C: promptIds.C_chunks, D: promptIds.D_calm }

  const skills = [
    { title: 'Medical slide designer', description: 'Lays out clinical teaching slides with large type and consistent figure styling.', dependencies: 'Image generation; 16:9 frame export' },
    { title: 'Storyboard pacing helper', description: 'Checks that scene durations add up and flags overloaded scenes.', dependencies: 'None known' },
    { title: 'Arabic slide typography', description: 'Right-to-left slide layout guidance for Egyptian Arabic lectures.', dependencies: 'Arabic font bundle (unknown)' },
    { title: 'Whiteboard sketch style', description: 'Hand-drawn whiteboard illustration style.', dependencies: 'Unknown' },
  ]
  const skillIds = []
  for (const sk of skills) {
    const r = createSkill(s, sk, now - 10 * 24 * 60 * MIN)
    s = r.state
    skillIds.push(r.result.id)
  }
  s = mockImportSkill(s, skillIds[0], now - 9 * 24 * 60 * MIN).state
  s = verifySkill(s, skillIds[0], now - 9 * 24 * 60 * MIN).state
  s = mockImportSkill(s, skillIds[1], now - 8 * 24 * 60 * MIN).state
  s = archiveSkill(s, skillIds[3], now - 7 * 24 * 60 * MIN).state
  s.profile.defaultSkills = { ids: [skillIds[0]], none: false }
  return { state: s, catIds, promptIds, skillIds }
}

/** Library and settings only — the first-run / empty workspace. */
export function emptyWorkspace(now, opts) {
  const { state } = seedLibrary(baseState(now, opts), now)
  return state
}

export function seedDemo(now, opts = {}) {
  const lib = seedLibrary(baseState(now, { speed: 'manual' }), now)
  let s = lib.state
  const P = lib.promptIds
  const src = (topic) => ({ ...DEMO_SOURCES.find((d) => d.topic === topic), origin: 'demo' })
  const t = (minutesAgo) => now - minutesAgo * MIN

  // earlier usage this month (illustrative)
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime()
  const earlier = Math.max(monthStart, now - 6 * 24 * 60 * MIN)
  s.usage.push(
    { id: 'use_seed1', projectId: null, jobId: null, provider: 'anthropic', model: 'claude-sonnet', stage: 'B2', tokenCounts: { input: 52000, output: 18000 }, audioDuration: null, currency: 'USD', estimatedCost: 4.1, actualCost: null, timestamp: earlier, label: 'Earlier lectures (seeded)' },
    { id: 'use_seed2', projectId: null, jobId: null, provider: 'google', model: 'gemini-tts-flash', stage: 'D', tokenCounts: null, audioDuration: 3100, currency: 'USD', estimatedCost: 2.6, actualCost: null, timestamp: earlier, label: 'Earlier lectures (seeded)' },
    { id: 'use_seed3', projectId: null, jobId: null, provider: 'google', model: 'gemini-pro-text', stage: 'A', tokenCounts: { input: 88000, output: 31000 }, audioDuration: null, currency: 'USD', estimatedCost: 1.9, actualCost: null, timestamp: earlier, label: 'Earlier lectures (seeded)' },
  )

  const create = (at, data) => {
    const r = createProject(s, { start: true, ...data }, at)
    s = r.state
    return r.result.projectId
  }
  const finish = (at) => { s = finishRunningJobs(s, at) }
  const approve = (pid, at, extra = {}) => {
    const p = getProject(s, pid)
    const pr = computeProgress(p)
    const r = decide(s, { projectId: pid, gate: pr.stage, fp: pr.fp, decision: 'APPROVE', confirm: true, watched: true, acceptTiming: true, acceptUnverified: true, skills: { ids: [lib.skillIds[0]] }, ...extra }, at)
    if (!r.result.ok) throw new Error(`seed approve ${pr.stage}: ${r.result.error}`)
    s = r.state
  }
  const reject = (pid, at, note, extra = {}) => {
    const p = getProject(s, pid)
    const pr = computeProgress(p)
    const r = decide(s, { projectId: pid, gate: pr.stage, fp: pr.fp, decision: 'REJECT', note, ...extra }, at)
    if (!r.result.ok) throw new Error(`seed reject ${pr.stage}: ${r.result.error}`)
    s = r.state
  }

  // P5 — completed lecture (uses content prompt v1)
  const p5 = create(t(4320), {
    title: 'Bronchiolitis: board-style review', source: src('bronchiolitis'), promptId: P.A_doctors,
    prefs: { audience: 'Doctors', language: 'English', pdfStyle: 'USMLE', durationMin: 7, speakerMode: 'MULTI', voiceDirection: 'Clear, measured teaching voices; resident sounds curious.', timingPolicy: 'ASK' },
  })
  finish(t(4310)); approve(p5, t(4200)); approve(p5, t(4190))
  finish(t(4180)); approve(p5, t(4000))
  finish(t(3990)); finish(t(3980))
  reject(p5, t(3900), 'Chunk 03 rushes the vignette explanation — slow it down and add a pause point.', { affectedIds: ['03'] })
  finish(t(3890)); approve(p5, t(3850))
  finish(t(3840)); approve(p5, t(3700))
  finish(t(3690)); approve(p5, t(3600))

  // Prompt v2 after P5 used v1 (demonstrates preserved prompt versions)
  const cur = s.prompts.find((p) => p.id === P.A_doctors)
  s = editPrompt(s, P.A_doctors, { title: cur.title, categoryId: cur.categoryId, description: cur.description, tags: cur.tags, body: PROMPTS[0].v2, note: 'Added source-mapping section' }, t(1700)).state

  // P2 — waiting at H4 transcripts
  const p2 = create(t(1560), {
    title: 'Asthma action plans for school-age children', source: src('asthma'), promptId: P.A_doctors,
    prefs: { audience: 'Doctors', language: 'English', pdfStyle: 'USMLE', durationMin: 10, speakerMode: 'ONE', voiceDirection: 'Calm, warm and unhurried — clinic teaching pace.', timingPolicy: 'ASK' },
  })
  finish(t(1550)); approve(p2, t(1500)); approve(p2, t(1440))
  finish(t(1430)); approve(p2, t(360))
  finish(t(350)); finish(t(305))

  // P7 — draft
  s = createProject(s, {
    title: 'Oral rehydration at home', source: src('hydration'), promptId: P.A_parents, start: false,
    prefs: { audience: 'Parents', language: 'English', pdfStyle: 'Parent Education', durationMin: 5, speakerMode: 'ONE', voiceDirection: 'Reassuring and practical.', timingPolicy: 'ASK' },
  }, t(185)).state

  // P4 — blocked at D (provider quota)
  const p4 = create(t(250), {
    title: 'What to expect at a vaccination visit', source: src('vaccines'), promptId: P.A_parents,
    prefs: { audience: 'Parents', language: 'English', pdfStyle: 'Parent Education', durationMin: 5, speakerMode: 'ONE', voiceDirection: 'Friendly and reassuring.', timingPolicy: 'ASK' },
  })
  finish(t(245)); approve(p4, t(230)); approve(p4, t(228))
  finish(t(225)); approve(p4, t(200))
  finish(t(195)); finish(t(190)); approve(p4, t(60))
  s.demo.injectFailure = 'QUOTA'
  finish(t(40))

  // P1 — Egyptian Arabic, H1 with a previous rejection
  const p1 = create(t(190), {
    title: 'Neonatal jaundice: a guide for parents', source: src('jaundice'), promptId: P.A_parents,
    prefs: { audience: 'Parents', language: 'Egyptian Arabic', pdfStyle: 'Parent Education', durationMin: 8, speakerMode: 'TWO', voiceDirection: 'Egyptian colloquial, warm, slow enough for parents to follow.', timingPolicy: 'ASK' },
  })
  finish(t(185))
  reject(p1, t(150), 'Keep the warning signs on slide 9 exactly as written in the source — do not paraphrase them.')
  finish(t(148))

  // P6 — waiting at H5 audio
  const p6 = create(t(140), {
    title: 'Growth charts for new residents', source: src('growth'), promptId: P.A_doctors,
    prefs: { audience: 'Doctors', language: 'English', pdfStyle: 'USMLE', durationMin: 5, speakerMode: 'TWO', voiceDirection: 'Conversational; resident asks short questions.', timingPolicy: 'ASK' },
  })
  finish(t(135)); approve(p6, t(120)); approve(p6, t(118, ), { nextPrompts: { C: P.C_dialogue } })
  finish(t(115)); approve(p6, t(100))
  finish(t(95)); finish(t(90)); approve(p6, t(70))
  finish(t(35))

  // P3 — processing (silent visuals running)
  const p3 = create(t(75), {
    title: 'Iron-deficiency anaemia: a case-based review', source: src('iron'), promptId: P.A_doctors,
    prefs: { audience: 'Doctors', language: 'English', pdfStyle: 'USMLE', durationMin: 6, speakerMode: 'TWO', voiceDirection: 'Case discussion tone.', timingPolicy: 'ASK' },
  })
  finish(t(70)); approve(p3, t(50)); approve(p3, t(48))
  finish(t(44)); approve(p3, t(3))

  void p4
  void startDraft
  // Finalise: mark seeded history, order feeds, apply requested speed.
  s.decisions.forEach((d) => { d.seeded = true })
  s.notifications.forEach((n) => { if (n.resolvedAt || n.createdAt < t(1000)) n.readAt = n.readAt || n.resolvedAt || n.createdAt })
  s.notifications.sort((a, b) => b.createdAt - a.createdAt)
  s.deliveryLog.sort((a, b) => b.at - a.at)
  s.activity.sort((a, b) => b.at - a.at)
  s.demo.speed = opts.speed || 'fast'
  s.demo.injectFailure = null
  if (s.demo.speed !== 'manual') {
    s.jobs.filter((j) => j.status === 'running').forEach((j, i) => { j.dueAt = now + 20_000 + i * 5000 })
  }
  s.meta.seededAt = now
  void p3
  return clone(s)
}
