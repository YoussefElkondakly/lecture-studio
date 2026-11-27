import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FolderCog, Plus, ScrollText, Search, SearchX, Star } from 'lucide-react'
import { useStore } from '@/state/store.jsx'
import { PROMPT_STAGES } from '@/engine/constants.js'
import { promptUsage } from '@/engine/library.js'
import { dateTime } from '@/lib/format.js'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState, NativeSelect, PageHeader } from '@/components/app/common.jsx'
import { ToneBadge } from '@/components/app/status.jsx'
import { CategoryManagerDialog, PromptEditorDialog, StageChips } from '@/components/app/libraryDialogs.jsx'

export default function Prompts() {
  const { state } = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [editorOpen, setEditorOpen] = useState(false)
  const [catsOpen, setCatsOpen] = useState(false)
  const q = params.get('q') || ''
  const cat = params.get('category') || 'all'
  const stage = params.get('stage') || 'all'
  const showArchived = params.get('archived') === '1'

  const set = (k, v) => {
    const next = new URLSearchParams(params)
    if (!v || v === 'all' || v === '0') next.delete(k)
    else next.set(k, v)
    setParams(next, { replace: true })
  }

  const catById = Object.fromEntries(state.categories.map((c) => [c.id, c]))
  const defaultsFor = (id) => Object.entries(state.profile.stageDefaults).filter(([, pid]) => pid === id).map(([s]) => s)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return state.prompts
      .filter((p) => (showArchived ? true : !p.archivedAt))
      .filter((p) => cat === 'all' || p.categoryId === cat)
      .filter((p) => stage === 'all' || (stage === 'none' ? !catById[p.categoryId]?.stageIds.length : catById[p.categoryId]?.stageIds.includes(stage)))
      .filter((p) => {
        if (!needle) return true
        const v = state.promptVersions.find((x) => x.id === p.activeVersionId)
        return [p.title, p.description, p.tags.join(' '), v?.body].join(' ').toLowerCase().includes(needle)
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [state, q, cat, stage, showArchived, catById])

  const activeCats = state.categories.filter((c) => !c.archivedAt)

  return (
    <div>
      <PageHeader
        title="Master prompts"
        description="Reusable prompts grouped by category. Each category maps to the workflow stages where its prompts can be chosen. Every edit creates a new version; lectures keep the version they used."
        actions={
          <>
            <Button variant="outline" onClick={() => setCatsOpen(true)}><FolderCog data-icon="inline-start" /> Manage categories</Button>
            <Button onClick={() => setEditorOpen(true)}><Plus data-icon="inline-start" /> New prompt</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Prompt categories" className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Categories</h2>
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {[{ id: 'all', name: 'All prompts', stageIds: null }, ...activeCats].map((c) => {
              const n = c.id === 'all' ? state.prompts.filter((p) => !p.archivedAt).length : state.prompts.filter((p) => p.categoryId === c.id && !p.archivedAt).length
              const on = cat === c.id
              return (
                <li key={c.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={on ? 'true' : undefined}
                    onClick={() => set('category', c.id)}
                    className={cn('flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors', on ? 'bg-navy text-white' : 'hover:bg-subtle')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.name}</span>
                      {c.stageIds && <span className={cn('block text-xs', on ? 'text-[#c5d3e0]' : 'text-muted-foreground')}>{c.stageIds.length ? `Stage ${c.stageIds.join(', ')}` : 'Library only'}</span>}
                    </span>
                    <span className={cn('text-xs tabular', on ? 'text-[#c5d3e0]' : 'text-muted-foreground')}>{n}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-surface p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <label htmlFor="prompt-search" className="sr-only">Search prompts</label>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="prompt-search" type="search" className="pl-9" placeholder="Search title, tags or prompt text" value={q} onChange={(e) => set('q', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="stage-filter" className="text-sm font-semibold whitespace-nowrap">Stage</label>
              <NativeSelect id="stage-filter" className="w-52" value={stage} onChange={(e) => set('stage', e.target.value)}>
                <option value="all">All stages</option>
                {PROMPT_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                <option value="none">Library only (unmapped)</option>
              </NativeSelect>
            </div>
            <label className="flex items-center gap-2 text-sm whitespace-nowrap">
              <Checkbox checked={showArchived} onCheckedChange={(v) => set('archived', v ? '1' : '0')} /> Show archived
            </label>
          </div>

          {state.prompts.length === 0 ? (
            <EmptyState icon={ScrollText} title="No prompts yet" description="Add your first master prompt. Choose a category so it appears at the right workflow stage." action={<Button onClick={() => setEditorOpen(true)}><Plus data-icon="inline-start" /> New prompt</Button>} />
          ) : rows.length === 0 ? (
            <EmptyState icon={SearchX} title="No prompts match" description="Try a different search, stage or category." action={<Button variant="outline" onClick={() => setParams({}, { replace: true })}>Clear filters</Button>} />
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((p) => {
                const v = state.promptVersions.find((x) => x.id === p.activeVersionId)
                const c = catById[p.categoryId]
                const used = promptUsage(state, p.id).projects.length
                const defs = defaultsFor(p.id)
                return (
                  <li key={p.id}>
                    <Link to={`/prompts/${p.id}`} className={cn('block rounded-xl border bg-surface px-5 py-4 transition-colors hover:border-[#7c8ea3] hover:bg-[#fbfcfd]', p.archivedAt && 'opacity-75')}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{p.title}</p>
                          <p className="text-sm text-muted-foreground">{c?.name}{c?.archivedAt ? ' (archived category)' : ''} · v{v.version} · updated {dateTime(p.updatedAt)} · used by {used} lecture{used === 1 ? '' : 's'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {p.archivedAt && <ToneBadge tone="draft">Archived</ToneBadge>}
                          {defs.length > 0 && <ToneBadge tone="completed" icon={Star}>Default for {defs.join(', ')}</ToneBadge>}
                          <StageChips stageIds={c?.stageIds} />
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 font-serif text-[0.95rem] text-foreground/85">{v.body.replace(/^FICTIONAL EXAMPLE PROMPT[^\n]*\n+/, '')}</p>
                      {p.tags.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Tags: {p.tags.join(', ')}</p>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <PromptEditorDialog open={editorOpen} onOpenChange={setEditorOpen} onSaved={(id) => navigate(`/prompts/${id}`)} />
      <CategoryManagerDialog open={catsOpen} onOpenChange={setCatsOpen} />
    </div>
  )
}
