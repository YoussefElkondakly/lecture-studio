import { useEffect, useState } from 'react'
import { Archive, ArchiveRestore, BadgeCheck, CheckCircle2, Info, PackagePlus, PenLine, Plus, Shapes, Star } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/state/store.jsx'
import {
  SKILL_STATUS, archiveSkill, createSkill, mockImportSkill, restoreSkill, setDefaultSkills, updateSkill, verifySkill,
} from '@/engine/library.js'
import { dateTime } from '@/lib/format.js'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DemoTag, EmptyState, FormRow, PageHeader } from '@/components/app/common.jsx'
import { ToneBadge } from '@/components/app/status.jsx'

const ORIGIN = { web: 'Claude on the web — reference', api: 'API import (simulated)' }

function SkillDialog({ open, onOpenChange, skill }) {
  const { act } = useStore()
  const [f, setF] = useState({ title: '', description: '', dependencies: '' })
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) { setF({ title: skill?.title || '', description: skill?.description || '', dependencies: skill?.dependencies || '' }); setError('') }
  }, [open, skill])
  const save = () => {
    const r = skill ? act(updateSkill, skill.id, f) : act(createSkill, { ...f, origin: 'web' })
    if (!r.ok) return setError(r.error)
    toast.success(skill ? 'Skill updated' : 'Skill reference added', { description: skill ? undefined : 'Added as a web reference. Import and verify it before relying on it in automated jobs.' })
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{skill ? 'Edit Skill' : 'Add Skill reference'}</DialogTitle>
          <DialogDescription>Record a Skill you use in Claude. The prototype never stores Skill contents.</DialogDescription>
        </DialogHeader>
        <FormRow label="Name (as shown in Claude)" htmlFor="sk-title" required error={error}>
          <Input id="sk-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-invalid={Boolean(error) || undefined} />
        </FormRow>
        <FormRow label="What it does" htmlFor="sk-desc" optional>
          <Input id="sk-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </FormRow>
        <FormRow label="Known dependencies" htmlFor="sk-dep" optional help="For example: image generation, fonts, video tooling.">
          <Input id="sk-dep" value={f.dependencies} onChange={(e) => setF({ ...f, dependencies: e.target.value })} aria-describedby="sk-dep-help" />
        </FormRow>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{skill ? 'Save' : 'Add reference'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Skills() {
  const { state, act } = useStore()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const list = state.skills.filter((s) => showArchived || !s.archivedAt)
  const def = state.profile.defaultSkills

  const toggleDefault = (id, on) => {
    const ids = on ? [...new Set([...def.ids, id])] : def.ids.filter((x) => x !== id)
    act(setDefaultSkills, { ids, none: false })
  }

  return (
    <div>
      <PageHeader
        title="Claude Skills"
        description="Skills are separate from master prompts. You confirm which Skills to use — or none — at the H2 review of every lecture."
        actions={<Button onClick={() => setAdding(true)}><Plus data-icon="inline-start" /> Add Skill reference</Button>}
      />

      <Alert variant="info" className="mb-6">
        <Info aria-hidden />
        <AlertTitle>A Skill name from Claude on the web is not an API Skill</AlertTitle>
        <AlertDescription>
          Skills you use in the Claude website don’t automatically transfer to automated jobs. In V1 a permitted Skill bundle must be imported through the Anthropic API and verified. Here, import and verification are simulated — nothing is synchronised with Anthropic.
        </AlertDescription>
      </Alert>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Pre-selected at H2: {def.none ? 'NONE' : def.ids.length ? state.skills.filter((s) => def.ids.includes(s.id)).map((s) => s.title).join(', ') : 'nothing — you choose each time'}.
        </p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={def.none} onCheckedChange={(v) => act(setDefaultSkills, { ids: [], none: Boolean(v) })} /> Pre-select NONE</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={showArchived} onCheckedChange={setShowArchived} /> Show archived</label>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Shapes} title="No Skills recorded" description="Add the Skills you use in Claude, then import and verify them when V1 supports it. Choosing NONE at H2 is always possible." action={<Button onClick={() => setAdding(true)}><Plus data-icon="inline-start" /> Add Skill reference</Button>} />
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {list.map((s) => {
            const meta = SKILL_STATUS[s.status]
            const isDefault = !def.none && def.ids.includes(s.id)
            return (
              <li key={s.id} className={cn('flex flex-col rounded-xl border bg-surface', s.archivedAt && 'opacity-75')}>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{s.title}</h2>
                    <p className="text-sm text-muted-foreground">{s.description || 'No description'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.archivedAt && <ToneBadge tone="draft">Archived</ToneBadge>}
                    <ToneBadge tone={meta.tone} icon={s.status === 'api_ready' ? BadgeCheck : undefined}>{meta.label}</ToneBadge>
                  </div>
                </div>
                <dl className="grid flex-1 grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 px-5 py-4 text-sm">
                  <dt className="text-muted-foreground">Origin</dt><dd>{ORIGIN[s.origin]}</dd>
                  <dt className="text-muted-foreground">API Skill ID</dt><dd className="break-all">{s.providerSkillId ? <>{s.providerSkillId} · v{s.providerSkillVersion} <DemoTag /></> : 'None — reference only'}</dd>
                  <dt className="text-muted-foreground">Last verified</dt><dd>{s.verifiedAt ? `${dateTime(s.verifiedAt)} (simulated)` : 'Never'}</dd>
                  <dt className="text-muted-foreground">Dependencies</dt><dd>{s.dependencies || 'Unknown'}</dd>
                  <dt className="text-muted-foreground">Status</dt><dd>{meta.help}</dd>
                </dl>
                <div className="flex flex-wrap gap-2 border-t px-5 py-3">
                  {!s.archivedAt ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing(s)}><PenLine data-icon="inline-start" /> Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => { act(mockImportSkill, s.id); toast.success(s.providerSkillId ? 'New version imported (simulated)' : 'Imported (simulated)', { description: 'Verify it before relying on it.' }) }}>
                        <PackagePlus data-icon="inline-start" /> {s.providerSkillId ? 'Import new version' : 'Mock import'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { const r = act(verifySkill, s.id); r.ok ? toast.success('Verified (simulated)') : toast.error('Not verified', { description: r.error }) }}>
                        <CheckCircle2 data-icon="inline-start" /> Verify
                      </Button>
                      <Button size="sm" variant={isDefault ? 'secondary' : 'ghost'} onClick={() => toggleDefault(s.id, !isDefault)} aria-pressed={isDefault}>
                        <Star data-icon="inline-start" className={cn(isDefault && 'fill-current')} /> {isDefault ? 'Pre-selected at H2' : 'Pre-select at H2'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { act(archiveSkill, s.id); toast.success('Skill archived') }}><Archive data-icon="inline-start" /> Archive</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { act(restoreSkill, s.id); toast.success('Skill restored') }}><ArchiveRestore data-icon="inline-start" /> Restore</Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <SkillDialog open={adding || Boolean(editing)} onOpenChange={(o) => { if (!o) { setAdding(false); setEditing(null) } }} skill={editing} />
    </div>
  )
}
