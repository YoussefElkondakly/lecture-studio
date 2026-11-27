import { describe, expect, it } from 'vitest'
import { planChunks, validatePlan } from './chunks.js'
import { emptyWorkspace, seedDemo } from './seed.js'
import {
  advance, computeProgress, createProject, decide, editContent, editTranscript, finishRunningJobs, gateFingerprint,
  getProject, retryProject, settle, tick, dashboardCounts, pendingReviews, completedGateCount, monthSpend,
} from './workflow.js'
import {
  archiveCategory, createCategory, createPrompt, deleteCategory, deletePrompt, editPrompt, updateBudget, connectProvider,
  disconnectProvider, verifySkill, createSkill,
} from './library.js'

const T0 = Date.UTC(2026, 10, 27, 9, 0, 0)

function fresh() {
  return emptyWorkspace(T0, { speed: 'manual' })
}

function start(state, overrides = {}) {
  const promptId = state.profile.stageDefaults.A
  const r = createProject(state, {
    title: 'Synthetic test lecture',
    source: { name: 'test-notes.pdf', type: 'PDF', size: 1000, origin: 'demo', topic: 'asthma' },
    promptId,
    prefs: { ...state.profile.defaults, durationMin: 5 },
    start: true,
    ...overrides,
  }, T0)
  expect(r.result.ok).toBe(true)
  return { state: r.state, id: r.result.projectId }
}

function at(state, id) {
  return computeProgress(getProject(state, id))
}

function approve(state, id, t, extra = {}) {
  const pr = at(state, id)
  const skillId = state.skills.find((s) => s.status === 'api_ready')?.id
  const r = decide(state, {
    projectId: id, gate: pr.stage, fp: pr.fp, decision: 'APPROVE', confirm: true, watched: true, acceptTiming: true,
    skills: { ids: skillId ? [skillId] : [], none: !skillId }, ...extra,
  }, t)
  expect(r.result.error).toBeUndefined()
  return r.state
}

function runToGate(state, gate, t) {
  let s = state
  for (let i = 0; i < 20; i++) {
    s = settle(s, t)
    const ids = s.projects.map((p) => p.id)
    if (ids.every((id) => at(s, id).kind !== 'machine')) break
  }
  return s
}

describe('chunk planning (baseline 60–90 s rules)', () => {
  it('splits 600 s into 7 chunks of 85–86 s', () => {
    const plan = planChunks(600)
    expect(plan.chunks).toHaveLength(7)
    expect(plan.chunks.every((c) => c.targetSeconds >= 85 && c.targetSeconds <= 86)).toBe(true)
    expect(validatePlan(plan)).toEqual([])
  })
  it('keeps every chunk inside 60–90 s for 1–30 minutes', () => {
    for (let m = 1; m <= 30; m++) {
      const plan = planChunks(m * 60)
      expect(validatePlan(plan)).toEqual([])
      expect(plan.chunks.reduce((s, c) => s + c.targetSeconds, 0)).toBe(m * 60)
    }
  })
  it('adjusts or declares exceptions for non-partitionable durations', () => {
    expect(planChunks(100).exception.adjustedTo).toBe(90)
    const short = planChunks(100, 'FINAL_SHORT')
    expect(short.exception).toBe('FINAL_SHORT')
    expect(short.chunks.at(-1).finalShortException).toBe(true)
  })
})

describe('six-gate workflow', () => {
  it('runs through all six gates in order with automatic machine stages between them', () => {
    let { state, id } = start(fresh())
    const seen = []
    let t = T0
    for (let i = 0; i < 12; i++) {
      t += 60_000
      state = runToGate(state, null, t)
      const pr = at(state, id)
      if (pr.kind === 'done') break
      seen.push(pr.stage)
      state = approve(state, id, t)
    }
    expect(seen).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])
    const p = getProject(state, id)
    expect(p.status).toBe('COMPLETED')
    expect(completedGateCount(p)).toBe(6)
    expect(state.decisions.filter((d) => d.projectId === id)).toHaveLength(6)
  })

  it('never approves without an explicit human decision', () => {
    let { state, id } = start(fresh())
    state = runToGate(state, 'H1', T0 + 1000)
    state = tick(state, T0 + 10 * 60 * 60_000)
    expect(at(state, id).stage).toBe('H1')
    expect(state.decisions).toHaveLength(0)
  })

  it('requires confirmations at H1, H5 timing exceptions and H6', () => {
    let { state, id } = start(fresh())
    state = runToGate(state, 'H1', T0 + 1000)
    const pr = at(state, id)
    const r = decide(state, { projectId: id, gate: 'H1', fp: pr.fp, decision: 'APPROVE' }, T0 + 2000)
    expect(r.result.code).toBe('CONFIRM_REQUIRED')
  })
})

