// Master prompts, categories, Claude Skills references and settings — pure state operations.
import { PROMPT_STAGE_IDS } from './constants.js'
import { clone, hash, nextId } from './util.js'

function fail(input, error) {
  return { state: input, result: { ok: false, error } }
}
function ok(state, extra = {}) {
  return { state, result: { ok: true, ...extra } }
}

// ------------------------------------------------------------------ categories

function categoryNameTaken(state, name, exceptId) {
  const n = name.trim().toLowerCase()
  return state.categories.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === n)
}

export function createCategory(input, { name, description = '', stageIds = [] }, now) {
  if (!name?.trim()) return fail(input, 'Enter a category name.')
  if (categoryNameTaken(input, name)) return fail(input, 'A category with this name already exists.')
  if (stageIds.some((s) => !PROMPT_STAGE_IDS.includes(s))) return fail(input, 'Categories can only map to existing workflow stages.')
  const state = clone(input)
  const id = nextId(state, 'cat')
  state.categories.push({ id, name: name.trim(), description: description.trim(), stageIds: [...stageIds], createdAt: now, updatedAt: now, archivedAt: null, seeded: false })
  return ok(state, { id })
}

export function updateCategory(input, id, { name, description, stageIds }, now) {
  const cat = input.categories.find((c) => c.id === id)
  if (!cat) return fail(input, 'Category not found.')
  if (name !== undefined && !name.trim()) return fail(input, 'Enter a category name.')
  if (name !== undefined && categoryNameTaken(input, name, id)) return fail(input, 'A category with this name already exists.')
  if (stageIds && stageIds.some((s) => !PROMPT_STAGE_IDS.includes(s))) return fail(input, 'Categories can only map to existing workflow stages.')
  const state = clone(input)
  const c = state.categories.find((x) => x.id === id)
  if (name !== undefined) c.name = name.trim()
  if (description !== undefined) c.description = description.trim()
  if (stageIds) c.stageIds = [...stageIds]
  c.updatedAt = now
  return ok(state)
}

/** Archive a category. Active prompts can be safely reassigned; historical snapshots never change. */
export function archiveCategory(input, id, { reassignTo } = {}, now) {
  const cat = input.categories.find((c) => c.id === id)
  if (!cat) return fail(input, 'Category not found.')
  if (reassignTo) {
    const target = input.categories.find((c) => c.id === reassignTo && !c.archivedAt)
    if (!target || target.id === id) return fail(input, 'Choose an active category to move prompts to.')
  }
  const state = clone(input)
  const c = state.categories.find((x) => x.id === id)
  c.archivedAt = now
  c.updatedAt = now
  let moved = 0
  if (reassignTo) {
    for (const p of state.prompts) {
      if (p.categoryId === id && !p.archivedAt) { p.categoryId = reassignTo; p.updatedAt = now; moved++ }
    }
  }
  return ok(state, { moved })
}

export function restoreCategory(input, id, now) {
  const state = clone(input)
  const c = state.categories.find((x) => x.id === id)
  if (!c) return fail(input, 'Category not found.')
  if (categoryNameTaken(state, c.name, id)) return fail(input, 'Rename the other category with the same name first.')
  c.archivedAt = null
  c.updatedAt = now
  return ok(state)
}

export function categoryReferences(state, id) {
  const prompts = state.prompts.filter((p) => p.categoryId === id).length
  const versions = state.promptVersions.filter((v) => v.categorySnapshot?.id === id).length
  const projects = state.projects.filter((p) => Object.values(p.promptRefs || {}).some((r) => r?.categoryId === id)).length
  return { prompts, versions, projects, total: prompts + versions + projects }
}

export function deleteCategory(input, id) {
  const refs = categoryReferences(input, id)
  if (refs.total > 0) return fail(input, 'This category is referenced by prompts or lecture history. Archive it instead.')
  const state = clone(input)
  state.categories = state.categories.filter((c) => c.id !== id)
  return ok(state)
}

// ------------------------------------------------------------------ prompts

function validatePrompt(state, { title, categoryId, body }) {
  if (!title?.trim()) return 'Enter a prompt title.'
  if (!categoryId) return 'Choose a category.'
  const cat = state.categories.find((c) => c.id === categoryId)
  if (!cat || cat.archivedAt) return 'Choose an active category.'
  if (!body?.trim() || body.trim().length < 20) return 'The prompt body needs at least 20 characters.'
  return null
}

