import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, CheckCircle2, CircleCheck, ClipboardCheck, Clock3, FilePlus2, Loader2, Plus, RotateCw, X,
} from 'lucide-react'
import { useNow, useStore } from '@/state/store.jsx'
import { dashboardCounts, pendingReviews, retryProject } from '@/engine/workflow.js'
import { STATION_BY_ID, STATUS } from '@/engine/constants.js'
import { elapsed, greeting, longDate, plural, relativeTime } from '@/lib/format.js'
import { cn } from '@/lib/utils'
import { Button, ButtonLink } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { GateCode, StageLabel, StatusBadge } from '@/components/app/status.jsx'
import { GatePips } from '@/components/app/ProductionRail.jsx'
import { EmptyState } from '@/components/app/common.jsx'
import { toast } from 'sonner'
import { clone } from '@/engine/util.js'

function Metric({ to, value, label, icon: Icon, tone, emphasis }) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex min-h-[5.5rem] flex-1 items-center gap-4 px-5 py-4 transition-colors hover:bg-subtle focus-visible:z-10',
        emphasis && value > 0 && 'bg-review-bg/60 hover:bg-review-bg',
      )}
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tone)}>
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="flex flex-col">
        <span className="font-serif text-[1.9rem] leading-none font-semibold text-foreground tabular">{value}</span>
        <span className="mt-1 text-sm text-muted-foreground group-hover:text-foreground">{label}</span>
      </span>
    </Link>
  )
}

function ReviewRow({ item, now }) {
  const { project, gate, since } = item
  const st = STATION_BY_ID[gate]
  const again = Boolean(project.approvals[gate])
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
      <GateCode gate={gate} />
      <div className="min-w-0 flex-1 basis-56">
        <Link to={`/lectures/${project.id}`} className="block truncate font-semibold text-foreground underline-offset-4 hover:underline">
          {project.title}
        </Link>
        <p className="text-sm text-muted-foreground">
          {st.long}
          {again && ' — again after a change'}
        </p>
      </div>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground tabular">
        <Clock3 aria-hidden className="size-4" />
        <span><span className="sr-only">Waiting for </span>{elapsed(since, now)}</span>
      </p>
      <ButtonLink as={Link} to={`/lectures/${project.id}/review/${gate}`} variant="accent" aria-label={`Review ${gate} ${st.name} for ${project.title}`}>
        Review
      </ButtonLink>
    </li>
  )
}

