import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, ArchiveRestore, Copy, FilePlus2, MoreHorizontal, Plus, Search, SearchX, X } from 'lucide-react'
import { toast } from 'sonner'
import { useNow, useStore } from '@/state/store.jsx'
import { STATUS } from '@/engine/constants.js'
import { archiveProject, duplicateProject, restoreProject } from '@/engine/workflow.js'
import { relativeTime } from '@/lib/format.js'
import { cn } from '@/lib/utils'
import { Button, ButtonLink } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog, EmptyState, NativeSelect, PageHeader } from '@/components/app/common.jsx'
import { StageLabel, StatusBadge } from '@/components/app/status.jsx'
import { GatePips } from '@/components/app/ProductionRail.jsx'

export const FILTERS = [
  { id: 'all', label: 'All', match: (p) => !p.archivedAt },
  { id: 'review', label: 'Needs review', match: (p) => !p.archivedAt && p.status === STATUS.NEEDS_REVIEW },
  { id: 'processing', label: 'Processing', match: (p) => !p.archivedAt && [STATUS.PROCESSING, STATUS.QUEUED, STATUS.REVISION_REQUESTED].includes(p.status) },
  { id: 'blocked', label: 'Action needed', match: (p) => !p.archivedAt && p.status === STATUS.BLOCKED },
  { id: 'completed', label: 'Completed', match: (p) => !p.archivedAt && p.status === STATUS.COMPLETED },
  { id: 'draft', label: 'Drafts', match: (p) => !p.archivedAt && p.status === STATUS.DRAFT },
  { id: 'archived', label: 'Archived', match: (p) => Boolean(p.archivedAt) },
]

const SORTS = [
  { id: 'updated', label: 'Last updated', fn: (a, b) => b.updatedAt - a.updatedAt },
  { id: 'created', label: 'Newest first', fn: (a, b) => b.createdAt - a.createdAt },
  { id: 'oldest', label: 'Oldest first', fn: (a, b) => a.createdAt - b.createdAt },
  { id: 'waiting', label: 'Waiting longest', fn: (a, b) => (a.waitingSince || Infinity) - (b.waitingSince || Infinity) },
  { id: 'title', label: 'Title A–Z', fn: (a, b) => a.title.localeCompare(b.title) },
]

export function primaryAction(p) {
  if (p.archivedAt) return { label: 'Open', to: `/lectures/${p.id}` }
  if (p.status === STATUS.NEEDS_REVIEW) return { label: 'Review', to: `/lectures/${p.id}/review/${p.stage}`, variant: 'accent' }
  if (p.status === STATUS.DRAFT) return { label: 'Resume', to: `/lectures/${p.id}` }
  if (p.status === STATUS.COMPLETED) return { label: 'Deliverables', to: `/lectures/${p.id}?tab=deliverables` }
  return { label: 'Open', to: `/lectures/${p.id}` }
}