function addVersion(state, prompt, { title, body }, now, note) {
  const cat = state.categories.find((c) => c.id === prompt.categoryId)
  const prev = state.promptVersions.filter((v) => v.promptId === prompt.id).length
  const v = {
    id: nextId(state, 'pv'), promptId: prompt.id, version: prev + 1, title: title.trim(), body: body.trim(), createdAt: now,
    contentHash: hash(body.trim()), note: note || (prev ? 'Edited' : 'Created'),
    categorySnapshot: cat ? { id: cat.id, name: cat.name, stageIds: [...cat.stageIds] } : null,
  }
  state.promptVersions.push(v)
  prompt.activeVersionId = v.id
  return v
}

export function createPrompt(input, data, now) {
  const err = validatePrompt(input, data)
  if (err) return fail(input, err)
  const state = clone(input)
  const id = nextId(state, 'pr')
  const prompt = {
    id, title: data.title.trim(), categoryId: data.categoryId, description: (data.description || '').trim(),
    tags: normaliseTags(data.tags), activeVersionId: null, createdAt: now, updatedAt: now, archivedAt: null, useCount: 0,
  }
  state.prompts.push(prompt)
  addVersion(state, prompt, data, now, data.note)
  return ok(state, { id })
}

/** Editing title, category or body creates a new immutable version. Description/tags are metadata. */
export function editPrompt(input, id, data, now) {
  const prompt = input.prompts.find((p) => p.id === id)
  if (!prompt) return fail(input, 'Prompt not found.')
  const err = validatePrompt(input, data)
  if (err) return fail(input, err)
  const state = clone(input)
  const p = state.prompts.find((x) => x.id === id)
  const active = state.promptVersions.find((v) => v.id === p.activeVersionId)
  const material = data.title.trim() !== active.title || data.body.trim() !== active.body || data.categoryId !== p.categoryId
  p.title = data.title.trim()
  p.categoryId = data.categoryId
  p.description = (data.description || '').trim()
  p.tags = normaliseTags(data.tags)
  p.updatedAt = now
  let version = null
  if (material) version = addVersion(state, p, data, now, data.note)
  return ok(state, { newVersion: version?.version ?? null })
}

export function duplicatePrompt(input, id, now) {
  const prompt = input.prompts.find((p) => p.id === id)
  if (!prompt) return fail(input, 'Prompt not found.')
  const active = input.promptVersions.find((v) => v.id === prompt.activeVersionId)
  const cat = input.categories.find((c) => c.id === prompt.categoryId)
  const categoryId = cat && !cat.archivedAt ? cat.id : input.categories.find((c) => !c.archivedAt)?.id
  return createPrompt(input, {
    title: `${prompt.title} (copy)`, categoryId, description: prompt.description, tags: prompt.tags, body: active.body,
    note: `Duplicated from “${prompt.title}” v${active.version}`,
  }, now)
}

export function archivePrompt(input, id, now) {
  const state = clone(input)
  const p = state.prompts.find((x) => x.id === id)
  if (!p) return fail(input, 'Prompt not found.')
  p.archivedAt = now
  p.updatedAt = now
  for (const [stage, pid] of Object.entries(state.profile.stageDefaults)) if (pid === id) state.profile.stageDefaults[stage] = null
  return ok(state)
}

export function restorePrompt(input, id, now) {
  const state = clone(input)
  const p = state.prompts.find((x) => x.id === id)
  if (!p) return fail(input, 'Prompt not found.')
  const cat = state.categories.find((c) => c.id === p.categoryId)
  if (!cat || cat.archivedAt) return fail(input, 'Its category is archived. Restore the category or edit the prompt into an active category first.')
  p.archivedAt = null
  p.updatedAt = now
  return ok(state)
}

export function promptUsage(state, id) {
  const versionIds = new Set(state.promptVersions.filter((v) => v.promptId === id).map((v) => v.id))
  const projects = state.projects.filter((p) => Object.values(p.promptRefs || {}).some((r) => r && versionIds.has(r.versionId)))
  const jobs = state.jobs.filter((j) => j.promptRef && versionIds.has(j.promptRef.versionId))
  return { projects, jobs: jobs.length, used: projects.length > 0 || jobs.length > 0 }
}

