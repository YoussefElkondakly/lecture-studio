// Deterministic lecture-production simulator.
//
// Design: like the baseline helper (state.py), the current stage is *derived* from artifacts,
// their fingerprints and the append-only approval log — never stored as a free-floating pointer.
// Approval validity is "recorded fingerprint === current fingerprint", which makes the PRD
// invalidation rules fall out of how fingerprints are composed:
//   H1 = content revision (MD + paired PDF)        H2 = content revision
//   H3 = content + storyboard version              H4 = content + storyboard + every transcript version
//   H5 = content + every audio version             H6 = render version (visuals + audio + settings)
// so e.g. a transcript change resets H4/H5/H6 but keeps H1–H3, and new visuals reset only render + H6.
//
// All functions are pure: (state, input, now) -> { state, result }. No timers, no randomness.

import {
  FAILURE_CODES, GATES, H6_ROUTES, MOCK_COST, PROMPT_STAGE_IDS, SPEEDS, STATION_BY_ID, STATIONS, STATUS,
  CHUNK_MAX_S, CHUNK_MIN_S,
} from './constants.js'
import { planChunks } from './chunks.js'
import {
  generateContentMarkdown, generateStoryboard, generateTranscript, measureAudio, isArabic,
} from './content.js'
import { clone, hash, last, nextId, seeded } from './util.js'

export const REVIEWER = { id: 'doctor', name: 'Dr. Ashraf Elbasel', role: 'doctor' }

// ---------------------------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------------------------

function isRejected(project, key) {
  return project.rejectedKeys.includes(key)
}

function currentTranscripts(project) {
  const out = {}
  for (const c of project.plan.chunks) out[c.id] = last(project.artifacts.transcripts[c.id] || [])
  return out
}

function currentAudio(project) {
  const out = {}
  for (const c of project.plan.chunks) out[c.id] = last(project.artifacts.audio[c.id] || [])
  return out
}

export function gateFingerprint(project, gate) {
  const a = project.artifacts
  const content = last(a.content)
  switch (gate) {
    case 'H1':
      return content ? `H1:${content.id}:${content.pdf.id}` : null
    case 'H2':
      return content ? `H2:${content.id}` : null
    case 'H3': {
      const sb = last(a.storyboard)
      return sb && content ? `H3:${content.id}:${sb.id}` : null
    }
    case 'H4': {
      const sb = last(a.storyboard)
      const tr = currentTranscripts(project)
      if (!sb || Object.values(tr).some((t) => !t)) return null
      return `H4:${hash([content?.id, sb.id, ...Object.values(tr).map((t) => t.id)])}`
    }
    case 'H5': {
      const au = currentAudio(project)
      if (Object.values(au).some((x) => !x)) return null
      return `H5:${hash([content?.id, ...Object.values(au).map((x) => x.id)])}`
    }
    case 'H6': {
      const r = last(a.renders)
      return r ? `H6:${r.id}` : null
    }
    default:
      return null
  }
}

function approvedFor(project, gate, fp) {
  return Boolean(fp) && project.approvals[gate]?.fp === fp
}

/**
 * Where is this project? Returns { stage, kind: 'machine'|'gate'|'done', fp?, task?, targets?, revision? }.
 * `revision` is true when the machine stage runs because a human asked for changes.
 */
export function computeProgress(project) {
  const a = project.artifacts
  const content = last(a.content)

  // A — lecture content + paired PDF
  if (!content || isRejected(project, content.id)) {
    return { stage: 'A', kind: 'machine', task: 'content', revision: Boolean(content) }
  }
  if (content.pdf.status !== 'ready') return { stage: 'A', kind: 'machine', task: 'pdf', revision: true }

  // H1
  const h1 = gateFingerprint(project, 'H1')
  if (!approvedFor(project, 'H1', h1)) return { stage: 'H1', kind: 'gate', fp: h1 }

  // H2
  const h2 = gateFingerprint(project, 'H2')
  if (!approvedFor(project, 'H2', h2)) return { stage: 'H2', kind: 'gate', fp: h2 }

  // B — storyboard for the current content
  const sb = last(a.storyboard)
  if (!sb || sb.contentId !== content.id || isRejected(project, sb.id)) {
    return { stage: 'B', kind: 'machine', task: 'storyboard', revision: Boolean(sb && isRejected(project, sb.id)) }
  }
  const h3 = gateFingerprint(project, 'H3')
  if (!approvedFor(project, 'H3', h3)) return { stage: 'H3', kind: 'gate', fp: h3 }

  // B2 — silent visuals for the approved storyboard
  const vis = last(a.visuals)
  if (!vis || vis.storyboardId !== sb.id || isRejected(project, vis.id)) {
    return { stage: 'B2', kind: 'machine', task: 'visuals', revision: Boolean(vis && isRejected(project, vis.id)) }
  }

  // C — transcripts (targeted: only missing, outdated or rejected chunks)
  const tr = currentTranscripts(project)
  const trTargets = project.plan.chunks
    .filter((c) => !tr[c.id] || tr[c.id].contentId !== content.id || isRejected(project, tr[c.id].id))
    .map((c) => c.id)
  if (trTargets.length) {
    const revision = trTargets.some((id) => tr[id] && isRejected(project, tr[id].id))
    return { stage: 'C', kind: 'machine', task: 'transcripts', targets: trTargets, revision }
  }
  const h4 = gateFingerprint(project, 'H4')
  if (!approvedFor(project, 'H4', h4)) return { stage: 'H4', kind: 'gate', fp: h4 }

  // D — voices (targeted: missing, transcript changed, or rejected)
  const au = currentAudio(project)
  const auTargets = project.plan.chunks
    .filter((c) => !au[c.id] || au[c.id].transcriptId !== tr[c.id].id || isRejected(project, au[c.id].id))
    .map((c) => c.id)
  if (auTargets.length) {
    const revision = auTargets.some((id) => au[id])
    return { stage: 'D', kind: 'machine', task: 'voices', targets: auTargets, revision }
  }
  const h5 = gateFingerprint(project, 'H5')
  if (!approvedFor(project, 'H5', h5)) return { stage: 'H5', kind: 'gate', fp: h5 }

  // E — render
  const render = last(a.renders)
  const audioIds = project.plan.chunks.map((c) => au[c.id].id)
  const renderStale = !render
    || render.visualsId !== vis.id
    || render.audioIds.join() !== audioIds.join()
    || render.settingsRev !== project.renderSettings.rev
    || isRejected(project, render.id)
  if (renderStale) return { stage: 'E', kind: 'machine', task: 'render', revision: Boolean(render) }
  const h6 = gateFingerprint(project, 'H6')
  if (!approvedFor(project, 'H6', h6)) return { stage: 'H6', kind: 'gate', fp: h6 }

  return { stage: 'DONE', kind: 'done' }
}