function RowMenu({ p, onArchive }) {
  const { act } = useStore()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${p.title}`} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              const r = act(duplicateProject, p.id)
              if (r.ok) toast.success('Duplicated as a new draft', { description: 'Approvals are not copied.' })
            }}
          >
            <Copy /> Duplicate as new lecture
          </DropdownMenuItem>
          {p.archivedAt ? (
            <DropdownMenuItem onClick={() => { act(restoreProject, p.id); toast.success(`Restored ${p.title}`) }}>
              <ArchiveRestore /> Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onArchive(p)}>
              <Archive /> Archive…
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function Lectures() {
  const { state, act } = useStore()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const status = FILTERS.some((f) => f.id === params.get('status')) ? params.get('status') : 'all'
  const sort = SORTS.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'updated'
  const q = params.get('q') || ''
  const [archiving, setArchiving] = useState(null)

  const set = (key, value) => {
    const next = new URLSearchParams(params)
    if (!value || (key === 'status' && value === 'all') || (key === 'sort' && value === 'updated')) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const filter = FILTERS.find((f) => f.id === status)
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return state.projects
      .filter(filter.match)
      .filter((p) => !needle || p.title.toLowerCase().includes(needle) || p.source?.name?.toLowerCase().includes(needle))
      .sort(SORTS.find((s) => s.id === sort).fn)
  }, [state.projects, filter, q, sort])

  const total = state.projects.length
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, state.projects.filter(f.match).length]))

  return (
    <div>
      <PageHeader
        title="My lectures"
        description="Every lecture with its current stage. Lectures keep moving on their own between your reviews."
        actions={
          <ButtonLink as={Link} to="/lectures/new">
            <Plus data-icon="inline-start" /> Start new lecture
          </ButtonLink>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={FilePlus2}
          title="No lectures yet"
          description="Your lectures will be listed here with their stage, status and next action."
          action={<ButtonLink as={Link} to="/lectures/new"><Plus data-icon="inline-start" /> Start new lecture</ButtonLink>}
        />
      ) : (
        <>
          <div className="flex flex-col gap-4 rounded-t-xl border border-b-0 bg-surface px-4 py-4 md:px-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <label htmlFor="lecture-search" className="sr-only">Search lectures by name or source</label>
                <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="lecture-search"
                  type="search"
                  placeholder="Search by lecture name or source file"
                  value={q}
                  onChange={(e) => set('q', e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="lecture-sort" className="text-sm font-semibold whitespace-nowrap">Sort by</label>
                <NativeSelect id="lecture-sort" value={sort} onChange={(e) => set('sort', e.target.value)} className="w-48">
                  {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </NativeSelect>
              </div>
            </div>
            <div role="group" aria-label="Filter by status" className="-mx-1 flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={status === f.id}
                  onClick={() => set('status', f.id)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors',
                    status === f.id ? 'border-navy bg-navy text-white' : 'border-border bg-surface text-foreground hover:border-[#7c8ea3] hover:bg-subtle',
                  )}
                >
                  {f.label}
                  <span className={cn('tabular text-xs', status === f.id ? 'text-[#c5d3e0]' : 'text-muted-foreground')}>{counts[f.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-b-xl border bg-surface">
            <p className="sr-only" aria-live="polite">{rows.length} lectures shown</p>
            {rows.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={SearchX}
                  className="border-0"
                  title={q ? `No lectures match “${q}”` : `No ${filter.label.toLowerCase()} lectures`}
                  description="Try another search or show all lectures."
                  action={
                    <Button variant="outline" onClick={() => setParams({}, { replace: true })}>
                      <X data-icon="inline-start" /> Clear search and filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                {/* Table — tablet and desktop */}
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Lecture</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Updated</TableHead>
                      <TableHead className="pr-5 text-right"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((p) => {
                      const action = primaryAction(p)
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="max-w-[22rem] py-3.5 pl-5 whitespace-normal">
                            <Link to={`/lectures/${p.id}`} className="font-semibold underline-offset-4 hover:underline">{p.title}</Link>
                            <p className="text-sm text-muted-foreground">{p.prefs.audience} · {p.prefs.language} · {p.prefs.durationMin} min</p>
                          </TableCell>
                          <TableCell className="py-3.5 whitespace-normal">
                            {p.status === STATUS.DRAFT ? <span className="text-sm text-muted-foreground">Not started</span> : (
                              <div className="flex flex-col gap-1.5">
                                <StageLabel stage={p.stage} className="text-sm" />
                                <GatePips project={p} />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-3.5"><StatusBadge status={p.status} /></TableCell>
                          <TableCell className="hidden py-3.5 text-sm text-muted-foreground lg:table-cell">{relativeTime(p.updatedAt, now)}</TableCell>
                          <TableCell className="py-3.5 pr-5">
                            <div className="flex items-center justify-end gap-1">
                              <ButtonLink as={Link} to={action.to} size="sm" variant={action.variant || 'outline'}>{action.label}</ButtonLink>
                              <RowMenu p={p} onArchive={setArchiving} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                {/* Cards — phone */}
                <ul className="divide-y md:hidden">
                  {rows.map((p) => {
                    const action = primaryAction(p)
                    return (
                      <li key={p.id} className="flex flex-col gap-2 px-4 py-4">
                        <div className="flex items-start justify-between gap-2">
                          <Link to={`/lectures/${p.id}`} className="font-semibold underline-offset-4 hover:underline">{p.title}</Link>
                          <RowMenu p={p} onArchive={setArchiving} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={p.status} />
                          {p.status !== STATUS.DRAFT && <StageLabel stage={p.stage} className="text-sm" />}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground">Updated {relativeTime(p.updatedAt, now)}</span>
                          <ButtonLink as={Link} to={action.to} size="sm" variant={action.variant || 'outline'}>{action.label}</ButtonLink>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(o) => !o && setArchiving(null)}
        title="Archive this lecture?"
        description={archiving ? `“${archiving.title}” will move to Archived. Running simulated jobs stop. Files, versions and approval history are kept, and you can restore it later.` : ''}
        confirmLabel="Archive lecture"
        destructive
        onConfirm={() => {
          act(archiveProject, archiving.id)
          toast.success(`Archived ${archiving.title}`)
          setArchiving(null)
        }}
      />
    </div>
  )
}
