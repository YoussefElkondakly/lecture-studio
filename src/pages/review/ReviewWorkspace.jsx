import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock3, FileQuestion, History, Info, RefreshCw, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useNow, useStore } from '@/state/store.jsx'
import { H6_ROUTES, STATION_BY_ID } from '@/engine/constants.js'
import { computeProgress, decide, getProject, MIN_FEEDBACK, pendingReviews, timingExceptions } from '@/engine/workflow.js'
import { markNotificationRead, saveFeedbackDraft } from '@/engine/library.js'
import { last } from '@/engine/util.js'
import { elapsed } from '@/lib/format.js'
import { cn } from '@/lib/utils'
import { Button, ButtonLink } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, PageHeader } from '@/components/app/common.jsx'
import { GateCode } from '@/components/app/status.jsx'
import { H1Review, H2Review, H3Review, H4Review, H5Review, H6Review } from './gates.jsx'

const GATE_VIEW = { H1: H1Review, H2: H2Review, H3: H3Review, H4: H4Review, H5: H5Review, H6: H6Review }

const REJECT_EFFECT = {
  H1: 'Lecture content is regenerated with your feedback and a new revision comes back to H1. This revision can never be approved.',
  H2: 'Your feedback is recorded and H2 is presented again. Nothing else changes.',
  H3: 'The storyboard is regenerated (focusing on the selected scenes) and comes back to H3. Approved content is unchanged.',
  H4: 'Only the selected chunks are rewritten; all other transcripts stay exactly as they are. Then H4 comes back.',
  H5: 'Only the selected voice chunks are regenerated; all others are kept. Then H5 comes back.',
  H6: 'Only the part you choose is redone. Earlier approvals that are not affected stay valid; the previous render is archived.',
}

function versionLabel(project, gate) {
  const a = project.artifacts
  switch (gate) {
    case 'H1': case 'H2': return `Content r${last(a.content).version}`
    case 'H3': return `Storyboard v${last(a.storyboard).version}`
    case 'H4': return `Transcript set (${project.plan.chunks.length} chunks)`
    case 'H5': return `Voice set (${project.plan.chunks.length} chunks)`
    case 'H6': return `Render v${last(a.renders).version}`
    default: return ''
  }
}

function initialExtras(state, project, gate) {
  const d = state.profile
  const e = { selected: [] }
  if (gate === 'H2') {
    e.skills = { ids: d.defaultSkills.ids.filter((id) => state.skills.some((s) => s.id === id && !s.archivedAt)), none: d.defaultSkills.none }
    e.nextPrompts = { B: project.promptRefs.B?.promptId || d.stageDefaults.B, B2: project.promptRefs.B2?.promptId || d.stageDefaults.B2 }
  }
  if (gate === 'H3') e.nextPrompts = { C: project.promptRefs.C?.promptId || d.stageDefaults.C }
  if (gate === 'H4') e.nextPrompts = { D: project.promptRefs.D?.promptId || d.stageDefaults.D }
  return e
}