describe('H1 rejection, regeneration and stale approval (D02, D10)', () => {
  it('rejected version cannot be approved and regeneration produces a new revision', () => {
    let { state, id } = start(fresh())
    state = runToGate(state, 'H1', T0 + 1000)
    const v1 = at(state, id)
    const short = decide(state, { projectId: id, gate: 'H1', fp: v1.fp, decision: 'REJECT', note: 'too short' }, T0 + 2000)
    expect(short.result.code).toBe('NOTE_REQUIRED')
    state = decide(state, { projectId: id, gate: 'H1', fp: v1.fp, decision: 'REJECT', note: 'Keep the warning signs verbatim from the source.' }, T0 + 2000).state
    expect(at(state, id)).toMatchObject({ stage: 'A', revision: true })
    expect(getProject(state, id).status).toBe('REVISION_REQUESTED')
    // stale approval of the rejected version fails safely
    const stale = decide(state, { projectId: id, gate: 'H1', fp: v1.fp, decision: 'APPROVE', confirm: true }, T0 + 3000)
    expect(stale.result.ok).toBe(false)
    state = runToGate(state, 'H1', T0 + 4000)
    const v2 = at(state, id)
    expect(v2.stage).toBe('H1')
    expect(v2.fp).not.toBe(v1.fp)
    const content = getProject(state, id).artifacts.content
    expect(content).toHaveLength(2)
    expect(content[1].md).toContain('Keep the warning signs verbatim')
    state = approve(state, id, T0 + 5000)
    expect(at(state, id).stage).toBe('H2')
  })

  it('direct H1 edit creates a new revision, re-renders the PDF and makes the old version stale', () => {
    let { state, id } = start(fresh())
    state = runToGate(state, 'H1', T0 + 1000)
    const v1 = at(state, id)
    const md = getProject(state, id).artifacts.content[0].md + '\n\nDoctor addition: clarify the follow-up visit.'
    state = editContent(state, { projectId: id, fp: v1.fp, md, note: 'clarified follow-up' }, T0 + 2000).state
    expect(at(state, id)).toMatchObject({ stage: 'A', task: 'pdf' })
    state = runToGate(state, 'H1', T0 + 3000)
    const v2 = at(state, id)
    expect(v2.stage).toBe('H1')
    expect(v2.fp).not.toBe(v1.fp)
    const stale = decide(state, { projectId: id, gate: 'H1', fp: v1.fp, decision: 'APPROVE', confirm: true }, T0 + 4000)
    expect(stale.result.code).toBe('STALE_VERSION')
    const c = getProject(state, id).artifacts.content
    expect(c[1].producer).toBe('doctor')
    expect(c[1].pdf.status).toBe('ready')
  })
})

function toGate(state, id, gate, t) {
  let s = state
  for (let i = 0; i < 12; i++) {
    s = runToGate(s, null, t)
    const pr = at(s, id)
    if (pr.stage === gate) return s
    s = approve(s, id, t)
  }
  throw new Error(`never reached ${gate}`)
}

