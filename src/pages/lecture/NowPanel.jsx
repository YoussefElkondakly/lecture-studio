import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock3, Coffee, FastForward, Play, RotateCw, Settings, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { useNow, useStore } from '@/state/store.jsx'
import { FAILURE_CODES, STATION_BY_ID, STATUS } from '@/engine/constants.js'
import { describeJob, finishRunningJobs, retryProject, startDraft } from '@/engine/workflow.js'
import { elapsed, relativeTime } from '@/lib/format.js'
import { Button, ButtonLink } from '@/components/ui/button'
import { GateCode } from '@/components/app/status.jsx'
import { DemoTag } from '@/components/app/common.jsx'

const FIX_LINK = {
  BUDGET: '/settings?section=budget',
  CREDENTIAL: '/settings?section=providers',
  MODEL: '/settings?section=providers',
}

function finishNow(state, now) {
  return { state: finishRunningJobs(state, now), result: { ok: true } }
}

export function NowPanel({ project }) {
  const { state, act } = useStore()
  const now = useNow(1000)
  const p = project
  const job = state.jobs.find((j) => j.id === p.currentJobId)

  if (p.archivedAt) {
    return <Panelish tone="draft" icon={Clock3} title="Archived">This lecture is archived. Restore it from the actions menu to continue.</Panelish>
  }

  if (p.status === STATUS.DRAFT) {
    return (
      <Panelish tone="draft" icon={PenLine} title="Draft — not started yet">
        <p>Nothing runs until you start. Starting snapshots the selected prompt version and preferences.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => { act(startDraft, p.id); toast.success('Lecture started') }}><Play data-icon="inline-start" /> Start now</Button>
          <ButtonLink as={Link} to={`/lectures/new?draft=${p.id}`} variant="outline"><PenLine data-icon="inline-start" /> Edit draft</ButtonLink>
        </div>
      </Panelish>
    )
  }

  if (p.status === STATUS.NEEDS_REVIEW) {
    const st = STATION_BY_ID[p.stage]
    return (
      <Panelish tone="review" icon={Clock3} title={`Waiting for your review — ${st.long}`}>
        <p>Waiting for {elapsed(p.waitingSince, now)}. Production is paused at this gate until you decide; other lectures keep running.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <GateCode gate={p.stage} />
          <ButtonLink as={Link} to={`/lectures/${p.id}/review/${p.stage}`} variant="accent">Open {p.stage} review</ButtonLink>
        </div>
      </Panelish>
    )
  }

  if (p.status === STATUS.BLOCKED && p.error) {
    const e = p.error
    const retry = () => {
      const r = act(retryProject, p.id)
      if (r.ok) toast.success('Retry started')
      else toast.error('Still blocked', { description: r.error })
    }
    return (
      <Panelish tone="blocked" icon={AlertTriangle} title={`Paused: ${e.message}`}>
        <p>{describeJobLabel(state, e.jobId)} stopped {relativeTime(e.at, now)}. {e.fix}</p>
        <p className="mt-1">No other provider or model was tried automatically. Everything finished before this step is kept.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={retry}><RotateCw data-icon="inline-start" /> Retry {e.stage}</Button>
          {FIX_LINK[e.code] && (
            <ButtonLink as={Link} to={FIX_LINK[e.code]} variant="outline"><Settings data-icon="inline-start" /> Fix in Settings</ButtonLink>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Error code {e.code} — {FAILURE_CODES[e.code]?.label}. Simulated.</p>
      </Panelish>
    )
  }

  if (p.status === STATUS.COMPLETED) {
    return (
      <Panelish tone="completed" icon={CheckCircle2} title="Completed — all six approvals recorded">
        <p>Finished {relativeTime(p.completedAt, now)}. The final video and every file are in Deliverables.</p>
        <div className="mt-3">
          <ButtonLink as={Link} to={`/lectures/${p.id}?tab=deliverables`} variant="outline">Open deliverables</ButtonLink>
        </div>
      </Panelish>
    )
  }

  // processing / queued / revising
  const remaining = job?.dueAt ? Math.max(0, Math.ceil((job.dueAt - now) / 1000)) : null
  return (
    <Panelish tone="processing" icon={Coffee} title={job ? `Running: ${describeJob(job)}` : 'Queued'}>
      <p>
        {p.status === STATUS.REVISION_REQUESTED ? 'Applying your requested changes. ' : ''}
        This runs automatically — you can leave this page or close the browser tab. You’ll be notified when the next review is ready.
      </p>
      {job && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Provider</dt>
          <dd>{job.provider === 'local' ? 'Local renderer' : job.provider === 'google' ? 'Google' : 'Anthropic'} · {job.model} <DemoTag className="ml-1" /></dd>
          <dt className="text-muted-foreground">Started</dt>
          <dd>{relativeTime(job.startedAt, now)}{job.attempt > 1 ? ` · attempt ${job.attempt}` : ''}</dd>
          <dt className="text-muted-foreground">Simulated wait</dt>
          <dd>{remaining == null ? 'Manual demo mode — waits for “Finish running jobs”' : remaining > 0 ? `about ${remaining} s left (demo timer, not a real estimate)` : 'finishing…'}</dd>
        </dl>
      )}
      <div className="mt-3">
        <Button variant="outline" size="sm" onClick={() => act(finishNow)}>
          <FastForward data-icon="inline-start" /> Finish running jobs now (demo)
        </Button>
      </div>
    </Panelish>
  )
}

function describeJobLabel(state, jobId) {
  const j = state.jobs.find((x) => x.id === jobId)
  return j ? describeJob(j) : 'The job'
}

const TONES = {
  review: 'border-review-line/45 bg-review-bg/55',
  processing: 'border-processing/20 bg-processing-bg/60',
  blocked: 'border-blocked/30 bg-blocked-bg',
  completed: 'border-completed/25 bg-completed-bg/70',
  draft: 'border-border bg-subtle',
}
const ICON_TONES = { review: 'text-review', processing: 'text-processing', blocked: 'text-blocked', completed: 'text-completed', draft: 'text-muted-foreground' }

function Panelish({ tone, icon: Icon, title, children }) {
  return (
    <section aria-labelledby="now-title" className={`rounded-xl border px-5 py-4 ${TONES[tone]}`}>
      <div className="flex gap-3">
        <Icon aria-hidden className={`mt-0.5 size-5 shrink-0 ${ICON_TONES[tone]}`} />
        <div className="min-w-0 flex-1 text-base">
          <h2 id="now-title" className="font-semibold text-foreground">{title}</h2>
          <div className="mt-1 text-foreground/90">{children}</div>
        </div>
      </div>
    </section>
  )
}
