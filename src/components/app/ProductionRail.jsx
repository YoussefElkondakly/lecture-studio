// The production line: twelve stations, six of them human gates. Gates are drawn as prominent
// markers and machine steps as quiet nodes — "human in the loop" made visible.
import { AlertTriangle, Check, RotateCcw, UserRound } from 'lucide-react'
import { GATES } from '@/engine/constants.js'
import { stationStates } from '@/engine/workflow.js'
import { cn } from '@/lib/utils'

const STATE_TEXT = {
  done: 'done',
  review: 'waiting for your review',
  'review-again': 'waiting for your review again',
  running: 'running now',
  blocked: 'stopped — action needed',
  upcoming: 'not started',
  reset: 'needs approval again after a change',
}

function GateMarker({ st }) {
  const s = st.state
  return (
    <span
      className={cn(
        'relative z-10 flex size-11 items-center justify-center rounded-lg border-2 font-serif text-[0.95rem] font-semibold tabular transition-colors',
        s === 'done' && 'border-teal bg-teal text-white',
        (s === 'review' || s === 'review-again') && 'border-review-line bg-review-bg text-review shadow-[0_0_0_4px_var(--ls-review-bg)]',
        s === 'upcoming' && 'border-[#b8c6d4] bg-surface text-muted-foreground',
        s === 'reset' && 'border-dashed border-review-line bg-surface text-review',
        s === 'blocked' && 'border-blocked bg-blocked-bg text-blocked',
      )}
    >
      {s === 'done' ? <Check aria-hidden className="size-5" strokeWidth={2.6} /> : st.id}
      {s === 'reset' && <RotateCcw aria-hidden className="absolute -top-2 -right-2 size-4 rounded-full bg-surface p-0.5 text-review" />}
    </span>
  )
}

function MachineMarker({ st }) {
  const s = st.state
  return (
    <span
      className={cn(
        'relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-[0.7rem] font-bold tabular',
        s === 'done' && 'border-navy bg-navy text-white',
        s === 'running' && 'border-processing bg-processing-bg text-processing',
        s === 'blocked' && 'border-blocked bg-blocked-bg text-blocked',
        s === 'upcoming' && 'border-[#b8c6d4] bg-surface text-muted-foreground',
      )}
    >
      {s === 'blocked' ? <AlertTriangle aria-hidden className="size-3.5" /> : st.id}
      {s === 'running' && (
        <span aria-hidden className="absolute -inset-1 rounded-full border-2 border-processing border-t-transparent motion-safe:animate-spin [animation-duration:1.6s]" />
      )}
    </span>
  )
}

export function ProductionRail({ project, className }) {
  const stations = stationStates(project)
  return (
    <div className={className}>
      {/* Horizontal rail (tablet/desktop) */}
      <ol className="hidden items-start md:flex" aria-label="Production stages">
        {stations.map((st, i) => {
          const prevDone = i > 0 && ['done'].includes(stations[i - 1].state) && st.state !== 'upcoming'
          const isGate = st.kind === 'gate'
          return (
            <li key={st.id} className={cn('relative flex flex-col items-center text-center', isGate ? 'min-w-0 flex-[1.35]' : 'min-w-0 flex-1')}>
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn('absolute top-[21px] right-1/2 left-[-50%] h-0.5', prevDone || st.state === 'done' ? 'bg-navy/70' : 'bg-[#c9d5e1]')}
                />
              )}
              <span className="flex h-11 items-center">{isGate ? <GateMarker st={st} /> : <MachineMarker st={st} />}</span>
              <span
                className={cn(
                  'mt-2 px-0.5 text-xs leading-tight',
                  isGate ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  (st.state === 'review' || st.state === 'review-again') && 'text-review',
                  st.state === 'blocked' && 'text-blocked',
                )}
              >
                {st.name}
              </span>
              <span className="sr-only">{`${st.id} ${st.long}: ${STATE_TEXT[st.state]}`}</span>
              {isGate && (st.state === 'review' || st.state === 'review-again') && (
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-review" aria-hidden>
                  <UserRound className="size-3" /> {st.state === 'review-again' ? 'Again' : 'You'}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {/* Vertical list (phone) */}
      <ol className="flex flex-col gap-0 md:hidden" aria-label="Production stages">
        {stations.map((st) => (
          <li key={st.id} className="flex min-h-11 items-center gap-3">
            <span className="flex w-11 justify-center">{st.kind === 'gate' ? <GateMarker st={st} /> : <MachineMarker st={st} />}</span>
            <span className={cn('text-sm', st.kind === 'gate' ? 'font-semibold' : 'text-muted-foreground')}>{st.long}</span>
            <span className="ml-auto text-xs text-muted-foreground">{STATE_TEXT[st.state]}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Compact gate pips for list rows: six approvals with the current position. */
export function GatePips({ project, className }) {
  const states = stationStates(project).filter((s) => s.kind === 'gate')
  const done = states.filter((s) => s.state === 'done').length
  return (
    <span className={cn('inline-flex items-center gap-1', className)} role="img" aria-label={`${done} of ${GATES.length} approvals recorded`}>
      {states.map((s) => (
        <span
          key={s.id}
          title={`${s.id} ${s.name}: ${STATE_TEXT[s.state]}`}
          className={cn(
            'h-2.5 w-4 rounded-[3px] border',
            s.state === 'done' && 'border-teal bg-teal',
            (s.state === 'review' || s.state === 'review-again') && 'border-review-line bg-review-line',
            s.state === 'upcoming' && 'border-[#b8c6d4] bg-surface',
            s.state === 'reset' && 'border-dashed border-review-line bg-surface',
            s.state === 'blocked' && 'border-blocked bg-blocked',
          )}
        />
      ))}
    </span>
  )
}