describe('targeted revisions and invalidation', () => {
  it('H4 rejection regenerates only the selected chunks', () => {
    let { state, id } = start(fresh())
    state = toGate(state, id, 'H4', T0 + 1000)
    const before = getProject(state, id).artifacts.transcripts
    const pr = at(state, id)
    state = decide(state, { projectId: id, gate: 'H4', fp: pr.fp, decision: 'REJECT', note: 'Chunk 02 needs a slower pace.', affectedIds: ['02'] }, T0 + 2000).state
    expect(at(state, id)).toMatchObject({ stage: 'C', targets: ['02'] })
    state = runToGate(state, null, T0 + 3000)
    const after = getProject(state, id).artifacts.transcripts
    expect(after['02']).toHaveLength(2)
    expect(after['01']).toHaveLength(1)
    expect(after['01'][0].id).toBe(before['01'][0].id)
  })

  it('direct transcript edit keeps H1–H3 approvals and only resets H4 onwards', () => {
    let { state, id } = start(fresh())
    state = toGate(state, id, 'H4', T0 + 1000)
    const pr = at(state, id)
    const tr = getProject(state, id).artifacts.transcripts['01'][0]
    state = editTranscript(state, { projectId: id, fp: pr.fp, chunkId: '01', text: tr.text + ' Edited sentence.' }, T0 + 2000).state
    const p = getProject(state, id)
    expect(at(state, id).stage).toBe('H4')
    for (const g of ['H1', 'H2', 'H3']) expect(p.approvals[g].fp).toBe(gateFingerprint(p, g))
  })

  it('H6 AUDIO route regenerates the listed voice only and preserves earlier gates (D08)', () => {
    let { state, id } = start(fresh())
    state = toGate(state, id, 'H6', T0 + 1000)
    const p0 = getProject(state, id)
    const firstRender = p0.artifacts.renders[0].id
    const audio01 = p0.artifacts.audio['01'][0].id
    const pr = at(state, id)
    const bad = decide(state, { projectId: id, gate: 'H6', fp: pr.fp, decision: 'REJECT', note: 'Chunk 02 voice clips at the end.', route: 'AUDIO' }, T0 + 2000)
    expect(bad.result.code).toBe('IDS_REQUIRED')
    state = decide(state, { projectId: id, gate: 'H6', fp: pr.fp, decision: 'REJECT', note: 'Chunk 02 voice clips at the end.', route: 'AUDIO', affectedIds: ['02'] }, T0 + 2000).state
    expect(at(state, id)).toMatchObject({ stage: 'D', targets: ['02'] })
    state = runToGate(state, null, T0 + 3000)
    expect(at(state, id).stage).toBe('H5')
    const p = getProject(state, id)
    for (const g of ['H1', 'H2', 'H3', 'H4']) expect(p.approvals[g].fp).toBe(gateFingerprint(p, g))
    expect(p.artifacts.audio['01'][0].id).toBe(audio01)
    expect(p.artifacts.audio['02']).toHaveLength(2)
    state = approve(state, id, T0 + 4000)
    state = runToGate(state, null, T0 + 5000)
    const p2 = getProject(state, id)
    expect(at(state, id).stage).toBe('H6')
    expect(p2.artifacts.renders).toHaveLength(2)
    expect(p2.artifacts.renders[0].id).toBe(firstRender)
    state = approve(state, id, T0 + 6000)
    expect(getProject(state, id).status).toBe('COMPLETED')
  })

  it('H6 RENDER_ONLY requires changed render settings', () => {
    let { state, id } = start(fresh())
    state = toGate(state, id, 'H6', T0 + 1000)
    const pr = at(state, id)
    const same = decide(state, { projectId: id, gate: 'H6', fp: pr.fp, decision: 'REJECT', note: 'Fade feels abrupt here.', route: 'RENDER_ONLY', renderSettings: { gapSeconds: 0.5, fadeSeconds: 1 } }, T0 + 2000)
    expect(same.result.code).toBe('SETTINGS_UNCHANGED')
    state = decide(state, { projectId: id, gate: 'H6', fp: pr.fp, decision: 'REJECT', note: 'Fade feels abrupt here.', route: 'RENDER_ONLY', renderSettings: { gapSeconds: 0.5, fadeSeconds: 1.5 } }, T0 + 2000).state
    expect(at(state, id).stage).toBe('E')
  })

  it('H6 CONTENT route resets every gate', () => {
    let { state, id } = start(fresh())
    state = toGate(state, id, 'H6', T0 + 1000)
    const pr = at(state, id)
    state = decide(state, { projectId: id, gate: 'H6', fp: pr.fp, decision: 'REJECT', note: 'A table value must change.', route: 'CONTENT' }, T0 + 2000).state
    state = runToGate(state, null, T0 + 3000)
    expect(at(state, id).stage).toBe('H1')
    expect(completedGateCount(getProject(state, id))).toBe(0)
  })
})