export function deletePrompt(input, id) {
  if (promptUsage(input, id).used) return fail(input, 'This prompt has been used by a lecture. Archive it instead so history stays reproducible.')
  const state = clone(input)
  state.prompts = state.prompts.filter((p) => p.id !== id)
  state.promptVersions = state.promptVersions.filter((v) => v.promptId !== id)
  for (const [stage, pid] of Object.entries(state.profile.stageDefaults)) if (pid === id) state.profile.stageDefaults[stage] = null
  return ok(state)
}

export function setStageDefault(input, stage, promptId) {
  if (!PROMPT_STAGE_IDS.includes(stage)) return fail(input, 'Unknown stage.')
  const state = clone(input)
  state.profile.stageDefaults[stage] = promptId || null
  return ok(state)
}

function normaliseTags(tags) {
  const arr = Array.isArray(tags) ? tags : String(tags || '').split(',')
  return [...new Set(arr.map((t) => t.trim()).filter(Boolean))].slice(0, 8)
}

// ------------------------------------------------------------------ skills

export const SKILL_STATUS = {
  web_reference: { label: 'Web reference only', tone: 'draft', help: 'Named in Claude on the web. Not proof that an API-executable Skill exists.' },
  unverified: { label: 'Unverified', tone: 'review', help: 'Imported record exists but has not passed a (simulated) verification.' },
  api_ready: { label: 'API ready (simulated)', tone: 'completed', help: 'Passed a simulated verification. Real API availability is untested in the prototype.' },
}

export function createSkill(input, { title, description = '', origin = 'web', dependencies = '' }, now) {
  if (!title?.trim()) return fail(input, 'Enter the Skill name exactly as it appears in Claude.')
  if (input.skills.some((s) => !s.archivedAt && s.title.toLowerCase() === title.trim().toLowerCase())) return fail(input, 'A Skill with this name already exists.')
  const state = clone(input)
  const id = nextId(state, 'sk')
  state.skills.push({
    id, title: title.trim(), description: description.trim(), origin, provider: 'anthropic',
    providerSkillId: null, providerSkillVersion: null, status: 'web_reference', verifiedAt: null, archivedAt: null,
    dependencies: dependencies.trim(), createdAt: now, updatedAt: now,
  })
  return ok(state, { id })
}

export function updateSkill(input, id, { title, description, dependencies }, now) {
  const state = clone(input)
  const s = state.skills.find((x) => x.id === id)
  if (!s) return fail(input, 'Skill not found.')
  if (title !== undefined) {
    if (!title.trim()) return fail(input, 'Enter a label.')
    s.title = title.trim()
  }
  if (description !== undefined) s.description = description.trim()
  if (dependencies !== undefined) s.dependencies = dependencies.trim()
  s.updatedAt = now
  return ok(state)
}

/** Simulated import of a permitted Skill bundle via API. Produces an unverified record. */
export function mockImportSkill(input, id, now) {
  const state = clone(input)
  const s = state.skills.find((x) => x.id === id)
  if (!s) return fail(input, 'Skill not found.')
  s.origin = 'api'
  s.providerSkillId = s.providerSkillId || `skill_demo_${hash(s.title).slice(0, 6)}`
  s.providerSkillVersion = String((Number(s.providerSkillVersion) || 0) + 1)
  s.status = 'unverified'
  s.updatedAt = now
  return ok(state)
}

export function verifySkill(input, id, now) {
  const s0 = input.skills.find((x) => x.id === id)
  if (!s0) return fail(input, 'Skill not found.')
  if (s0.origin !== 'api' || !s0.providerSkillId) {
    return fail(input, 'A Claude web reference cannot be verified for API use. Import the permitted Skill bundle first (simulated).')
  }
  if (input.providers.anthropic.status !== 'connected') return fail(input, 'Connect the Anthropic demo account in Settings before verifying.')
  const state = clone(input)
  const s = state.skills.find((x) => x.id === id)
  s.status = 'api_ready'
  s.verifiedAt = now
  s.updatedAt = now
  return ok(state)
}

export function archiveSkill(input, id, now) {
  const state = clone(input)
  const s = state.skills.find((x) => x.id === id)
  if (!s) return fail(input, 'Skill not found.')
  s.archivedAt = now
  state.profile.defaultSkills.ids = state.profile.defaultSkills.ids.filter((x) => x !== id)
  return ok(state)
}

export function restoreSkill(input, id) {
  const state = clone(input)
  const s = state.skills.find((x) => x.id === id)
  if (!s) return fail(input, 'Skill not found.')
  s.archivedAt = null
  return ok(state)
}