function RequestChangesDialog({ open, onOpenChange, project, gate, fp, extras, onDone }) {
  const { state, act } = useStore()
  const draftKey = `${project.id}:${gate}`
  const savedDraft = state.meta.feedbackDrafts?.[draftKey] || ''
  const [note, setNote] = useState(savedDraft)
  const [ids, setIds] = useState(extras.selected || [])
  const [route, setRoute] = useState('')
  const [rs, setRs] = useState({ gapSeconds: project.renderSettings.gapSeconds, fadeSeconds: project.renderSettings.fadeSeconds })
  const [error, setError] = useState('')
  const noteRef = useRef(null)

  useEffect(() => {
    if (open) {
      setNote(state.meta.feedbackDrafts?.[draftKey] || '')
      setIds(extras.selected || [])
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const chunkGate = gate === 'H4' || gate === 'H5' || (gate === 'H6' && ['AUDIO', 'TRANSCRIPT'].includes(route))
  const sceneGate = gate === 'H3'
  const options = sceneGate ? last(project.artifacts.storyboard).scenes.map((s) => s.id) : project.plan.chunks.map((c) => c.id)
  const toggle = (id) => setIds((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]))

  const saveDraft = () => {
    act(saveFeedbackDraft, draftKey, note)
    toast.success('Feedback draft saved', { description: 'It will be here when you come back to this review.' })
    onOpenChange(false)
  }

  const submit = () => {
    const r = act(decide, {
      projectId: project.id, gate, fp, decision: 'REJECT', note,
      affectedIds: chunkGate || sceneGate ? ids : [], route: gate === 'H6' ? route : undefined,
      renderSettings: route === 'RENDER_ONLY' ? { gapSeconds: Number(rs.gapSeconds), fadeSeconds: Number(rs.fadeSeconds) } : undefined,
    })
    if (!r.ok) {
      setError(r.error)
      if (r.code === 'NOTE_REQUIRED') noteRef.current?.focus()
      return
    }
    act(saveFeedbackDraft, draftKey, '')
    onDone(r)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Request changes — {gate} {STATION_BY_ID[gate].name}</DialogTitle>
          <DialogDescription>{REJECT_EFFECT[gate]}</DialogDescription>
        </DialogHeader>

        {gate === 'H6' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Where does the correction belong?</legend>
            {H6_ROUTES.map((r) => (
              <label key={r.id} className={cn('flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-teal', route === r.id ? 'border-navy bg-navy-tint' : 'hover:bg-subtle')}>
                <input type="radio" name="h6-route" value={r.id} checked={route === r.id} onChange={() => { setRoute(r.id); setIds([]) }} className="mt-1 size-4 accent-[#153C63]" />
                <span>
                  <span className="text-sm font-semibold">{r.label} <span className="font-normal text-muted-foreground">({r.id})</span></span>
                  <span className="block text-sm text-muted-foreground">{r.help}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {(chunkGate || sceneGate) && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              {sceneGate ? 'Scenes to focus on (optional)' : gate === 'H5' || route === 'AUDIO' ? 'Voice chunks to regenerate' : 'Transcript chunks to revise'}
            </legend>
            <div className="flex flex-wrap gap-2">
              {options.map((id) => (
                <label key={id} className={cn('inline-flex h-10 min-w-14 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold tabular has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-teal', ids.includes(id) ? 'border-navy bg-navy text-white' : 'hover:bg-subtle')}>
                  <input type="checkbox" className="sr-only" checked={ids.includes(id)} onChange={() => toggle(id)} />
                  {id}
                </label>
              ))}
              {gate === 'H4' && (
                <label className={cn('inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-teal', ids.includes('ALL') ? 'border-navy bg-navy text-white' : 'hover:bg-subtle')}>
                  <input type="checkbox" className="sr-only" checked={ids.includes('ALL')} onChange={() => setIds((x) => (x.includes('ALL') ? [] : ['ALL']))} />
                  All chunks
                </label>
              )}
            </div>
            {!sceneGate && <p className="mt-2 text-sm text-muted-foreground">{ids.length ? `Selected: ${ids.join(', ')}. Everything else is kept.` : 'Select at least one.'}</p>}
          </fieldset>
        )}

        {route === 'RENDER_ONLY' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Pause between chunks (s)
              <select className="h-10 rounded-md border border-input bg-surface px-2 font-normal" value={rs.gapSeconds} onChange={(e) => setRs((x) => ({ ...x, gapSeconds: Number(e.target.value) }))}>
                {[0, 0.25, 0.5, 0.75, 1, 1.5].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Fade in/out (s)
              <select className="h-10 rounded-md border border-input bg-surface px-2 font-normal" value={rs.fadeSeconds} onChange={(e) => setRs((x) => ({ ...x, fadeSeconds: Number(e.target.value) }))}>
                {[0, 0.5, 1, 1.5, 2].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <p className="col-span-2 text-sm text-muted-foreground">Change at least one setting — an identical re-render would be rejected again.</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="reject-note" className="text-sm font-semibold">What should change?</label>
          <Textarea
            id="reject-note"
            ref={noteRef}
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-describedby="reject-note-help"
            aria-invalid={Boolean(error && note.trim().length < MIN_FEEDBACK) || undefined}
            placeholder={gate === 'H1' ? 'For example: keep the warning signs on slide 9 exactly as written in the source.' : 'Describe what is wrong and what you expect instead.'}
          />
          <p id="reject-note-help" className="text-sm text-muted-foreground">Required — at least {MIN_FEEDBACK} characters. It is sent with the revision request and kept in the approval history.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertTitle>Not sent</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={saveDraft}><Save data-icon="inline-start" /> Save feedback draft</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}><RotateCcw data-icon="inline-start" /> Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmCheck({ id, checked, onChange, children }) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border px-3 py-3', checked ? 'border-completed/30 bg-completed-bg/70' : 'border-review-line/40 bg-review-bg/50')}>
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} className="mt-0.5" />
      <label htmlFor={id} className="text-sm leading-snug font-semibold">{children}</label>
    </div>
  )
}

/** Gate-specific confirmations required to approve — kept next to the Approve button. */
function GateConfirmations({ project, gate, extras, setExtras, idSuffix = '' }) {
  const set = (k) => (v) => setExtras((x) => ({ ...x, [k]: v }))
  if (gate === 'H1') {
    return (
      <ConfirmCheck id={`h1-confirm${idSuffix}`} checked={Boolean(extras.confirm)} onChange={set('confirm')}>
        I personally reviewed the medical content of revision r{last(project.artifacts.content).version} — facts, numbers, units, doses, tables, figures and references.
      </ConfirmCheck>
    )
  }
  if (gate === 'H5') {
    const ex = timingExceptions(project)
    if (!ex.length) return null
    return (
      <ConfirmCheck id={`h5-timing${idSuffix}`} checked={Boolean(extras.acceptTiming)} onChange={set('acceptTiming')}>
        I accept the timing exception{ex.length > 1 ? 's' : ''} for chunk {ex.map((e) => `${e.chunkId} (${e.seconds} s)`).join(', ')}.
      </ConfirmCheck>
    )
  }
  if (gate === 'H6') {
    return (
      <ConfirmCheck id={`h6-watched${idSuffix}`} checked={Boolean(extras.watched)} onChange={set('watched')}>
        I watched the complete final video with sound.
      </ConfirmCheck>
    )
  }
  return null
}

function approveBlocker(project, gate, extras) {
  if (gate === 'H1' && !extras.confirm) return 'Tick the medical review confirmation above to approve.'
  if (gate === 'H2') {
    const s = extras.skills || {}
    if (!s.none && !(s.ids || []).length) return 'Select Skills or choose NONE to approve.'
  }
  if (gate === 'H5' && timingExceptions(project).length && !extras.acceptTiming) return 'Accept the timing exceptions or regenerate those chunks.'
  if (gate === 'H6' && !extras.watched) return 'Confirm above that you watched the complete video.'
  return null
}

export default function ReviewWorkspace() {
  const { id, gate } = useParams()
  const [params, setParams] = useSearchParams()
  const { state, act } = useStore()
  const navigate = useNavigate()
  const now = useNow()
  const project = getProject(state, id)
  const progress = project && !project.archivedAt ? computeProgress(project) : null
  const isOpen = progress?.kind === 'gate' && progress.stage === gate
  const currentFp = isOpen ? progress.fp : null

  // The version the doctor is looking at. Updated on own edits; foreign changes show a banner.
  const [openedFp, setOpenedFp] = useState(currentFp)
  const [extras, setExtras] = useState(() => (project ? initialExtras(state, project, gate) : {}))
  const [rejectOpen, setRejectOpen] = useState(false)
  const [error, setError] = useState('')
  const [staleLink, setStaleLink] = useState(false)
  const ownEdit = useRef(false)

  useEffect(() => {
    setOpenedFp(currentFp)
    setError('')
    if (project) setExtras(initialExtras(state, project, gate))
    // reset when the route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, gate])

  // Stale deep link (?v= older version): explain, then show the current version. Never approve the old one.
  useEffect(() => {
    const v = params.get('v')
    if (v && currentFp && v !== currentFp) setStaleLink(true)
    if (v) {
      const next = new URLSearchParams(params)
      next.delete('v')
      setParams(next, { replace: true })
    }
    // mark the matching notification read
    const n = state.notifications.find((x) => x.projectId === id && x.gate === gate && !x.readAt)
    if (n) act(markNotificationRead, n.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, gate])

  useEffect(() => {
    if (ownEdit.current && currentFp) {
      setOpenedFp(currentFp)
      ownEdit.current = false
    } else if (!openedFp && currentFp) {
      setOpenedFp(currentFp)
    }
  }, [currentFp, openedFp])

  const extrasReady = useMemo(() => extras, [extras])

  if (!project) {
    return <EmptyState icon={FileQuestion} title="Lecture not found" description="It may have been removed when the demo was reset." action={<ButtonLink as={Link} to="/reviews">Go to Pending reviews</ButtonLink>} />
  }

  const station = STATION_BY_ID[gate]
  if (!station || station.kind !== 'gate') {
    return <EmptyState icon={FileQuestion} title="Unknown review" description={`“${gate}” is not one of the six review gates.`} action={<ButtonLink as={Link} to={`/lectures/${project.id}`}>Open lecture</ButtonLink>} />
  }

  // Waiting for an own PDF re-render after a direct H1 edit, or the lecture has moved on.
  if (!isOpen) {
    const atGate = progress?.kind === 'gate'
    const pdfRendering = progress?.stage === 'A' && progress.task === 'pdf'
    return (
      <div>
        <PageHeader breadcrumbs={[{ label: 'Pending reviews', to: '/reviews' }, { label: project.title, to: `/lectures/${project.id}` }, { label: gate }]} title={`${gate} · ${station.long}`} />
        <Alert variant={pdfRendering ? 'info' : 'warning'} className="max-w-3xl">
          {pdfRendering ? <RefreshCw aria-hidden className="motion-safe:animate-spin" /> : <Info aria-hidden />}
          <AlertTitle>{pdfRendering ? 'Re-rendering the paired PDF from your new revision' : `This lecture is not waiting for ${gate} right now`}</AlertTitle>
          <AlertDescription>
            <p>
              {pdfRendering
                ? 'The review reopens automatically as soon as the PDF matches the new canonical text.'
                : project.archivedAt
                  ? 'The lecture is archived.'
                  : atGate
                    ? `It is now waiting for ${progress.stage} · ${STATION_BY_ID[progress.stage].name}. Nothing was approved from this link.`
                    : progress?.kind === 'done' ? 'All six gates are approved.' : `It is in ${STATION_BY_ID[progress.stage]?.long || 'processing'}. Nothing was approved from this link.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {atGate && <ButtonLink as={Link} to={`/lectures/${project.id}/review/${progress.stage}`} variant="accent">Open current review ({progress.stage})</ButtonLink>}
              <ButtonLink as={Link} to={`/lectures/${project.id}`} variant="outline">Open lecture</ButtonLink>
              <ButtonLink as={Link} to="/reviews" variant="ghost">Pending reviews</ButtonLink>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const View = GATE_VIEW[gate]
  const changedUnderneath = openedFp && currentFp !== openedFp
  const blocker = approveBlocker(project, gate, extras)
  const promptStage = { H1: 'A', H3: 'B', H4: 'C', H5: 'D' }[gate]
  const promptRef = promptStage ? project.promptRefs[promptStage] : null

  const approve = () => {
    setError('')
    const r = act(decide, {
      projectId: project.id, gate, fp: openedFp, decision: 'APPROVE',
      confirm: extras.confirm, watched: extras.watched, acceptTiming: extras.acceptTiming,
      skills: extras.skills, acceptUnverified: extras.acceptUnverified, nextPrompts: extras.nextPrompts,
    })
    if (!r.ok) {
      setError(r.error)
      return
    }
    const next = r.next
    if (next.kind === 'gate') {
      toast.success(`${gate} approved`, { description: `${next.stage} · ${STATION_BY_ID[next.stage].name} is ready for you now.` })
      navigate(`/lectures/${project.id}/review/${next.stage}`)
    } else if (next.kind === 'done') {
      toast.success('Lecture completed', { description: 'All six approvals recorded. Deliverables are ready.' })
      navigate(`/lectures/${project.id}?tab=deliverables`)
    } else {
      toast.success(`${gate} approved — ${STATION_BY_ID[next.stage].long} started automatically`, { description: 'You’ll be notified when the next review is ready.' })
      const more = pendingReviews(state).filter((x) => x.project.id !== project.id).length
      navigate(more ? '/reviews' : '/')
    }
  }

  const onRejected = (r) => {
    setRejectOpen(false)
    const next = r.next
    toast.success('Changes requested', { description: next.kind === 'gate' ? `${next.stage} is waiting again.` : `${STATION_BY_ID[next.stage].long} is running with your feedback.` })
    navigate(next.kind === 'gate' && next.stage === gate ? `/lectures/${project.id}/review/${gate}` : '/reviews')
  }

  const decisionPanel = (suffix) => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-semibold">{versionLabel(project, gate)}</p>
        <p className="text-muted-foreground">Fingerprint {openedFp?.split(':').slice(1).join(':').slice(0, 14)}</p>
        {promptRef && <p className="text-muted-foreground">Prompt: {promptRef.title} v{promptRef.version}</p>}
        <p className="flex items-center gap-1.5 text-muted-foreground"><Clock3 aria-hidden className="size-4" /> Waiting {elapsed(project.waitingSince, now)}</p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Not recorded</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <GateConfirmations project={project} gate={gate} extras={extras} setExtras={setExtras} idSuffix={suffix} />
      <div className="flex flex-col gap-2">
        <Button variant="accent" size="lg" onClick={() => (blocker ? setError(blocker) : approve())} aria-disabled={Boolean(blocker) || undefined} aria-describedby={blocker ? `approve-blocker${suffix}` : undefined}>
          <CheckCircle2 data-icon="inline-start" /> Approve and continue
        </Button>
        {blocker && <p id={`approve-blocker${suffix}`} className="text-sm text-muted-foreground">{blocker}</p>}
        <Button variant="outline" onClick={() => setRejectOpen(true)}>
          <RotateCcw data-icon="inline-start" /> Request changes
        </Button>
        {state.meta.feedbackDrafts?.[`${project.id}:${gate}`] && <p className="text-sm text-muted-foreground">You have a saved feedback draft.</p>}
      </div>
      <p className="text-xs text-muted-foreground">Your decision is bound to this exact version. After approval the next stage starts automatically.</p>
    </div>
  )

  return (
    <div className="pb-20 lg:pb-0">
      <PageHeader
        breadcrumbs={[{ label: 'Pending reviews', to: '/reviews' }, { label: project.title, to: `/lectures/${project.id}` }, { label: gate }]}
        title={<span className="flex flex-wrap items-center gap-3"><GateCode gate={gate} className="h-9 min-w-12 text-base" /> {station.long}</span>}
        description={<span>{project.title} · {project.prefs.language}{project.approvals[gate] ? ' · requested again after a change' : ''}</span>}
        actions={<ButtonLink as={Link} to={`/lectures/${project.id}?tab=history`} variant="ghost"><History data-icon="inline-start" /> History</ButtonLink>}
      />

      {staleLink && (
        <Alert variant="info" className="mb-6">
          <Info aria-hidden />
          <AlertTitle>That link was for an earlier version</AlertTitle>
          <AlertDescription>You’re now viewing the latest version ({versionLabel(project, gate)}). Nothing was approved from the old link.</AlertDescription>
        </Alert>
      )}
      {changedUnderneath && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle aria-hidden />
          <AlertTitle>This review changed since you opened it</AlertTitle>
          <AlertDescription>
            <p>A newer version was produced. A decision now would not match what you reviewed, so it would be refused.</p>
            <Button size="sm" className="mt-2" variant="outline" onClick={() => { setOpenedFp(currentFp); setError('') }}><RefreshCw data-icon="inline-start" /> Load the latest version</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="min-w-0">
          <View project={project} fp={currentFp} extras={extrasReady} setExtras={setExtras} onEdited={() => { ownEdit.current = true }} />
        </div>
        <aside className="hidden lg:block" aria-label="Decision">
          <div className="sticky top-24 rounded-xl border bg-surface p-5">
            <h2 className="mb-3 text-lg font-semibold">Your decision</h2>
            {decisionPanel('')}
          </div>
        </aside>
        <section id="decision-mobile" className="scroll-mt-24 rounded-xl border bg-surface p-5 lg:hidden" aria-label="Decision">
          <h2 className="mb-3 text-lg font-semibold">Your decision</h2>
          {decisionPanel('-m')}
        </section>
      </div>

      {/* Phone/tablet sticky decision bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setRejectOpen(true)}>Request changes</Button>
          <Button variant="accent" className="flex-1" onClick={() => (blocker ? (setError(blocker), document.getElementById('decision-mobile')?.scrollIntoView({ block: 'start' })) : approve())}>
            Approve
          </Button>
        </div>
      </div>

      <RequestChangesDialog open={rejectOpen} onOpenChange={setRejectOpen} project={project} gate={gate} fp={openedFp} extras={extras} onDone={onRejected} />
    </div>
  )
}