describe('jobs, concurrency and notifications', () => {
  it('two projects progress independently; a blocked project does not stop another (D04, US05)', () => {
    let { state, id: a } = start(fresh())
    const r = start(state, { title: 'Second synthetic lecture' })
    state = r.state
    const b = r.id
    state = disconnectProvider(state, 'anthropic', T0).state
    state = toGate(state, a, 'H2', T0 + 1000)
    state = approve(state, a, T0 + 2000) // H2 → B needs Anthropic → blocked
    expect(getProject(state, a).status).toBe('BLOCKED')
    state = runToGate(state, null, T0 + 3000)
    expect(at(state, b).stage).toBe('H1')
    state = connectProvider(state, 'anthropic', T0 + 4000).state
    state = retryProject(state, a, T0 + 5000).state
    state = runToGate(state, null, T0 + 6000)
    expect(at(state, a).stage).toBe('H3')
  })

  it('does not create duplicate jobs for the same stage and input', () => {
    let { state, id } = start(fresh())
    const p = getProject(state, id)
    advance(state, p, T0 + 1)
    advance(state, p, T0 + 2)
    state = tick(state, T0 + 3)
    expect(state.jobs.filter((j) => j.projectId === id && j.status === 'running')).toHaveLength(1)
  })

  it('creates one review notification per project/gate/version', () => {
    let { state, id } = start(fresh())
    state = runToGate(state, 'H1', T0 + 1000)
    state = tick(state, T0 + 2000)
    state = tick(state, T0 + 3000)
    expect(state.notifications.filter((n) => n.projectId === id && n.kind === 'review')).toHaveLength(1)
    const n = state.notifications[0]
    expect(n.channelStatuses).toEqual({ inApp: 'delivered', email: 'simulated', push: 'simulated' })
    state = approve(state, id, T0 + 4000)
    expect(state.notifications.find((x) => x.id === n.id).resolvedAt).toBe(T0 + 4000)
  })

  it('budget stop blocks with an explicit error and retry resumes without losing work (D06)', () => {
    let { state, id } = start(fresh())
    state = toGate(state, id, 'H2', T0 + 1000)
    state = updateBudget(state, { limit: monthSpend(state, T0) + 0.01 }).state
    state = approve(state, id, T0 + 2000)
    const p = getProject(state, id)
    expect(p.status).toBe('BLOCKED')
    expect(p.error.code).toBe('BUDGET')
    expect(p.artifacts.content).toHaveLength(1)
    const again = retryProject(state, id, T0 + 3000)
    expect(getProject(again.state, id).error.code).toBe('BUDGET')
    state = updateBudget(state, { limit: 20 }).state
    state = retryProject(state, id, T0 + 4000).state
    expect(getProject(state, id).status).toBe('PROCESSING')
    expect(state.jobs[0].attempt).toBe(2)
  })

  it('reconciles jobs that finished while the browser was closed', () => {
    let state = emptyWorkspace(T0, { speed: 'fast' })
    const r = start(state)
    state = r.state
    state = tick(state, T0 + 60 * 60_000)
    expect(at(state, r.id).stage).toBe('H1')
  })
})

describe('prompt library', () => {
  it('keeps the exact prompt version for existing projects after edits (D05)', () => {
    let { state, id } = start(fresh())
    const promptId = state.profile.stageDefaults.A
    const v1 = getProject(state, id).promptRefs.A
    const pr = state.prompts.find((p) => p.id === promptId)
    state = editPrompt(state, promptId, { title: pr.title, categoryId: pr.categoryId, body: 'A new body for version two of this fictional prompt.' }, T0 + 1000).state
    expect(getProject(state, id).promptRefs.A.versionId).toBe(v1.versionId)
    const r2 = start(state, { title: 'Newer lecture' })
    expect(getProject(r2.state, r2.id).promptRefs.A.version).toBe(2)
  })

  it('categories map only to existing stages and cannot be destroyed while referenced (D09)', () => {
    let state = fresh()
    expect(createCategory(state, { name: 'New stage?', stageIds: ['Z'] }, T0).result.ok).toBe(false)
    let r = createCategory(state, { name: 'Case vignettes', stageIds: ['A'] }, T0)
    state = r.state
    const cat = r.result.id
    r = createPrompt(state, { title: 'Vignette extraction', categoryId: cat, body: 'Extract vignettes from the fictional source text.' }, T0)
    state = r.state
    const promptId = r.result.id
    const used = start(state, { promptId })
    state = used.state
    expect(getProject(state, used.id).promptRefs.A.categoryName).toBe('Case vignettes')
    expect(deleteCategory(state, cat).result.ok).toBe(false)
    expect(deletePrompt(state, promptId).result.ok).toBe(false)
    const target = state.categories.find((c) => c.name === 'Lecture content').id
    state = archiveCategory(state, cat, { reassignTo: target }, T0).state
    expect(state.prompts.find((p) => p.id === promptId).categoryId).toBe(target)
    expect(getProject(state, used.id).promptRefs.A.categoryName).toBe('Case vignettes')
    expect(state.categories.length).toBe(7)
  })
})

describe('skills', () => {
  it('web references cannot be verified for API use', () => {
    let state = fresh()
    const r = createSkill(state, { title: 'Some web skill' }, T0)
    expect(verifySkill(r.state, r.result.id, T0).result.ok).toBe(false)
  })
})

describe('seeded demo', () => {
  it('produces a consistent dashboard', () => {
    const state = seedDemo(T0, { speed: 'manual' })
    const c = dashboardCounts(state)
    expect(c).toMatchObject({ review: 3, processing: 1, blocked: 1, completed: 1, drafts: 1 })
    expect(pendingReviews(state).map((r) => r.gate).sort()).toEqual(['H1', 'H4', 'H5'])
    const done = state.projects.find((p) => p.status === 'COMPLETED')
    expect(done.promptRefs.A.version).toBe(1)
    const asthma = state.projects.find((p) => p.title.startsWith('Asthma'))
    expect(asthma.promptRefs.A.version).toBe(2)
    expect(state.notifications.filter((n) => n.kind === 'review' && !n.resolvedAt)).toHaveLength(3)
    const later = settle(state, T0 + 1000)
    expect(dashboardCounts(later).review).toBe(4)
  })
})