/** Per-station display state for the production rail. */
export function stationStates(project) {
  const progress = project.progress || computeProgress(project)
  const idx = STATIONS.findIndex((s) => s.id === progress.stage)
  return STATIONS.map((s, i) => {
    let state
    if (progress.stage === 'DONE') state = 'done'
    else if (i < idx) state = 'done'
    else if (i === idx) {
      if (project.status === STATUS.BLOCKED) state = 'blocked'
      else if (s.kind === 'gate') state = 'review'
      else state = 'running'
    } else state = 'upcoming'
    // A gate previously approved but whose fingerprint changed shows as "reset".
    if (s.kind === 'gate' && state === 'upcoming' && project.approvals[s.id]) state = 'reset'
    if (s.kind === 'gate' && state === 'review' && project.approvals[s.id]) state = 'review-again'
    return { ...s, state }
  })
}

export function completedGateCount(project) {
  return GATES.filter((g) => approvedFor(project, g, gateFingerprint(project, g))).length
}

// ---------------------------------------------------------------------------------------------
// Helpers on state
// ---------------------------------------------------------------------------------------------

export function getProject(state, id) {
  return state.projects.find((p) => p.id === id)
}

function logActivity(state, project, at, text, kind = 'info') {
  state.activity.unshift({ id: nextId(state, 'act'), projectId: project?.id ?? null, at, text, kind })
  if (state.activity.length > 300) state.activity.length = 300
}

export function monthSpend(state, now) {
  const d = new Date(now)
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  return state.usage.filter((u) => u.timestamp >= start).reduce((s, u) => s + u.estimatedCost, 0)
}

function stageProvider(stage, task) {
  if (task === 'pdf') return 'local'
  return STATION_BY_ID[stage].provider
}

function modelFor(state, provider, task) {
  if (provider === 'local') return task === 'pdf' ? 'Local PDF renderer' : 'Local FFmpeg renderer'
  return state.providers[provider].models[STATION_BY_ID_TASK[task] || task]
}

const STATION_BY_ID_TASK = { content: 'content', storyboard: 'creative', visuals: 'creative', transcripts: 'creative', voices: 'tts' }

export function resolvePromptRef(state, project, stage) {
  if (project.promptRefs[stage]) return project.promptRefs[stage]
  const pickId = state.profile.stageDefaults[stage]
  const prompt = state.prompts.find((p) => p.id === pickId && !p.archivedAt)
    || compatiblePrompts(state, stage)[0]
  return prompt ? promptSnapshot(state, prompt.id) : null
}

export function promptSnapshot(state, promptId, versionId) {
  const prompt = state.prompts.find((p) => p.id === promptId)
  if (!prompt) return null
  const version = state.promptVersions.find((v) => v.id === (versionId || prompt.activeVersionId))
  const category = state.categories.find((c) => c.id === prompt.categoryId)
  return {
    promptId: prompt.id,
    versionId: version.id,
    version: version.version,
    title: version.title,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? 'Uncategorised',
    stageIds: category?.stageIds ?? [],
  }
}

/** Active prompts whose (active) category maps to the stage. */
export function compatiblePrompts(state, stage) {
  const cats = new Set(state.categories.filter((c) => !c.archivedAt && c.stageIds.includes(stage)).map((c) => c.id))
  return state.prompts.filter((p) => !p.archivedAt && cats.has(p.categoryId))
}

function jobDuration(state, jobId, task) {
  const speed = SPEEDS[state.demo.speed] || SPEEDS.fast
  if (!Number.isFinite(speed.min)) return null
  const factor = task === 'pdf' ? 0.4 : 1
  return Math.round((speed.min + seeded(jobId) * (speed.max - speed.min)) * factor)
}

function activeJob(state, projectId) {
  return state.jobs.find((j) => j.projectId === projectId && (j.status === 'running' || j.status === 'queued'))
}

// ---------------------------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------------------------

export function notify(state, { project, kind, gate = null, fp = null, title, body, deepLink, at, dedupKey }) {
  const key = dedupKey || `${project?.id}:${gate}:${fp}`
  if (state.notifications.some((n) => n.dedupKey === key)) return null
  const prefs = state.profile.notificationPrefs
  const wantsChannel = (ch) => prefs[ch] && (kind === 'review' ? prefs.reviewReady : kind === 'issue' ? prefs.issues : prefs.completed)
  const n = {
    id: nextId(state, 'ntf'),
    projectId: project?.id ?? null,
    gate,
    artifactFp: fp,
    kind,
    title,
    body,
    deepLink,
    createdAt: at,
    readAt: null,
    resolvedAt: null,
    resolution: null,
    dedupKey: key,
    channelStatuses: {
      inApp: 'delivered',
      email: wantsChannel('email') ? 'simulated' : 'off',
      push: wantsChannel('push') ? 'simulated' : 'off',
    },
  }
  state.notifications.unshift(n)
  for (const ch of ['email', 'push']) {
    state.deliveryLog.unshift({
      id: nextId(state, 'dlv'),
      notificationId: n.id,
      channel: ch,
      status: n.channelStatuses[ch] === 'simulated' ? 'Simulated — not sent' : 'Channel off',
      to: ch === 'email' ? 'dr.ashraf@example.invalid' : 'Doctor’s phone (demo device)',
      subject: title,
      at,
    })
  }
  if (state.deliveryLog.length > 400) state.deliveryLog.length = 400
  return n
}

