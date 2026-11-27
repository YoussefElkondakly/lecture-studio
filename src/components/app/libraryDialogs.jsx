import { useEffect, useState } from 'react'
import { Archive, ArchiveRestore, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/state/store.jsx'
import { PROMPT_STAGES } from '@/engine/constants.js'
import {
  archiveCategory, categoryReferences, createCategory, createPrompt, deleteCategory, editPrompt, restoreCategory, updateCategory,
} from '@/engine/library.js'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog, FormRow, NativeSelect, describedBy } from './common.jsx'

export function StageChips({ stageIds, className }) {
  if (!stageIds?.length) return <span className={cn('inline-flex h-6 items-center rounded-sm border border-dashed border-[#7c8ea3] px-1.5 text-xs font-semibold text-muted-foreground', className)}>Library only</span>
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      {stageIds.map((s) => (
        <span key={s} className="inline-flex h-6 items-center rounded-sm bg-navy-tint px-1.5 text-xs font-semibold text-navy" title={PROMPT_STAGES.find((x) => x.id === s)?.label}>
          {s}
        </span>
      ))}
    </span>
  )
}

function StageCheckboxes({ value, onChange, idPrefix }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">Use at workflow stages</legend>
      <p className="mb-2 text-sm text-muted-foreground">Map to existing stages only. Leave all unticked for a library-only category. Categories never create new stages.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PROMPT_STAGES.map((s) => (
          <label key={s.id} htmlFor={`${idPrefix}-${s.id}`} className="flex min-h-10 items-center gap-2.5 rounded-md border px-3 text-sm">
            <Checkbox id={`${idPrefix}-${s.id}`} checked={value.includes(s.id)} onCheckedChange={(v) => onChange(v ? [...value, s.id] : value.filter((x) => x !== s.id))} />
            {s.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Create or edit a single category. */
export function CategoryFormDialog({ open, onOpenChange, category, onSaved }) {
  const { act } = useStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [stageIds, setStageIds] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setName(category?.name || '')
      setDescription(category?.description || '')
      setStageIds(category?.stageIds || [])
      setError('')
    }
  }, [open, category])
  const save = () => {
    const r = category ? act(updateCategory, category.id, { name, description, stageIds }) : act(createCategory, { name, description, stageIds })
    if (!r.ok) return setError(r.error)
    toast.success(category ? 'Category saved' : `Category “${name.trim()}” created`)
    onSaved?.(category?.id || r.id)
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit category' : 'Create category'}</DialogTitle>
          <DialogDescription>Categories group your prompts and decide where they can be chosen.{category ? ' Renaming never changes lecture history.' : ''}</DialogDescription>
        </DialogHeader>
        <FormRow label="Name" htmlFor="cat-name" required error={error}>
          <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy('cat-name', { error })} />
        </FormRow>
        <FormRow label="Description" htmlFor="cat-desc" optional>
          <Input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormRow>
        <StageCheckboxes value={stageIds} onChange={setStageIds} idPrefix="cat-stage" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{category ? 'Save category' : 'Create category'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** List, archive/restore, delete (only unreferenced) and edit categories. */
export function CategoryManagerDialog({ open, onOpenChange }) {
  const { state, act } = useStore()
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [archiving, setArchiving] = useState(null)
  const [reassignTo, setReassignTo] = useState('')
  const [deleting, setDeleting] = useState(null)
  const active = state.categories.filter((c) => !c.archivedAt)
  const archived = state.categories.filter((c) => c.archivedAt)
  const activePromptCount = (id) => state.prompts.filter((p) => p.categoryId === id && !p.archivedAt).length

  const doArchive = () => {
    const r = act(archiveCategory, archiving.id, { reassignTo: reassignTo || undefined })
    if (!r.ok) return toast.error(r.error)
    toast.success(`Archived “${archiving.name}”${r.moved ? ` and moved ${r.moved} prompt${r.moved === 1 ? '' : 's'}` : ''}`)
    setArchiving(null)
  }

  const Row = ({ c }) => {
    const refs = categoryReferences(state, c.id)
    const n = activePromptCount(c.id)
    return (
      <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
        <div className="min-w-0 flex-1 basis-48">
          <p className="font-semibold">{c.name}</p>
          <p className="text-sm text-muted-foreground">{n} active prompt{n === 1 ? '' : 's'}{c.description ? ` · ${c.description}` : ''}</p>
        </div>
        <StageChips stageIds={c.stageIds} />
        <div className="flex gap-1">
          {!c.archivedAt ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(c)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => { setArchiving(c); setReassignTo('') }}><Archive data-icon="inline-start" /> Archive</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => { const r = act(restoreCategory, c.id); r.ok ? toast.success('Category restored') : toast.error(r.error) }}><ArchiveRestore data-icon="inline-start" /> Restore</Button>
          )}
          {refs.total > 0 ? (
            <span className="inline-flex h-9 items-center px-2 text-xs text-muted-foreground">In use — archive instead</span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete ${c.name}`}
              onClick={() => setDeleting(c)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </li>
    )
  }

  return (
    <>
      <Dialog open={open && !editing && !creating && !archiving && !deleting} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prompt categories</DialogTitle>
            <DialogDescription>Rename, remap or archive categories. Lecture history keeps the category name and prompt version it used.</DialogDescription>
          </DialogHeader>
          <ul className="divide-y">{active.map((c) => <Row key={c.id} c={c} />)}</ul>
          {archived.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-muted-foreground">Archived</h3>
              <ul className="divide-y">{archived.map((c) => <Row key={c.id} c={c} />)}</ul>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(true)}><Plus data-icon="inline-start" /> Create category</Button>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name}” permanently?`}
        description="It has no prompts and no lecture history, so it can be deleted. This cannot be undone."
        confirmLabel="Delete category"
        destructive
        onConfirm={() => {
          const r = act(deleteCategory, deleting.id)
          r.ok ? toast.success('Category deleted') : toast.error(r.error)
          setDeleting(null)
        }}
      />
      <CategoryFormDialog open={Boolean(editing) || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false) } }} category={editing} />
      <Dialog open={Boolean(archiving)} onOpenChange={(o) => !o && setArchiving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive “{archiving?.name}”?</DialogTitle>
            <DialogDescription>
              Archived categories disappear from prompt pickers. Lectures that already used its prompts keep their exact snapshots.
            </DialogDescription>
          </DialogHeader>
          {archiving && activePromptCount(archiving.id) > 0 && (
            <FormRow label={`Move its ${activePromptCount(archiving.id)} active prompt(s) to`} htmlFor="reassign" help="Optional. If you don’t move them, they stay in the archived category and can’t be selected until you restore it.">
              <NativeSelect id="reassign" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                <option value="">Don’t move — keep them in the archived category</option>
                {active.filter((c) => c.id !== archiving.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </FormRow>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiving(null)}>Cancel</Button>
            <Button onClick={doArchive}>Archive category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Create a prompt, or edit one (material edits create a new immutable version). */
export function PromptEditorDialog({ open, onOpenChange, prompt, onSaved }) {
  const { state, act } = useStore()
  const active = prompt && state.promptVersions.find((v) => v.id === prompt.activeVersionId)
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState('')
  const [catOpen, setCatOpen] = useState(false)
  useEffect(() => {
    if (open) {
      setForm({
        title: prompt?.title || '', categoryId: prompt?.categoryId || '', description: prompt?.description || '',
        tags: (prompt?.tags || []).join(', '), body: active?.body || '', note: '',
      })
      setErrors('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prompt?.id])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))
  const cats = state.categories.filter((c) => !c.archivedAt)

  const save = () => {
    const r = prompt ? act(editPrompt, prompt.id, form) : act(createPrompt, form)
    if (!r.ok) return setErrors(r.error)
    if (prompt) toast.success(r.newVersion ? `Saved as version ${r.newVersion}` : 'Details saved', { description: r.newVersion ? 'Lectures that used earlier versions keep them.' : 'Title, category and text unchanged — no new version needed.' })
    else toast.success(`Prompt “${form.title.trim()}” created`)
    onSaved?.(prompt?.id || r.id)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open && !catOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{prompt ? `Edit “${prompt.title}”` : 'New master prompt'}</DialogTitle>
            <DialogDescription>
              {prompt ? `Currently version ${active?.version}. Changing the title, category or text saves version ${(active?.version || 0) + 1}; earlier versions stay read-only.` : 'Title, category and prompt text are required.'}
            </DialogDescription>
          </DialogHeader>
          {errors && <Alert variant="destructive"><AlertDescription>{errors}</AlertDescription></Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Title" htmlFor="p-title" required className="sm:col-span-2">
              <Input id="p-title" value={form.title || ''} onChange={set('title')} />
            </FormRow>
            <FormRow label="Category" htmlFor="p-cat" required>
              <NativeSelect
                id="p-cat"
                value={form.categoryId || ''}
                onChange={(e) => (e.target.value === '__new' ? setCatOpen(true) : set('categoryId')(e))}
              >
                <option value="">Choose a category…</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.stageIds.length ? ` (${c.stageIds.join(', ')})` : ' (library only)'}</option>)}
                <option value="__new">+ Create category…</option>
              </NativeSelect>
            </FormRow>
            <FormRow label="Tags" htmlFor="p-tags" optional help="Comma separated">
              <Input id="p-tags" value={form.tags || ''} onChange={set('tags')} aria-describedby="p-tags-help" />
            </FormRow>
            <FormRow label="Description" htmlFor="p-desc" optional className="sm:col-span-2">
              <Input id="p-desc" value={form.description || ''} onChange={set('description')} />
            </FormRow>
            <FormRow label="Prompt text" htmlFor="p-body" required className="sm:col-span-2" help="Use placeholders like {{AUDIENCE}} or {{LANGUAGE}}; the system fills them from the lecture.">
              <Textarea id="p-body" rows={12} value={form.body || ''} onChange={set('body')} className="font-mono text-[0.9rem]" aria-describedby="p-body-help" />
            </FormRow>
            {prompt && (
              <FormRow label="What changed?" htmlFor="p-note" optional className="sm:col-span-2">
                <Input id="p-note" value={form.note || ''} onChange={set('note')} placeholder="Shown in version history" />
              </FormRow>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save}>{prompt ? 'Save' : 'Create prompt'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CategoryFormDialog open={catOpen} onOpenChange={setCatOpen} onSaved={(id) => setForm((f) => ({ ...f, categoryId: id }))} />
    </>
  )
}
