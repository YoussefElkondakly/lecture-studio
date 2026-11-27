import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, Eye, Loader2, PenLine, Archive } from 'lucide-react'
import { STATUS_META, STATION_BY_ID } from '@/engine/constants.js'
import { cn } from '@/lib/utils'

const TONE = {
  review: 'bg-review-bg text-review border-review-line/35',
  processing: 'bg-processing-bg text-processing border-processing/20',
  completed: 'bg-completed-bg text-completed border-completed/20',
  blocked: 'bg-blocked-bg text-blocked border-blocked/25',
  draft: 'bg-draft-bg text-draft border-draft/20',
}

const ICON = {
  NEEDS_REVIEW: Eye,
  PROCESSING: Loader2,
  QUEUED: Clock3,
  REVISION_REQUESTED: PenLine,
  BLOCKED: AlertTriangle,
  COMPLETED: CheckCircle2,
  DRAFT: CircleDashed,
  ARCHIVED: Archive,
}

export function toneClass(tone) {
  return TONE[tone] || TONE.draft
}

/** Status pill: always icon + text, never colour alone. */
export function StatusBadge({ status, className, label }) {
  const meta = STATUS_META[status] || STATUS_META.DRAFT
  const Icon = ICON[status] || CircleDashed
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold whitespace-nowrap',
        toneClass(meta.tone),
        className,
      )}
    >
      <Icon aria-hidden className={cn('size-3.5', status === 'PROCESSING' && 'motion-safe:animate-spin [animation-duration:2.4s]')} />
      {label || meta.label}
    </span>
  )
}

export function ToneBadge({ tone = 'draft', icon: Icon, children, className }) {
  return (
    <span className={cn('inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold whitespace-nowrap', toneClass(tone), className)}>
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </span>
  )
}

/** "H4 · Transcripts" style code + name. */
export function StageLabel({ stage, className, long = false }) {
  if (!stage || stage === 'DONE') return <span className={className}>All gates approved</span>
  const s = STATION_BY_ID[stage]
  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      <span className="font-semibold tabular text-foreground">{stage}</span>
      <span className="text-muted-foreground">{long ? s.long : s.name}</span>
    </span>
  )
}

export function GateCode({ gate, className }) {
  return (
    <span
      className={cn(
        'inline-flex h-8 min-w-10 items-center justify-center rounded-md border border-review-line/50 bg-review-bg px-1.5 font-serif text-sm font-semibold text-review tabular',
        className,
      )}
    >
      {gate}
    </span>
  )
}
