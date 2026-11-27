import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock3 } from 'lucide-react'
import { useNow, useStore } from '@/state/store.jsx'
import { GATES, STATION_BY_ID } from '@/engine/constants.js'
import { pendingReviews } from '@/engine/workflow.js'
import { last } from '@/engine/util.js'
import { elapsed } from '@/lib/format.js'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/app/common.jsx'
import { GateCode } from '@/components/app/status.jsx'
import { GatePips } from '@/components/app/ProductionRail.jsx'

function versionText(p, gate) {
  const a = p.artifacts
  if (gate === 'H1' || gate === 'H2') return `Content r${last(a.content)?.version}`
  if (gate === 'H3') return `Storyboard v${last(a.storyboard)?.version}`
  if (gate === 'H4') return `${p.plan.chunks.length} transcripts`
  if (gate === 'H5') return `${p.plan.chunks.length} voice chunks`
  if (gate === 'H6') return `Render v${last(a.renders)?.version}`
  return ''
}

export default function Reviews() {
  const { state } = useStore()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const all = pendingReviews(state)
  const gate = GATES.includes(params.get('gate')) ? params.get('gate') : 'all'
  const rows = gate === 'all' ? all : all.filter((r) => r.gate === gate)
  const count = (g) => all.filter((r) => r.gate === g).length

  return (
    <div>
      <PageHeader
        title="Pending reviews"
        description="Oldest first. Each review opens the exact version waiting for you; approving starts the next step automatically."
      />
      <div role="group" aria-label="Filter by review stage" className="mb-4 flex flex-wrap gap-1.5">
        {['all', ...GATES].map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={gate === g}
            onClick={() => setParams(g === 'all' ? {} : { gate: g }, { replace: true })}
            className={cn(
              'inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors',
              gate === g ? 'border-navy bg-navy text-white' : 'bg-surface hover:bg-subtle',
            )}
          >
            {g === 'all' ? 'All stages' : `${g} ${STATION_BY_ID[g].name}`}
            <span className={cn('text-xs tabular', gate === g ? 'text-[#c5d3e0]' : 'text-muted-foreground')}>{g === 'all' ? all.length : count(g)}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={all.length === 0 ? 'No reviews waiting' : `No ${gate} reviews waiting`}
          description={all.length === 0 ? 'You’re all caught up. You’ll be notified the moment a lecture needs you.' : 'Other stages have reviews waiting.'}
          action={all.length ? <Button variant="outline" onClick={() => setParams({}, { replace: true })}>Show all stages</Button> : <Button variant="outline" render={<Link to="/" />} nativeButton={false}>Back to Home</Button>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ project: p, gate: g, since }) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-xl border bg-surface px-5 py-4 sm:flex-row sm:items-center">
              <GateCode gate={g} className="h-10 min-w-12 self-start text-base sm:self-center" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.title}</p>
                <p className="text-sm text-muted-foreground">
                  {STATION_BY_ID[g].long} · {versionText(p, g)}{p.approvals[g] ? ' · again after a change' : ''}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 tabular"><Clock3 aria-hidden className="size-4" /> Waiting {elapsed(since, now)}</span>
                  <GatePips project={p} />
                </div>
              </div>
              <Button variant="accent" size="lg" render={<Link to={`/lectures/${p.id}/review/${g}`} />} nativeButton={false} aria-label={`Review ${g} for ${p.title}`}>
                Review
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