function resolveNotifications(state, projectId, predicate, at, resolution) {
  for (const n of state.notifications) {
    if (n.projectId === projectId && !n.resolvedAt && predicate(n)) {
      n.resolvedAt = at
      n.resolution = resolution
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Advancing a project (enqueue jobs / open gates)
// ---------------------------------------------------------------------------------------------

function inputFingerprint(project, progress) {
  const a = project.artifacts
  return hash([
    progress.stage, progress.task, progress.targets,
    last(a.content)?.id, last(a.content)?.pdf?.id, last(a.storyboard)?.id, last(a.visuals)?.id,
    project.renderSettings.rev, project.rejectedKeys.length,
  ])
}

export function advance(state, project, at) {
  if (project.status === STATUS.DRAFT || project.archivedAt) return
  const progress = computeProgress(project)
  project.progress = progress
  project.stage = progress.stage

  // A newer artifact supersedes older review notifications for this project.
  resolveNotifications(state, project.id, (n) => n.kind === 'review' && (n.gate !== progress.stage || n.artifactFp !== progress.fp), at, 'superseded')

  if (progress.kind === 'done') {
    if (project.status !== STATUS.COMPLETED) {
      project.status = STATUS.COMPLETED
      project.completedAt = at
      project.updatedAt = at
      project.waitingSince = null
      logActivity(state, project, at, `${project.title} completed — all six approvals recorded.`, 'completed')
      notify(state, {
        project, kind: 'completed', title: 'Lecture completed', body: `${project.title} passed all six gates. Deliverables are ready.`,
        deepLink: `/lectures/${project.id}?tab=deliverables`, at, dedupKey: `${project.id}:completed:${last(project.artifacts.renders)?.id}`,
      })
    }
    return
  }

  if (progress.kind === 'gate') {
    if (project.status !== STATUS.NEEDS_REVIEW || project.waitingFp !== progress.fp) {
      project.status = STATUS.NEEDS_REVIEW
      project.waitingSince = at
      project.waitingFp = progress.fp
      project.updatedAt = at
      const station = STATION_BY_ID[progress.stage]
      notify(state, {
        project, kind: 'review', gate: progress.stage, fp: progress.fp,
        title: `${progress.stage} · ${station.name} ready for review`,
        body: `${project.title} is waiting for your ${station.long.toLowerCase()}.`,
        deepLink: `/lectures/${project.id}/review/${progress.stage}?v=${encodeURIComponent(progress.fp)}`,
        at,
      })
    }
    return
  }

  // Machine stage
  project.waitingSince = null
  project.waitingFp = null
  if (project.error) {
    project.status = STATUS.BLOCKED
    return
  }
  const key = `${project.id}:${inputFingerprint(project, progress)}`
  const existing = activeJob(state, project.id)
  if (existing && existing.idempotencyKey === key) {
    project.status = progress.revision ? STATUS.REVISION_REQUESTED : STATUS.PROCESSING
    return
  }
  if (existing) {
    existing.status = 'cancelled'
    existing.finishedAt = at
  }
  startJob(state, project, progress, key, at, 1)
}

function startJob(state, project, progress, key, at, attempt) {
  const provider = stageProvider(progress.stage, progress.task)
  const id = nextId(state, 'job')
  const promptRef = ['A', 'B', 'B2', 'C', 'D'].includes(progress.stage) && progress.task !== 'pdf'
    ? resolvePromptRef(state, project, progress.stage)
    : null
  if (promptRef && !project.promptRefs[progress.stage]) project.promptRefs[progress.stage] = promptRef
  const units = progress.targets?.length || 1
  const cost = (progress.task === 'pdf' ? 0 : MOCK_COST[progress.stage] || 0) * (progress.stage === 'D' ? units : 1)
  const duration = jobDuration(state, id, progress.task)
  const job = {
    id,
    projectId: project.id,
    stage: progress.stage,
    task: progress.task,
    targets: progress.targets || null,
    status: 'running',
    attempt,
    idempotencyKey: key,
    inputVersions: {
      content: last(project.artifacts.content)?.id ?? null,
      storyboard: last(project.artifacts.storyboard)?.id ?? null,
      visuals: last(project.artifacts.visuals)?.id ?? null,
    },
    provider,
    model: modelFor(state, provider, progress.task),
    promptRef,
    estimatedCost: cost,
    queuedAt: at,
    startedAt: at,
    dueAt: duration == null ? null : at + duration,
    finishedAt: null,
    errorCode: null,
    errorMessage: null,
  }
  state.jobs.unshift(job)
  if (state.jobs.length > 400) state.jobs.length = 400
  project.status = progress.revision ? STATUS.REVISION_REQUESTED : STATUS.PROCESSING
  project.updatedAt = at
  project.currentJobId = id
  logActivity(state, project, at, `${describeJob(job)} started for ${project.title}.`, 'job')

  // Pre-flight checks happen at start: no silent fallback to another provider or model.
  const preflight = preflightError(state, job, at)
  if (preflight) failJob(state, project, job, preflight, at)
  return job
}

function preflightError(state, job, at) {
  if (job.provider === 'local') return null
  const prov = state.providers[job.provider]
  if (prov.status !== 'connected') return 'CREDENTIAL'
  const model = prov.catalog.find((m) => m.id === job.model)
  if (!model || model.unavailable) return 'MODEL'
  const b = state.budget
  if (b.enforcement === 'stop' && monthSpend(state, at) + job.estimatedCost > b.limit) return 'BUDGET'
  return null
}

export function describeJob(job) {
  if (job.task === 'pdf') return 'Paired PDF render'
  const st = STATION_BY_ID[job.stage]
  const t = job.targets && job.targets.length && ['C', 'D'].includes(job.stage) ? ` (chunks ${job.targets.join(', ')})` : ''
  return `${job.stage} · ${st.name}${t}`
}

function failJob(state, project, job, code, at) {
  job.status = 'failed'
  job.finishedAt = at
  job.errorCode = code
  job.errorMessage = FAILURE_CODES[code].label
  project.error = { code, message: FAILURE_CODES[code].label, fix: FAILURE_CODES[code].fix, stage: job.stage, jobId: job.id, at }
  project.status = STATUS.BLOCKED
  project.updatedAt = at
  logActivity(state, project, at, `${describeJob(job)} stopped: ${FAILURE_CODES[code].label}. Finished work is kept.`, 'error')
  notify(state, {
    project, kind: 'issue', title: `Action needed · ${FAILURE_CODES[code].label}`,
    body: `${project.title} paused at ${describeJob(job)}. ${FAILURE_CODES[code].fix}`,
    deepLink: `/lectures/${project.id}`, at, dedupKey: `${project.id}:issue:${job.id}`,
  })
}

// ---------------------------------------------------------------------------------------------
// Job completion — produce artifacts
// ---------------------------------------------------------------------------------------------

function completeJob(state, job, at) {
  const project = getProject(state, job.projectId)
  if (!project || project.archivedAt) {
    job.status = 'cancelled'
    job.finishedAt = at
    return
  }
  // Injected failures simulate a provider response error.
  if (state.demo.injectFailure && job.provider !== 'local') {
    const code = state.demo.injectFailure
    state.demo.injectFailure = null
    failJob(state, project, job, code, at)
    return
  }
  const a = project.artifacts
  const notes = project.revisionNotes || {}
  switch (job.task) {
    case 'content': {
      const prev = last(a.content)
      const version = (prev?.version || 0) + 1
      const md = generateContentMarkdown(project, version, { feedback: notes.A, previousMd: prev?.md })
      a.content.push({
        id: nextId(state, 'md'), version, md, createdAt: at, producer: 'ai', model: job.model, promptRef: job.promptRef,
        note: version > 1 ? `AI revision${notes.A ? ` — “${notes.A}”` : ''}` : 'Initial draft',
        pdf: { id: nextId(state, 'pdf'), status: 'ready', renderedAt: at },
      })
      delete notes.A
      break
    }
    case 'pdf': {
      const c = last(a.content)
      c.pdf = { id: nextId(state, 'pdf'), status: 'ready', renderedAt: at }
      break
    }
    case 'storyboard': {
      const prev = last(a.storyboard)
      const version = (prev?.version || 0) + 1
      const content = last(a.content)
      a.storyboard.push({
        id: nextId(state, 'sb'), version, contentId: content.id, createdAt: at, producer: 'ai', model: job.model, promptRef: job.promptRef,
        scenes: generateStoryboard(project, content, version, { feedback: notes.B?.text, targetScenes: notes.B?.scenes }),
        note: version > 1 ? `AI revision${notes.B?.text ? ` — “${notes.B.text}”` : ''}` : 'Initial storyboard',
      })
      delete notes.B
      break
    }
    case 'visuals': {
      const prev = last(a.visuals)
      const sb = last(a.storyboard)
      a.visuals.push({
        id: nextId(state, 'vis'), version: (prev?.version || 0) + 1, storyboardId: sb.id, frames: sb.scenes.length,
        createdAt: at, model: job.model, promptRef: job.promptRef, note: prev ? `Regenerated${notes.B2 ? ` — “${notes.B2}”` : ''}` : 'Initial silent visuals',
      })
      delete notes.B2
      break
    }
    case 'transcripts': {
      const content = last(a.content)
      const sb = last(a.storyboard)
      for (const id of job.targets) {
        const chunk = project.plan.chunks.find((c) => c.id === id)
        const list = (a.transcripts[id] = a.transcripts[id] || [])
        const prev = last(list)
        const version = (prev?.version || 0) + 1
        list.push({
          id: nextId(state, 'tr'), chunkId: id, version, contentId: content.id, storyboardId: sb.id, createdAt: at, producer: 'ai',
          text: generateTranscript(project, chunk, version, { feedback: notes.C }), model: job.model, promptRef: job.promptRef,
          note: prev ? `AI revision${notes.C ? ` — “${notes.C}”` : ''}` : 'Initial transcript',
        })
      }
      delete notes.C
      break
    }
    case 'voices': {
      const tr = currentTranscripts(project)
      for (const id of job.targets) {
        const chunk = project.plan.chunks.find((c) => c.id === id)
        const list = (a.audio[id] = a.audio[id] || [])
        const prev = last(list)
        const version = (prev?.version || 0) + 1
        list.push({
          id: nextId(state, 'au'), chunkId: id, version, transcriptId: tr[id].id, createdAt: at, model: job.model,
          measuredSeconds: measureAudio(project.id, chunk, version), promptRef: job.promptRef,
          note: prev ? (prev.transcriptId !== tr[id].id ? 'New transcript text' : `Regenerated${notes.D ? ` — “${notes.D}”` : ''}`) : 'Initial voice',
        })
      }
      delete notes.D
      break
    }
    case 'render': {
      const prev = last(a.renders)
      const au = currentAudio(project)
      const audioIds = project.plan.chunks.map((c) => au[c.id].id)
      const audioSeconds = Object.values(au).reduce((s, x) => s + x.measuredSeconds, 0)
      const rs = project.renderSettings
      a.renders.push({
        id: nextId(state, 'mp4'), version: (prev?.version || 0) + 1, visualsId: last(a.visuals).id, audioIds,
        settingsRev: rs.rev, gapSeconds: rs.gapSeconds, fadeSeconds: rs.fadeSeconds, createdAt: at,
        durationSeconds: Math.round(audioSeconds + rs.gapSeconds * (audioIds.length - 1) + rs.fadeSeconds * 2),
        note: prev ? 'Re-render' : 'First render',
      })
      break
    }
    default:
      break
  }
  job.status = 'done'
  job.finishedAt = at
  project.updatedAt = at
  if (job.estimatedCost > 0) {
    state.usage.unshift({
      id: nextId(state, 'use'), projectId: project.id, jobId: job.id, provider: job.provider, model: job.model, stage: job.stage,
      tokenCounts: job.provider === 'google' && job.stage === 'D' ? null : { input: 4200 + (job.targets?.length || 1) * 900, output: 2600 },
      audioDuration: job.stage === 'D' ? job.targets.length * 80 : null,
      currency: 'USD', estimatedCost: job.estimatedCost, actualCost: null, timestamp: at,
    })
  }
  // Successful retry resolves the open issue.
  resolveNotifications(state, project.id, (n) => n.kind === 'issue', at, 'resolved')
  logActivity(state, project, at, `${describeJob(job)} finished for ${project.title}.`, 'job')
}

/**
 * Advance simulated time. Completes due jobs in chronological order so that work which
 * finished while the browser was closed is reconciled with correct timestamps.
 */
export function tick(input, now) {
  const state = clone(input)
  let guard = 0
  for (;;) {
    const due = state.jobs
      .filter((j) => j.status === 'running' && j.dueAt != null && j.dueAt <= now)
      .sort((x, y) => x.dueAt - y.dueAt)[0]
    if (!due || guard++ > 500) break
    completeJob(state, due, due.dueAt)
    const project = getProject(state, due.projectId)
    if (project) advance(state, project, due.dueAt)
  }
  for (const p of state.projects) {
    if (p.status === STATUS.DRAFT || p.archivedAt) continue
    if (!activeJob(state, p.id)) advance(state, p, now)
  }
  return state
}

export function hasDueJobs(state, now) {
  return state.jobs.some((j) => j.status === 'running' && j.dueAt != null && j.dueAt <= now)
}

/** Demo control: make every running job due now ("Finish running jobs"). */
export function finishRunningJobs(input, now) {
  const state = clone(input)
  for (const j of state.jobs) if (j.status === 'running') j.dueAt = now
  return tick(state, now)
}

/** Run the simulation until no machine work remains (used by seeding and tests). */
export function settle(input, now, maxRounds = 30) {
  let state = input
  for (let i = 0; i < maxRounds; i++) {
    if (!state.jobs.some((j) => j.status === 'running')) break
    state = finishRunningJobs(state, now)
  }
  return state
}

// ---------------------------------------------------------------------------------------------
// Project lifecycle
// ---------------------------------------------------------------------------------------------

export function validateIntake(input) {
  const errors = {}
  if (!input.title?.trim()) errors.title = 'Enter a lecture name.'
  else if (input.title.trim().length < 4) errors.title = 'Use at least 4 characters so you can find it later.'
  if (!input.source) errors.source = 'Choose a demo source, attach a file or paste notes.'
  else if (input.source.origin === 'notes' && (input.source.notes || '').trim().length < 20) errors.source = 'Paste at least a few sentences of notes (20+ characters).'
  if (!input.promptId) errors.promptId = 'Choose a lecture content prompt.'
  const p = input.prefs || {}
  if (!p.audience) errors.audience = 'Choose an audience.'
  if (!p.language) errors.language = 'Choose a language.'
  if (!p.pdfStyle) errors.pdfStyle = 'Choose a PDF style.'
  if (p.pdfStyle === 'Other' && !(p.pdfStyleOther || '').trim()) errors.pdfStyleOther = 'Describe the PDF style.'
  if (!p.durationMin || p.durationMin < 1 || p.durationMin > 30) errors.durationMin = 'Duration must be between 1 and 30 minutes.'
  if (!p.speakerMode) errors.speakerMode = 'Choose the number of speakers.'
  if (!(p.voiceDirection || '').trim()) errors.voiceDirection = 'Add a short voice direction (for example “calm, warm, clinic pace”).'
  return errors
}

export function createProject(input, data, now) {
  const errors = validateIntake(data)
  if (Object.keys(errors).length) return { state: input, result: { ok: false, errors } }
  const state = clone(input)
  const dupe = state.projects.find((p) => !p.archivedAt && p.clientRequestId && p.clientRequestId === data.clientRequestId)
  if (dupe) return { state: input, result: { ok: true, projectId: dupe.id, duplicate: true } }
  const id = nextId(state, 'lec')
  const prefs = { ...data.prefs }
  const project = {
    id,
    clientRequestId: data.clientRequestId || null,
    title: data.title.trim(),
    source: { ...data.source, id: data.source.id || nextId(state, 'src'), contentHash: hash([data.source.name, data.source.size, data.source.notes]) },
    prefs,
    plan: planChunks(prefs.durationMin * 60, prefs.timingPolicy),
    status: data.start ? STATUS.QUEUED : STATUS.DRAFT,
    stage: data.start ? 'A' : null,
    progress: null,
    createdAt: now,
    updatedAt: now,
    startedAt: data.start ? now : null,
    completedAt: null,
    archivedAt: null,
    waitingSince: null,
    waitingFp: null,
    promptRefs: { A: promptSnapshot(state, data.promptId), B: null, B2: null, C: null, D: null },
    skillRefs: null,
    providerSnapshot: {
      content: state.providers.google.models.content,
      creative: state.providers.anthropic.models.creative,
      tts: state.providers.google.models.tts,
    },
    renderSettings: { gapSeconds: 0.5, fadeSeconds: 1, rev: 1 },
    artifacts: { content: [], storyboard: [], visuals: [], transcripts: {}, audio: {}, renders: [] },
    approvals: {},
    rejectedKeys: [],
    revisionNotes: {},
    error: null,
    currentJobId: null,
    duplicatedFrom: data.duplicatedFrom || null,
  }
  state.projects.unshift(project)
  bumpPromptUse(state, project.promptRefs.A)
  logActivity(state, project, now, data.start ? `Started ${project.title}.` : `Saved ${project.title} as a draft.`, 'created')
  if (data.start) advance(state, project, now)
  return { state, result: { ok: true, projectId: id } }
}

function bumpPromptUse(state, ref) {
  const p = ref && state.prompts.find((x) => x.id === ref.promptId)
  if (p) p.useCount = (p.useCount || 0) + 1
}

export function updateDraft(input, projectId, data, now) {
  const p0 = getProject(input, projectId)
  if (!p0 || p0.status !== STATUS.DRAFT) return { state: input, result: { ok: false, errors: { form: 'Only drafts can be edited.' } } }
  const errors = validateIntake(data)
  if (Object.keys(errors).length) return { state: input, result: { ok: false, errors } }
  const state = clone(input)
  const p = getProject(state, projectId)
  p.title = data.title.trim()
  p.source = { ...data.source, id: data.source.id || p.source.id, contentHash: hash([data.source.name, data.source.size, data.source.notes]) }
  p.prefs = { ...data.prefs }
  p.plan = planChunks(p.prefs.durationMin * 60, p.prefs.timingPolicy)
  if (p.promptRefs.A?.promptId !== data.promptId || p.promptRefs.A?.versionId !== promptSnapshot(state, data.promptId)?.versionId) {
    p.promptRefs.A = promptSnapshot(state, data.promptId)
    bumpPromptUse(state, p.promptRefs.A)
  }
  p.updatedAt = now
  if (data.start) {
    p.status = STATUS.QUEUED
    p.startedAt = now
    logActivity(state, p, now, `Started ${p.title} from draft.`, 'created')
    advance(state, p, now)
  } else {
    logActivity(state, p, now, `Updated draft ${p.title}.`, 'info')
  }
  return { state, result: { ok: true, projectId } }
}

export function startDraft(input, projectId, now) {
  const state = clone(input)
  const p = getProject(state, projectId)
  if (!p || p.status !== STATUS.DRAFT) return { state: input, result: { ok: false, error: 'This lecture is not a draft.' } }
  p.status = STATUS.QUEUED
  p.startedAt = now
  p.updatedAt = now
  logActivity(state, p, now, `Started ${p.title} from draft.`, 'created')
  advance(state, p, now)
  return { state, result: { ok: true } }
}

export function archiveProject(input, projectId, now) {
  const state = clone(input)
  const p = getProject(state, projectId)
  if (!p) return { state: input, result: { ok: false, error: 'Lecture not found.' } }
  p.archivedAt = now
  p.statusBeforeArchive = p.status
  p.status = STATUS.ARCHIVED
  p.updatedAt = now
  for (const j of state.jobs) if (j.projectId === p.id && j.status === 'running') { j.status = 'cancelled'; j.finishedAt = now }
  resolveNotifications(state, p.id, () => true, now, 'archived')
  logActivity(state, p, now, `Archived ${p.title}. Files and history are kept.`, 'info')
  return { state, result: { ok: true } }
}

export function restoreProject(input, projectId, now) {
  const state = clone(input)
  const p = getProject(state, projectId)
  if (!p || !p.archivedAt) return { state: input, result: { ok: false, error: 'Lecture is not archived.' } }
  p.archivedAt = null
  p.status = p.statusBeforeArchive === STATUS.DRAFT ? STATUS.DRAFT : STATUS.QUEUED
  p.waitingFp = null
  p.updatedAt = now
  logActivity(state, p, now, `Restored ${p.title}.`, 'info')
  advance(state, p, now)
  return { state, result: { ok: true } }
}

export function duplicateProject(input, projectId, now) {
  const src = getProject(input, projectId)
  if (!src) return { state: input, result: { ok: false, error: 'Lecture not found.' } }
  const ref = src.promptRefs.A
  const prompt = input.prompts.find((p) => p.id === ref?.promptId && !p.archivedAt)
  return createProject(input, {
    title: `${src.title} (copy)`,
    source: { ...src.source, id: undefined },
    promptId: prompt?.id || compatiblePrompts(input, 'A')[0]?.id,
    prefs: src.prefs,
    start: false,
    duplicatedFrom: src.id,
  }, now)
}

export function retryProject(input, projectId, now) {
  const state = clone(input)
  const p = getProject(state, projectId)
  if (!p || !p.error) return { state: input, result: { ok: false, error: 'Nothing to retry.' } }
  const failed = state.jobs.find((j) => j.id === p.error.jobId)
  const attempt = (failed?.attempt || 1) + 1
  p.error = null
  const progress = computeProgress(p)
  p.progress = progress
  const key = `${p.id}:${inputFingerprint(p, progress)}`
  logActivity(state, p, now, `Retry requested for ${p.title} (attempt ${attempt}).`, 'job')
  if (progress.kind === 'machine') startJob(state, p, progress, key, now, attempt)
  else advance(state, p, now)
  return { state, result: { ok: !p.error, error: p.error?.message } }
}

// ---------------------------------------------------------------------------------------------
// Human decisions
// ---------------------------------------------------------------------------------------------

export const MIN_FEEDBACK = 10

function fail(input, code, message) {
  return { state: input, result: { ok: false, code, error: message } }
}

/**
 * Record a human decision. Fails safely on stale stage/version, rejected versions and missing
 * confirmations. Only explicit calls from the review UI reach this function.
 */
export function decide(input, payload, now) {
  const { projectId, gate, fp, decision } = payload
  const p0 = getProject(input, projectId)
  if (!p0) return fail(input, 'NOT_FOUND', 'Lecture not found.')
  if (p0.archivedAt) return fail(input, 'ARCHIVED', 'This lecture is archived.')
  const progress = computeProgress(p0)
  if (progress.kind !== 'gate' || progress.stage !== gate) {
    return fail(input, 'STALE_STAGE', `This lecture is no longer waiting for ${gate}. Nothing was recorded — open the current review instead.`)
  }
  if (fp !== progress.fp) {
    return fail(input, 'STALE_VERSION', 'A newer version was produced after you opened this review. Nothing was recorded — review the current version.')
  }
  if (!['APPROVE', 'REJECT'].includes(decision)) return fail(input, 'BAD_DECISION', 'Choose approve or request changes.')
  if (decision === 'APPROVE' && p0.rejectedKeys.includes(fp)) {
    return fail(input, 'REJECTED_VERSION', 'You already requested changes for this exact version, so it cannot be approved.')
  }

  const note = (payload.note || '').trim()
  const ids = [...new Set(payload.affectedIds || [])]
  const chunkIds = p0.plan.chunks.map((c) => c.id)

  if (decision === 'REJECT' && note.length < MIN_FEEDBACK) {
    return fail(input, 'NOTE_REQUIRED', `Explain what must change (at least ${MIN_FEEDBACK} characters) so the revision can address it.`)
  }

  const state = clone(input)
  const p = getProject(state, projectId)
  const a = p.artifacts
  const record = {
    id: nextId(state, 'dec'), projectId, gate, decision, note, affectedIds: [], route: null,
    artifactFingerprint: fp, reviewer: REVIEWER.name, reviewerRole: REVIEWER.role, createdAt: now,
    artifactVersions: artifactVersionSummary(p, gate), extra: {},
  }

  if (decision === 'APPROVE') {
    if (gate === 'H1' && !payload.confirm) return fail(input, 'CONFIRM_REQUIRED', 'Confirm that you personally reviewed the medical content of this revision.')
    if (gate === 'H2') {
      const sel = payload.skills || {}
      if (!sel.none && !(sel.ids || []).length) return fail(input, 'SKILLS_REQUIRED', 'Select at least one Skill, or choose “No Skills (NONE)”.')
      const chosen = sel.none ? [] : state.skills.filter((s) => sel.ids.includes(s.id))
      const unverified = chosen.filter((s) => s.status !== 'api_ready')
      if (unverified.length && !payload.acceptUnverified) {
        return fail(input, 'UNVERIFIED_SKILL', 'Some selected Skills are not verified for API use. Acknowledge this or choose different Skills.')
      }
      p.skillRefs = sel.none ? [] : chosen.map((s) => ({ id: s.id, title: s.title, status: s.status, providerSkillId: s.providerSkillId, version: s.providerSkillVersion }))
      record.extra.skills = sel.none ? ['NONE'] : chosen.map((s) => `${s.title}${s.status === 'api_ready' ? '' : ' (unverified)'}`)
    }
    if (gate === 'H5') {
      const ex = timingExceptions(p)
      if (ex.length && !payload.acceptTiming) {
        return fail(input, 'TIMING_ACK_REQUIRED', `Chunks ${ex.map((e) => e.chunkId).join(', ')} are outside 60–90 s. Acknowledge the exception or request regeneration.`)
      }
      record.extra.timingExceptionsAccepted = ex.map((e) => `${e.chunkId}: ${e.seconds}s`)
    }
    if (gate === 'H6' && !payload.watched) return fail(input, 'WATCH_REQUIRED', 'Confirm that you watched the complete final video with sound.')
    // Optional next-stage prompt selections (stage-filtered in the UI; validated here).
    for (const [stage, promptId] of Object.entries(payload.nextPrompts || {})) {
      if (!promptId || !PROMPT_STAGE_IDS.includes(stage)) continue
      if (!compatiblePrompts(state, stage).some((x) => x.id === promptId)) {
        return fail(input, 'PROMPT_INCOMPATIBLE', `The selected prompt is not mapped to stage ${stage}.`)
      }
      const snap = promptSnapshot(state, promptId)
      if (p.promptRefs[stage]?.versionId !== snap.versionId) bumpPromptUse(state, snap)
      p.promptRefs[stage] = snap
      record.extra.prompts = { ...(record.extra.prompts || {}), [stage]: `${snap.title} v${snap.version}` }
    }
    p.approvals[gate] = { fp, decisionId: record.id, at: now }
  } else {
    switch (gate) {
      case 'H1': {
        const c = last(a.content)
        p.rejectedKeys.push(fp, c.id)
        p.revisionNotes.A = note
        break
      }
      case 'H2':
        // Rejecting H2 re-presents H2 (baseline). Recorded, nothing regenerated.
        break
      case 'H3': {
        const sb = last(a.storyboard)
        const scenes = ids.filter((x) => sb.scenes.some((s) => s.id === x))
        p.rejectedKeys.push(fp, sb.id)
        p.revisionNotes.B = { text: note, scenes }
        record.affectedIds = scenes
        break
      }
      case 'H4': {
        if (!ids.length) return fail(input, 'IDS_REQUIRED', 'Select the transcript chunks that need revision (or all).')
        const targets = ids.includes('ALL') ? chunkIds : ids
        const unknown = targets.filter((x) => !chunkIds.includes(x))
        if (unknown.length) return fail(input, 'UNKNOWN_IDS', `Unknown chunk IDs: ${unknown.join(', ')}.`)
        const tr = currentTranscripts(p)
        p.rejectedKeys.push(fp, ...targets.map((x) => tr[x].id))
        p.revisionNotes.C = note
        record.affectedIds = targets
        break
      }
      case 'H5': {
        if (!ids.length || ids.includes('ALL')) return fail(input, 'IDS_REQUIRED', 'Select the specific audio chunks to regenerate. Audio review never restarts everything.')
        const unknown = ids.filter((x) => !chunkIds.includes(x))
        if (unknown.length) return fail(input, 'UNKNOWN_IDS', `Unknown audio IDs: ${unknown.join(', ')}.`)
        const au = currentAudio(p)
        p.rejectedKeys.push(fp, ...ids.map((x) => au[x].id))
        p.revisionNotes.D = note
        record.affectedIds = ids
        break
      }
      case 'H6': {
        const route = H6_ROUTES.find((r) => r.id === payload.route)
        if (!route) return fail(input, 'ROUTE_REQUIRED', 'Choose where the correction belongs.')
        const render = last(a.renders)
        record.route = route.id
        if (route.needsIds) {
          if (!ids.length) return fail(input, 'IDS_REQUIRED', `Route ${route.label} needs the specific chunk IDs to redo.`)
          const unknown = ids.filter((x) => !chunkIds.includes(x))
          if (unknown.length) return fail(input, 'UNKNOWN_IDS', `Unknown chunk IDs: ${unknown.join(', ')}.`)
          record.affectedIds = ids
        }
        if (route.id === 'RENDER_ONLY') {
          const rs = payload.renderSettings || {}
          const cur = p.renderSettings
          if (rs.gapSeconds === cur.gapSeconds && rs.fadeSeconds === cur.fadeSeconds) {
            return fail(input, 'SETTINGS_UNCHANGED', 'Change at least one render setting — an identical re-render would be rejected again.')
          }
          p.renderSettings = { gapSeconds: rs.gapSeconds, fadeSeconds: rs.fadeSeconds, rev: cur.rev + 1 }
          record.extra.renderSettings = `gap ${rs.gapSeconds}s, fade ${rs.fadeSeconds}s`
        }
        p.rejectedKeys.push(fp, render.id)
        if (route.id === 'VISUALS') { p.rejectedKeys.push(last(a.visuals).id); p.revisionNotes.B2 = note }
        if (route.id === 'AUDIO') { const au = currentAudio(p); p.rejectedKeys.push(...ids.map((x) => au[x].id)); p.revisionNotes.D = note }
        if (route.id === 'TRANSCRIPT') { const tr = currentTranscripts(p); p.rejectedKeys.push(...ids.map((x) => tr[x].id)); p.revisionNotes.C = note }
        if (route.id === 'CONTENT') { const c = last(a.content); p.rejectedKeys.push(c.id); p.revisionNotes.A = note }
        break
      }
      default:
        break
    }
  }

  state.decisions.unshift(record)
  resolveNotifications(state, p.id, (n) => n.kind === 'review' && n.gate === gate && n.artifactFp === fp, now, decision === 'APPROVE' ? 'approved' : 'changes requested')
  p.updatedAt = now
  p.waitingFp = null
  const verb = decision === 'APPROVE' ? 'approved' : 'requested changes at'
  logActivity(state, p, now, `You ${verb} ${gate} · ${STATION_BY_ID[gate].name} for ${p.title}.`, decision === 'APPROVE' ? 'approved' : 'rejected')
  advance(state, p, now)
  return { state, result: { ok: true, decisionId: record.id, next: p.progress } }
}

export function timingExceptions(project) {
  const au = currentAudio(project)
  const out = []
  project.plan.chunks.forEach((c, i) => {
    const x = au[c.id]
    if (!x) return
    const s = x.measuredSeconds
    const declaredShort = project.prefs.timingPolicy === 'FINAL_SHORT' && i === project.plan.chunks.length - 1 && s < CHUNK_MIN_S
    if ((s < CHUNK_MIN_S || s > CHUNK_MAX_S) && !declaredShort) out.push({ chunkId: c.id, seconds: s })
  })
  return out
}

function artifactVersionSummary(p, gate) {
  const a = p.artifacts
  const c = last(a.content)
  const v = { content: c ? `r${c.version}` : null }
  if (['H3', 'H4', 'H5', 'H6'].includes(gate)) v.storyboard = last(a.storyboard) ? `v${last(a.storyboard).version}` : null
  if (['H4', 'H5', 'H6'].includes(gate)) v.transcripts = Object.fromEntries(Object.entries(a.transcripts).map(([k, l]) => [k, `v${last(l).version}`]))
  if (['H5', 'H6'].includes(gate)) v.audio = Object.fromEntries(Object.entries(a.audio).map(([k, l]) => [k, `v${last(l).version}`]))
  if (gate === 'H6') v.render = last(a.renders) ? `v${last(a.renders).version}` : null
  return v
}

// ---------------------------------------------------------------------------------------------
// Direct edits — always create a new version; never mutate an approved artifact.
// ---------------------------------------------------------------------------------------------

function requireGate(p, gate, fp) {
  const progress = computeProgress(p)
  if (progress.kind !== 'gate' || progress.stage !== gate) return `Direct edits are available while the lecture waits for ${gate}.`
  if (fp && fp !== progress.fp) return 'A newer version exists. Reload the review before editing.'
  return null
}

export function editContent(input, { projectId, fp, md, note }, now) {
  const p0 = getProject(input, projectId)
  const err = p0 ? requireGate(p0, 'H1', fp) : 'Lecture not found.'
  if (err) return fail(input, 'EDIT_NOT_ALLOWED', err)
  const prev = last(p0.artifacts.content)
  if ((md || '').trim() === prev.md.trim()) return fail(input, 'NO_CHANGE', 'No changes to save.')
  if ((md || '').trim().length < 40) return fail(input, 'TOO_SHORT', 'The canonical text looks empty. Undo your changes or add the content back.')
  const state = clone(input)
  const p = getProject(state, projectId)
  p.artifacts.content.push({
    id: nextId(state, 'md'), version: prev.version + 1, md, createdAt: now, producer: 'doctor',
    note: note?.trim() ? `Doctor edit — ${note.trim()}` : 'Doctor edit',
    pdf: { id: null, status: 'rendering', renderedAt: null },
  })
  logActivity(state, p, now, `You saved canonical text r${prev.version + 1} for ${p.title}. The paired PDF is being re-rendered.`, 'edit')
  advance(state, p, now)
  return { state, result: { ok: true } }
}

export function editStoryboard(input, { projectId, fp, scenes, note }, now) {
  const p0 = getProject(input, projectId)
  const err = p0 ? requireGate(p0, 'H3', fp) : 'Lecture not found.'
  if (err) return fail(input, 'EDIT_NOT_ALLOWED', err)
  const prev = last(p0.artifacts.storyboard)
  const changed = scenes.filter((s) => {
    const o = prev.scenes.find((x) => x.id === s.id)
    return o && (o.onScreen !== s.onScreen || o.visual !== s.visual || o.notes !== s.notes)
  })
  if (!changed.length) return fail(input, 'NO_CHANGE', 'No changes to save.')
  const state = clone(input)
  const p = getProject(state, projectId)
  p.artifacts.storyboard.push({
    ...clone(prev),
    id: nextId(state, 'sb'), version: prev.version + 1, createdAt: now, producer: 'doctor',
    scenes: prev.scenes.map((o) => {
      const s = scenes.find((x) => x.id === o.id)
      return s && changed.includes(s) ? { ...o, onScreen: s.onScreen, visual: s.visual, notes: s.notes, editedInVersion: prev.version + 1 } : o
    }),
    note: `Doctor edit — scenes ${changed.map((s) => s.id).join(', ')}${note?.trim() ? ` — ${note.trim()}` : ''}`,
  })
  logActivity(state, p, now, `You saved storyboard v${prev.version + 1} for ${p.title}.`, 'edit')
  advance(state, p, now)
  return { state, result: { ok: true } }
}

export function editTranscript(input, { projectId, fp, chunkId, text, note }, now) {
  const p0 = getProject(input, projectId)
  const err = p0 ? requireGate(p0, 'H4', fp) : 'Lecture not found.'
  if (err) return fail(input, 'EDIT_NOT_ALLOWED', err)
  const prev = last(p0.artifacts.transcripts[chunkId] || [])
  if (!prev) return fail(input, 'NOT_FOUND', 'Chunk not found.')
  if ((text || '').trim() === prev.text.trim()) return fail(input, 'NO_CHANGE', 'No changes to save.')
  if ((text || '').trim().length < 20) return fail(input, 'TOO_SHORT', 'The transcript looks empty.')
  const state = clone(input)
  const p = getProject(state, projectId)
  p.artifacts.transcripts[chunkId].push({
    ...prev, id: nextId(state, 'tr'), version: prev.version + 1, text: text.trim(), createdAt: now, producer: 'doctor',
    note: `Doctor edit${note?.trim() ? ` — ${note.trim()}` : ''}`,
  })
  logActivity(state, p, now, `You saved transcript ${chunkId} v${prev.version + 1} for ${p.title}.`, 'edit')
  advance(state, p, now)
  return { state, result: { ok: true } }
}

// ---------------------------------------------------------------------------------------------
// Selectors used by the UI
// ---------------------------------------------------------------------------------------------

export function pendingReviews(state) {
  return state.projects
    .filter((p) => !p.archivedAt && p.status === STATUS.NEEDS_REVIEW)
    .map((p) => ({ project: p, gate: p.progress.stage, fp: p.progress.fp, since: p.waitingSince }))
    .sort((x, y) => x.since - y.since)
}

export function dashboardCounts(state) {
  const live = state.projects.filter((p) => !p.archivedAt)
  return {
    review: live.filter((p) => p.status === STATUS.NEEDS_REVIEW).length,
    processing: live.filter((p) => [STATUS.PROCESSING, STATUS.QUEUED, STATUS.REVISION_REQUESTED].includes(p.status)).length,
    blocked: live.filter((p) => p.status === STATUS.BLOCKED).length,
    completed: live.filter((p) => p.status === STATUS.COMPLETED).length,
    drafts: live.filter((p) => p.status === STATUS.DRAFT).length,
  }
}

export { currentTranscripts, currentAudio, isArabic }