export function setDefaultSkills(input, { ids = [], none = false }) {
  const state = clone(input)
  state.profile.defaultSkills = { ids: none ? [] : ids, none }
  return ok(state)
}

// ------------------------------------------------------------------ settings

export function updateProfile(input, patch) {
  const state = clone(input)
  Object.assign(state.profile, patch)
  return ok(state)
}

export function updateDefaults(input, patch) {
  const state = clone(input)
  state.profile.defaults = { ...state.profile.defaults, ...patch }
  return ok(state)
}

export function updateNotificationPrefs(input, patch) {
  const state = clone(input)
  state.profile.notificationPrefs = { ...state.profile.notificationPrefs, ...patch }
  return ok(state)
}

export function connectProvider(input, provider, now) {
  const state = clone(input)
  const p = state.providers[provider]
  p.status = 'connected'
  p.maskedIdentifier = provider === 'google' ? 'demo-google-••••-4c1e' : 'demo-anthropic-••••-9b07'
  p.credentialRef = `demo-ref-${provider}`
  p.lastCheckedAt = now
  p.lastCheckResult = 'Demo account connected. No real credential was requested or stored.'
  return ok(state)
}

export function disconnectProvider(input, provider, now) {
  const state = clone(input)
  const p = state.providers[provider]
  p.status = 'disconnected'
  p.maskedIdentifier = null
  p.credentialRef = null
  p.lastCheckedAt = now
  p.lastCheckResult = 'Disconnected.'
  return ok(state)
}

/** Demo-only: mark the credential as invalid to demonstrate the error state. */
export function invalidateProvider(input, provider, now) {
  const state = clone(input)
  const p = state.providers[provider]
  p.status = 'invalid'
  p.lastCheckedAt = now
  p.lastCheckResult = 'Simulated: the provider rejected the credential (401).'
  return ok(state)
}

export function testProvider(input, provider, now) {
  const state = clone(input)
  const p = state.providers[provider]
  p.lastCheckedAt = now
  p.lastCheckResult = p.status === 'connected'
    ? 'Simulated connection test passed. No network request was made.'
    : p.status === 'invalid' ? 'Simulated test failed: credential rejected. Reconnect the demo account.' : 'Not connected.'
  return ok(state, { passed: p.status === 'connected' })
}

export function setModel(input, provider, task, modelId) {
  const state = clone(input)
  const p = state.providers[provider]
  if (!p.catalog.some((m) => m.id === modelId && m.tasks.includes(task))) return fail(input, 'This model does not support that task.')
  p.models[task] = modelId
  return ok(state)
}

export function updateBudget(input, patch) {
  const next = { ...input.budget, ...patch }
  if (!(next.limit > 0) || next.limit > 500) return fail(input, 'Enter a monthly limit between $1 and $500.')
  if (!(next.warningPct >= 10 && next.warningPct <= 100)) return fail(input, 'Warning threshold must be between 10% and 100%.')
  const state = clone(input)
  state.budget = next
  return ok(state)
}

export function updateDemo(input, patch) {
  const state = clone(input)
  state.demo = { ...state.demo, ...patch }
  return ok(state)
}

// ------------------------------------------------------------------ notifications

export function markNotificationRead(input, id, now) {
  const state = clone(input)
  const n = state.notifications.find((x) => x.id === id)
  if (n && !n.readAt) n.readAt = now
  return ok(state)
}

export function markNotificationUnread(input, id) {
  const state = clone(input)
  const n = state.notifications.find((x) => x.id === id)
  if (n) n.readAt = null
  return ok(state)
}

export function markAllRead(input, now) {
  const state = clone(input)
  for (const n of state.notifications) if (!n.readAt) n.readAt = now
  return ok(state)
}

export function sendTestNotification(input, channel, now) {
  const state = clone(input)
  state.deliveryLog.unshift({
    id: nextId(state, 'dlv'), notificationId: null, channel,
    status: state.profile.notificationPrefs[channel] ? 'Simulated — not sent' : 'Channel off',
    to: channel === 'email' ? 'dr.ashraf@example.invalid' : 'Doctor’s phone (demo device)',
    subject: 'Test notification from Lecture Studio', at: now,
  })
  return ok(state)
}

export function saveFeedbackDraft(input, key, note) {
  const state = clone(input)
  state.meta.feedbackDrafts = { ...(state.meta.feedbackDrafts || {}) }
  if (note && note.trim()) state.meta.feedbackDrafts[key] = note
  else delete state.meta.feedbackDrafts[key]
  return ok(state)
}
