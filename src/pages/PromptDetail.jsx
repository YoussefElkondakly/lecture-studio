import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Archive, ArchiveRestore, Copy, FileQuestion, PenLine, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/state/store.jsx'
import { PROMPT_STAGES } from '@/engine/constants.js'
import { archivePrompt, deletePrompt, duplicatePrompt, promptUsage, restorePrompt, setStageDefault } from '@/engine/library.js'
import { dateTime } from '@/lib/format.js'
import { cn } from '@/lib/utils'
import { Button, ButtonLink } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog, EmptyState, PageHeader, Panel } from '@/components/app/common.jsx'
import { ToneBadge } from '@/components/app/status.jsx'
import { PromptEditorDialog, StageChips } from '@/components/app/libraryDialogs.jsx'

export default function PromptDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { state, act } = useStore()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const prompt = state.prompts.find((p) => p.id === id)

  if (!prompt) {
    return <EmptyState icon={FileQuestion} title="Prompt not found" description="It may have been deleted." action={<ButtonLink as={Link} to="/prompts">Back to Master prompts</ButtonLink>} />
  }

  const versions = state.promptVersions.filter((v) => v.promptId === id).sort((a, b) => b.version - a.version)
  const active = versions.find((v) => v.id === prompt.activeVersionId)
  const shownId = params.get('version') && versions.some((v) => v.id === params.get('version')) ? params.get('version') : active.id
  const shown = versions.find((v) => v.id === shownId)
  const cat = state.categories.find((c) => c.id === prompt.categoryId)
  const usage = promptUsage(state, id)
  const compatibleStages = cat && !cat.archivedAt ? cat.stageIds : []
  const defaults = Object.entries(state.profile.stageDefaults).filter(([, pid]) => pid === id).map(([s]) => s)

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Master prompts', to: '/prompts' }, { label: prompt.title }]}
        title={prompt.title}
        description={prompt.description || undefined}
        actions={
          <>
            {!prompt.archivedAt && <Button onClick={() => setEditing(true)}><PenLine data-icon="inline-start" /> Edit</Button>}
            <Button variant="outline" onClick={() => { const r = act(duplicatePrompt, id); if (r.ok) { toast.success('Duplicated'); navigate(`/prompts/${r.id}`) } else toast.error(r.error) }}>
              <Copy data-icon="inline-start" /> Duplicate
            </Button>
            {prompt.archivedAt ? (
              <Button variant="outline" onClick={() => { const r = act(restorePrompt, id); r.ok ? toast.success('Prompt restored') : toast.error(r.error) }}><ArchiveRestore data-icon="inline-start" /> Restore</Button>
            ) : (
              <Button variant="outline" onClick={() => { act(archivePrompt, id); toast.success('Prompt archived', { description: 'Lectures that used it keep their versions.' }) }}><Archive data-icon="inline-start" /> Archive</Button>
            )}
            {!usage.used && (
              <Button variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 data-icon="inline-start" /> Delete
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {prompt.archivedAt && (
            <Alert variant="warning"><AlertTitle>Archived</AlertTitle><AlertDescription>It is hidden from prompt pickers. Restore it to use it again.</AlertDescription></Alert>
          )}
          {shown.id !== active.id && (
            <Alert variant="info">
              <AlertTitle>Viewing version {shown.version} (read-only)</AlertTitle>
              <AlertDescription>
                The current version is {active.version}. Older versions stay exactly as lectures used them.{' '}
                <button type="button" className="font-semibold underline" onClick={() => setParams({}, { replace: true })}>Show current version</button>
              </AlertDescription>
            </Alert>
          )}
          <Panel
            title={`Version ${shown.version}${shown.id === active.id ? ' — current' : ''}`}
            description={`${shown.note} · ${dateTime(shown.createdAt)} · category at the time: ${shown.categorySnapshot?.name || '—'}`}
          >
            <pre className="overflow-x-auto font-serif text-[1rem] leading-relaxed whitespace-pre-wrap text-foreground">{shown.body}</pre>
          </Panel>
        </div>
        <aside className="flex flex-col gap-6">
          <Panel title="Where it can be used">
            <p className="text-sm">Category: <span className="font-semibold">{cat?.name}</span>{cat?.archivedAt ? ' (archived)' : ''}</p>
            <StageChips stageIds={cat?.stageIds} className="mt-2" />
            {compatibleStages.length > 0 && !prompt.archivedAt && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-sm font-semibold">Saved default</p>
                {compatibleStages.map((s) => {
                  const on = defaults.includes(s)
                  return (
                    <Button key={s} size="sm" variant={on ? 'secondary' : 'outline'} onClick={() => { act(setStageDefault, s, on ? null : id); toast.success(on ? 'Default removed' : `Default for ${PROMPT_STAGES.find((x) => x.id === s).label}`) }}>
                      <Star data-icon="inline-start" className={cn(on && 'fill-current')} /> {on ? `Default for ${s}` : `Make default for ${s}`}
                    </Button>
                  )
                })}
              </div>
            )}
          </Panel>
          <Panel title="Version history">
            <ol className="flex flex-col">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setParams(v.id === active.id ? {} : { version: v.id }, { replace: true })}
                    aria-current={v.id === shown.id ? 'true' : undefined}
                    className={cn('flex w-full items-start gap-3 rounded-md px-2 py-2 text-left text-sm', v.id === shown.id ? 'bg-navy-tint' : 'hover:bg-subtle')}
                  >
                    <span className="w-8 font-serif font-semibold tabular">v{v.version}</span>
                    <span className="min-w-0">
                      <span className="block">{v.note}</span>
                      <span className="block text-xs text-muted-foreground">{dateTime(v.createdAt)}</span>
                    </span>
                    {v.id === active.id && <ToneBadge tone="processing" className="ml-auto">Current</ToneBadge>}
                  </button>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Used by lectures">
            {usage.projects.length === 0 ? <p className="text-sm text-muted-foreground">Not used yet. It can be deleted.</p> : (
              <>
              <p className="mb-2 text-sm text-muted-foreground">Used prompts can’t be deleted — archive instead, so these lectures stay reproducible.</p>
              <ul className="flex flex-col gap-2">
                {usage.projects.map((p) => {
                  const ref = Object.values(p.promptRefs).find((r) => r && r.promptId === id)
                  return (
                    <li key={p.id} className="text-sm">
                      <Link to={`/lectures/${p.id}?tab=setup`} className="font-semibold underline-offset-4 hover:underline">{p.title}</Link>
                      <span className="text-muted-foreground"> — uses v{ref.version}</span>
                    </li>
                  )
                })}
              </ul>
              </>
            )}
          </Panel>
        </aside>
      </div>

      <PromptEditorDialog open={editing} onOpenChange={setEditing} prompt={prompt} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this prompt permanently?"
        description="It has never been used by a lecture, so it can be deleted. This cannot be undone."
        confirmLabel="Delete prompt"
        destructive
        onConfirm={() => { const r = act(deletePrompt, id); setDeleting(false); if (r.ok) { toast.success('Prompt deleted'); navigate('/prompts') } else toast.error(r.error) }}
      />
    </div>
  )
}