function FirstRunChecklist() {
  const { state, replace } = useStore()
  if (state.meta.onboardingDismissed) return null
  const items = [
    { done: state.providers.google.status === 'connected' && state.providers.anthropic.status === 'connected', label: 'Demo provider accounts connected', to: '/settings?section=providers' },
    { done: state.prompts.some((p) => !p.archivedAt), label: 'Sample master prompts available', to: '/prompts' },
    { done: Object.values(state.profile.stageDefaults).every(Boolean), label: 'A default prompt chosen for each stage', to: '/prompts' },
    { done: state.projects.length > 0, label: 'First lecture started', to: '/lectures/new' },
  ]
  const dismiss = () => {
    const next = clone(state)
    next.meta.onboardingDismissed = true
    replace(next)
  }
  return (
    <section aria-labelledby="first-run" className="rounded-xl border bg-surface">
      <div className="flex items-start justify-between gap-2 border-b px-5 py-4">
        <div>
          <h2 id="first-run" className="text-lg font-semibold">Getting started</h2>
          <p className="text-sm text-muted-foreground">Everything is pre-filled with demo data.</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Hide getting started" onClick={dismiss}><X /></Button>
      </div>
      <ul className="flex flex-col px-5 py-3">
        {items.map((i) => (
          <li key={i.label}>
            <Link to={i.to} className="flex min-h-10 items-center gap-2.5 rounded-md text-sm hover:underline">
              {i.done ? <CircleCheck aria-hidden className="size-5 text-teal" /> : <span aria-hidden className="size-5 rounded-full border-2 border-[#7c8ea3]" />}
              <span className={cn(i.done && 'text-muted-foreground')}>{i.label}</span>
              <span className="sr-only">{i.done ? '(done)' : '(to do)'}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t px-5 py-3">
        <Button variant="link" onClick={dismiss}>Skip and explore</Button>
      </div>
    </section>
  )
}

const ACT_ICON = { approved: CheckCircle2, rejected: RotateCw, error: AlertTriangle, completed: CheckCircle2, created: FilePlus2, edit: FilePlus2, job: Loader2, info: Clock3 }

export default function Home() {
  const { state, act } = useStore()
  const now = useNow()
  const navigate = useNavigate()
  const counts = dashboardCounts(state)
  const reviews = pendingReviews(state)
  const live = state.projects.filter((p) => !p.archivedAt)
  const active = live
    .filter((p) => [STATUS.PROCESSING, STATUS.QUEUED, STATUS.REVISION_REQUESTED, STATUS.BLOCKED].includes(p.status))
    .sort((a, b) => (a.status === STATUS.BLOCKED ? -1 : 0) - (b.status === STATUS.BLOCKED ? -1 : 0) || b.updatedAt - a.updatedAt)
  const blocked = live.filter((p) => p.status === STATUS.BLOCKED)
  const completed = live.filter((p) => p.status === STATUS.COMPLETED).sort((a, b) => b.completedAt - a.completedAt).slice(0, 3)
  const drafts = live.filter((p) => p.status === STATUS.DRAFT)
  const activity = state.activity.filter((a) => a.kind !== 'job').slice(0, 7)
  const isEmpty = live.length === 0

  const summary = [
    reviews.length ? `${plural(reviews.length, 'review is', 'reviews are')} waiting for you` : 'Nothing is waiting for your review',
    counts.processing ? `${plural(counts.processing, 'lecture')} in production` : null,
    counts.blocked ? `${plural(counts.blocked, 'lecture needs', 'lectures need')} attention` : null,
  ].filter(Boolean).join(' · ')

  const retry = (p) => {
    const r = act(retryProject, p.id)
    if (r.ok) toast.success(`Retrying ${p.title}`)
    else toast.error(`Still blocked: ${r.error}`, { description: 'Open the lecture for the fix.' })
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="greeting" className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{longDate(now)}</p>
          <h1 id="greeting" className="mt-1 font-serif text-3xl font-semibold tracking-[-0.015em] text-foreground md:text-[2.5rem] md:leading-[3rem]">
            {greeting(now)}, Dr. Ashraf
          </h1>
          <p className="mt-2 text-base text-muted-foreground">{summary}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" variant="outline" disabled={!reviews.length} onClick={() => navigate('/reviews')}>
            <ClipboardCheck data-icon="inline-start" />
            Review pending
            <span className="ml-1 rounded-sm bg-review-bg px-1.5 text-sm text-review tabular">{reviews.length}</span>
          </Button>
          <ButtonLink as={Link} to="/lectures/new" size="lg">
            <Plus data-icon="inline-start" /> Start new lecture
          </ButtonLink>
        </div>
      </section>

      <nav aria-label="Lecture counts" className="overflow-hidden rounded-xl border bg-surface">
        <div className="grid grid-cols-2 divide-x divide-y lg:grid-cols-4 lg:divide-y-0 [&>*:nth-child(2)]:border-r-0 lg:[&>*:nth-child(2)]:border-r">
          <Metric to="/reviews" value={counts.review} label="Needs review" icon={ClipboardCheck} tone="bg-review-bg text-review" emphasis />
          <Metric to="/lectures?status=processing" value={counts.processing} label="Processing" icon={Loader2} tone="bg-processing-bg text-processing" />
          <Metric to="/lectures?status=blocked" value={counts.blocked} label="Action needed" icon={AlertTriangle} tone="bg-blocked-bg text-blocked" />
          <Metric to="/lectures?status=completed" value={counts.completed} label="Completed (all time)" icon={CheckCircle2} tone="bg-completed-bg text-completed" />
        </div>
      </nav>

      {isEmpty ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(18rem,1fr)]">
          <EmptyState
            icon={FilePlus2}
            title="No lectures yet"
            description="Start a lecture from a source and a saved master prompt. You can leave right after starting — you’ll be notified when the first review is ready."
            action={<ButtonLink as={Link} to="/lectures/new"><Plus data-icon="inline-start" /> Start new lecture</ButtonLink>}
          />
          <FirstRunChecklist />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(18rem,1fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <section aria-labelledby="waiting" className="rounded-xl border border-review-line/40 bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-review-line/25 bg-review-bg/45 px-5 py-4">
                <div>
                  <h2 id="waiting" className="text-lg font-semibold">Waiting for your review</h2>
                  <p className="text-sm text-muted-foreground">Oldest first. Each opens the exact version to review.</p>
                </div>
                {reviews.length > 0 && <Link to="/reviews" className="text-sm font-semibold text-navy underline-offset-4 hover:underline">Review inbox</Link>}
              </div>
              {reviews.length ? (
                <ul className="divide-y">
                  {reviews.map((r) => <ReviewRow key={r.project.id} item={r} now={now} />)}
                </ul>
              ) : (
                <p className="flex items-center gap-2 px-5 py-6 text-base text-muted-foreground">
                  <CheckCircle2 aria-hidden className="size-5 text-completed" /> You’re all caught up. New reviews appear here the moment they’re ready.
                </p>
              )}
            </section>

            <section aria-labelledby="production" className="rounded-xl border bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
                <div>
                  <h2 id="production" className="text-lg font-semibold">In production</h2>
                  <p className="text-sm text-muted-foreground">Running automatically. You don’t need to stay on this page.</p>
                </div>
                <Link to="/lectures" className="text-sm font-semibold text-navy underline-offset-4 hover:underline">All lectures</Link>
              </div>
              {active.length ? (
                <ul className="divide-y">
                  {active.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
                      <div className="min-w-0 flex-1 basis-60">
                        <Link to={`/lectures/${p.id}`} className="block font-semibold underline-offset-4 hover:underline">{p.title}</Link>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                          <StageLabel stage={p.stage} long />
                          <GatePips project={p} />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">Updated {relativeTime(p.updatedAt, now)}</span>
                      <StatusBadge status={p.status} />
                      {p.status === STATUS.BLOCKED && (
                        <Button variant="outline" size="sm" onClick={() => retry(p)}>
                          <RotateCw data-icon="inline-start" /> Retry
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-base text-muted-foreground">No lectures are processing right now.</p>
              )}
            </section>
          </div>

          <aside className="flex min-w-0 flex-col gap-6" aria-label="Updates">
            {blocked.map((p) => (
              <Alert key={p.id} variant="destructive">
                <AlertTriangle aria-hidden />
                <AlertTitle>{p.title} is paused</AlertTitle>
                <AlertDescription>
                  <p>{p.error?.message}. {p.error?.fix}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ButtonLink as={Link} to={`/lectures/${p.id}`} size="sm" variant="outline">Open lecture</ButtonLink>
                    <Button size="sm" variant="outline" onClick={() => retry(p)}><RotateCw data-icon="inline-start" /> Retry</Button>
                  </div>
                </AlertDescription>
              </Alert>
            ))}

            <FirstRunChecklist />

            {drafts.length > 0 && (
              <section aria-labelledby="drafts" className="rounded-xl border bg-surface">
                <h2 id="drafts" className="border-b px-5 py-4 text-lg font-semibold">Drafts</h2>
                <ul className="divide-y">
                  {drafts.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
                      <ButtonLink as={Link} to={`/lectures/${p.id}`} size="sm" variant="outline">Resume</ButtonLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="activity" className="rounded-xl border bg-surface">
              <h2 id="activity" className="border-b px-5 py-4 text-lg font-semibold">Recent activity</h2>
              <ol className="flex flex-col px-5 py-2">
                {activity.map((a) => {
                  const Icon = ACT_ICON[a.kind] || Clock3
                  return (
                    <li key={a.id} className="flex gap-3 py-2.5">
                      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', a.kind === 'error' ? 'text-blocked' : a.kind === 'approved' || a.kind === 'completed' ? 'text-teal' : 'text-muted-foreground')} />
                      <div className="min-w-0">
                        <p className="text-sm leading-snug">{a.text}</p>
                        <p className="text-xs text-muted-foreground">{relativeTime(a.at, now)}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>

            {completed.length > 0 && (
              <section aria-labelledby="completed" className="rounded-xl border bg-surface">
                <h2 id="completed" className="border-b px-5 py-4 text-lg font-semibold">Recently completed</h2>
                <ul className="divide-y">
                  {completed.map((p) => (
                    <li key={p.id}>
                      <Link to={`/lectures/${p.id}?tab=deliverables`} className="flex items-center gap-3 px-5 py-3 hover:bg-subtle">
                        <CheckCircle2 aria-hidden className="size-4 shrink-0 text-completed" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
                        <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
                        <span className="sr-only">Open deliverables</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
