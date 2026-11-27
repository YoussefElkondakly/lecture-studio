import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, Check, CheckCircle2, Columns2, Download, FileText, Info, PanelLeftClose, PenLine, Save, ShieldCheck, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/state/store.jsx'
import { CHUNK_MAX_S, CHUNK_MIN_S } from '@/engine/constants.js'
import { SKILL_STATUS } from '@/engine/library.js'
import {
  audioSampleFor, estimateSeconds, isArabic, pronunciationGuide, renderReport, sourceExcerpt, wordCount,
} from '@/engine/content.js'
import { currentAudio, currentTranscripts, editContent, editStoryboard, editTranscript, timingExceptions } from '@/engine/workflow.js'
import { last } from '@/engine/util.js'
import { dateTime, seconds } from '@/lib/format.js'
import { canRenderPdf } from '@/lib/pdf.js'
import { chunkManifest } from '@/lib/exports.js'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Markdown } from '@/components/app/Markdown.jsx'
import { DraftFrame } from '@/components/app/DraftFrame.jsx'
import { PromptPicker } from '@/components/app/PromptPicker.jsx'
import { DemoTag, InlineError, Panel, confirmDiscard, useUnsavedGuard } from '@/components/app/common.jsx'
import { ToneBadge } from '@/components/app/status.jsx'
import { downloadContentPdf } from '@/pages/lecture/Tabs.jsx'

function SectionTitle({ children, aside }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 className="text-lg font-semibold">{children}</h2>
      {aside}
    </div>
  )
}

function useEditResult(onSaved, setError) {
  return (r, success) => {
    if (r.ok) {
      setError('')
      toast.success(success)
      onSaved?.()
    } else setError(r.error)
  }
}

// ------------------------------------------------------------------------------------- H1

function PdfPreview({ project, content }) {
  const rtl = isArabic(project)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>doctor_review.pdf — rendered from canonical text r{content.version} {content.pdf.renderedAt ? `on ${dateTime(content.pdf.renderedAt)}` : ''}</span>
        <Button size="sm" variant="outline" disabled={!canRenderPdf(content.md)} onClick={() => downloadContentPdf(project, content)}>
          <Download data-icon="inline-start" /> Download PDF
        </Button>
      </div>
      {!canRenderPdf(content.md) && (
        <p className="text-sm text-muted-foreground">PDF download for Arabic needs an embedded Arabic font — planned for V1. The preview below shows the exact paired text.</p>
      )}
      <div className="rounded-lg bg-[#e6ebf1] p-3 sm:p-6">
        <article className="pdf-page mx-auto max-w-[44rem] px-6 py-8 sm:px-12 sm:py-12" aria-label={`PDF preview, revision r${content.version}`}>
          <Markdown md={content.md} rtl={rtl} className="max-w-none text-[0.95rem]" />
          <p className="mt-8 border-t pt-2 text-center font-sans text-xs text-muted-foreground">
            {project.title} · doctor_review.pdf · r{content.version} · synthetic prototype output
          </p>
        </article>
      </div>
    </div>
  )
}

export function H1Review({ project, fp, extras, setExtras, onEdited }) {
  const { act } = useStore()
  const a = project.artifacts
  const content = last(a.content)
  const previous = a.content.length > 1 ? a.content[a.content.length - 2] : null
  const rtl = isArabic(project)
  const [view, setView] = useState('text')
  // Side-by-side on wide screens; below 1600 px the draft comes first and the source opens on demand.
  const [showSource, setShowSource] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 1600px)').matches)
  const [editing, setEditing] = useState(false)
  const [draftMd, setDraftMd] = useState(content.md)
  const [editNote, setEditNote] = useState('')
  const [highlight, setHighlight] = useState(true)
  const [editError, setEditError] = useState('')
  const src = sourceExcerpt(project)
  const done = useEditResult(onEdited, setEditError)
  const dirty = editing && (draftMd !== content.md || editNote.trim() !== '')
  useUnsavedGuard(dirty)

  const save = () => {
    const r = act(editContent, { projectId: project.id, fp, md: draftMd, note: editNote })
    done(r, `Saved canonical text r${content.version + 1}. The paired PDF is being re-rendered.`)
    if (r.ok) setEditing(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {previous && (
        <Alert variant="info">
          <Info aria-hidden />
          <AlertTitle>Revision r{content.version} — {content.producer === 'doctor' ? 'your direct edit' : 'AI revision'}</AlertTitle>
          <AlertDescription>
            {content.note}. Revision r{previous.version}{project.rejectedKeys.includes(previous.id) ? ' had changes requested and can no longer be approved' : ' is superseded'}.
            {' '}Changed lines are highlighted and marked “(changed)”.
          </AlertDescription>
        </Alert>
      )}

      <div className={cn('grid grid-cols-1 gap-6', showSource && !editing && 'min-[1400px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]')}>
        {showSource && !editing && (
          <section aria-labelledby="src-h" className="min-w-0 rounded-xl border bg-surface">
            <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
              <h2 id="src-h" className="text-base font-semibold">Original source</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowSource(false)}><PanelLeftClose data-icon="inline-start" /> Hide</Button>
            </div>
            <div className="px-5 py-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><FileText aria-hidden className="size-4" /> {src.title} <span className="font-normal text-muted-foreground">· {src.pages} pages</span></p>
              <div className="mt-3 flex flex-col gap-3 font-serif text-[0.975rem] leading-relaxed">
                {src.blocks.map((b, i) => <p key={i} className="border-l-2 border-border pl-3">{b}</p>)}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Synthetic excerpt shown for comparison. The real product shows the uploaded file.</p>
            </div>
          </section>
        )}

        <section aria-labelledby="draft-h" className="min-w-0 rounded-xl border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
            <h2 id="draft-h" className="text-base font-semibold">{editing ? `Editing canonical text (will become r${content.version + 1})` : `Draft r${content.version}`}</h2>
            {!editing && (
              <div className="flex flex-wrap items-center gap-2">
                {!showSource && <Button size="sm" variant="ghost" onClick={() => setShowSource(true)}><Columns2 data-icon="inline-start" /> Show source</Button>}
                <div role="group" aria-label="Document view" className="inline-flex rounded-md border p-0.5">
                  {[['text', 'Canonical text'], ['pdf', 'Paired PDF']].map(([v, l]) => (
                    <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
                      className={cn('h-8 rounded-[5px] px-3 text-sm font-semibold', view === v ? 'bg-navy text-white' : 'text-foreground hover:bg-subtle')}>
                      {l}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => { setDraftMd(content.md); setEditing(true) }}>
                  <PenLine data-icon="inline-start" /> Edit text
                </Button>
              </div>
            )}
          </div>
          <div className="px-5 py-5">
            {editing ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Edit the canonical Markdown. Saving creates revision r{content.version + 1}, re-renders the paired PDF from it and asks you to review the new revision. The PDF is never edited separately.
                </p>
                <label htmlFor="md-editor" className="sr-only">Canonical lecture text (Markdown)</label>
                <Textarea
                  id="md-editor"
                  value={draftMd}
                  onChange={(e) => setDraftMd(e.target.value)}
                  rows={22}
                  dir={rtl ? 'auto' : undefined}
                  className="font-mono text-[0.9rem] leading-relaxed"
                />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-note" className="text-sm font-semibold">What did you change? <span className="font-normal text-muted-foreground">Optional — kept in the change log</span></label>
                  <Input id="edit-note" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="For example: corrected the warning signs wording" />
                </div>
                <InlineError>{editError}</InlineError>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={save}><Save data-icon="inline-start" /> Save new revision</Button>
                  <Button variant="ghost" onClick={() => { if (confirmDiscard(dirty)) { setEditing(false); setEditError('') } }}><X data-icon="inline-start" /> Cancel</Button>
                </div>
              </div>
            ) : view === 'text' ? (
              <>
                {previous && (
                  <label className="mb-4 flex items-center gap-2 text-sm">
                    <Checkbox checked={highlight} onCheckedChange={setHighlight} /> Highlight changes since r{previous.version}
                  </label>
                )}
                <Markdown md={content.md} previous={previous?.md} highlight={highlight} rtl={rtl} />
              </>
            ) : (
              <PdfPreview project={project} content={content} />
            )}
          </div>
        </section>
      </div>

    </div>
  )
}

export function ConfirmBox({ id, checked, onChange, label, help }) {
  return (
    <div className={cn('rounded-xl border px-5 py-4', checked ? 'border-completed/30 bg-completed-bg/60' : 'bg-surface')}>
      <div className="flex items-start gap-3">
        <Checkbox id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" aria-describedby={help ? `${id}-help` : undefined} />
        <div>
          <label htmlFor={id} className="text-base font-semibold">{label}</label>
          {help && <p id={`${id}-help`} className="mt-0.5 text-sm text-muted-foreground">{help}</p>}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------- H2

export function H2Review({ project, extras, setExtras }) {
  const { state } = useStore()
  const content = last(project.artifacts.content)
  const skills = state.skills.filter((s) => !s.archivedAt)
  const sel = extras.skills || { ids: [], none: false }
  const toggle = (id, on) => setExtras((x) => {
    const cur = x.skills || { ids: [], none: false }
    const ids = on ? [...new Set([...cur.ids, id])] : cur.ids.filter((i) => i !== id)
    return { ...x, skills: { ids, none: false } }
  })
  const unverified = sel.none ? [] : skills.filter((s) => sel.ids.includes(s.id) && s.status !== 'api_ready')
  const h1 = project.approvals.H1

  return (
    <div className="flex flex-col gap-6">
      <Alert variant="success">
        <ShieldCheck aria-hidden />
        <AlertTitle>Medical content r{content.version} approved</AlertTitle>
        <AlertDescription>You approved it {h1 ? dateTime(h1.at) : ''}. The storyboard and visuals will use only this approved text.</AlertDescription>
      </Alert>

      <Panel title="Claude Skills for storyboard and visuals" description="Confirm the exact Skills to use, or none. A Skill name from Claude on the web is not proof that it can run through the API.">
        <fieldset>
          <legend className="sr-only">Skills to use</legend>
          <ul className="flex flex-col gap-2">
            {skills.map((s) => {
              const checked = !sel.none && sel.ids.includes(s.id)
              const meta = SKILL_STATUS[s.status]
              return (
                <li key={s.id}>
                  <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3', checked ? 'border-navy bg-navy-tint' : 'hover:bg-subtle')}>
                    <Checkbox checked={checked} onCheckedChange={(v) => toggle(s.id, v)} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{s.title}</span>
                        <ToneBadge tone={meta.tone} icon={s.status === 'api_ready' ? CheckCircle2 : AlertTriangle}>{meta.label}</ToneBadge>
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{s.description}</span>
                      {s.providerSkillId && <span className="mt-0.5 block text-xs text-muted-foreground">API ID {s.providerSkillId} · version {s.providerSkillVersion} (simulated)</span>}
                    </span>
                  </label>
                </li>
              )
            })}
            <li>
              <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3', sel.none ? 'border-navy bg-navy-tint' : 'hover:bg-subtle')}>
                <Checkbox checked={sel.none} onCheckedChange={(v) => setExtras((x) => ({ ...x, skills: { ids: [], none: Boolean(v) } }))} className="mt-0.5" />
                <span>
                  <span className="font-semibold">No Skills (NONE)</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">A valid answer. Storyboard and visuals run with the prompts only.</span>
                </span>
              </label>
            </li>
          </ul>
        </fieldset>
        {unverified.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            <Alert variant="warning">
              <AlertTriangle aria-hidden />
              <AlertTitle>{unverified.map((s) => s.title).join(', ')} {unverified.length === 1 ? 'is' : 'are'} not verified for API use</AlertTitle>
              <AlertDescription>In the real product an unverified Skill may not be available to the automated job. Verify it in Claude Skills, choose another, or acknowledge below.</AlertDescription>
            </Alert>
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox checked={Boolean(extras.acceptUnverified)} onCheckedChange={(v) => setExtras((x) => ({ ...x, acceptUnverified: v }))} className="mt-0.5" />
              I understand the selected Skill may not run through the API and accept this for this lecture.
            </label>
          </div>
        )}
        <p className="mt-4 text-sm"><Link to="/skills" className="font-semibold text-navy underline underline-offset-4">Manage Claude Skills</Link></p>
      </Panel>

      <Panel title="Prompts for the next stages" description="Pre-filled with your saved defaults. Only prompts mapped to each stage are offered.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <PromptPicker stage="B" id="next-B" value={extras.nextPrompts?.B} onChange={(v) => setExtras((x) => ({ ...x, nextPrompts: { ...x.nextPrompts, B: v } }))} />
          <PromptPicker stage="B2" id="next-B2" value={extras.nextPrompts?.B2} onChange={(v) => setExtras((x) => ({ ...x, nextPrompts: { ...x.nextPrompts, B2: v } }))} />
        </div>
      </Panel>
    </div>
  )
}

// ------------------------------------------------------------------------------------- H3

export function H3Review({ project, fp, extras, setExtras, onEdited }) {
  const { act } = useStore()
  const sb = last(project.artifacts.storyboard)
  const rtl = isArabic(project)
  const [editing, setEditing] = useState(false)
  const [scenes, setScenes] = useState(sb.scenes)
  const total = sb.scenes.reduce((s, x) => s + x.seconds, 0)
  const [editError, setEditError] = useState('')
  const done = useEditResult(onEdited, setEditError)
  const dirty = editing && JSON.stringify(scenes) !== JSON.stringify(sb.scenes)
  useUnsavedGuard(dirty)
  const selected = extras.selected || []
  const toggle = (id, on) => setExtras((x) => ({ ...x, selected: on ? [...new Set([...(x.selected || []), id])] : (x.selected || []).filter((i) => i !== id) }))

  const save = () => {
    const r = act(editStoryboard, { projectId: project.id, fp, scenes })
    done(r, `Saved storyboard v${sb.version + 1}.`)
    if (r.ok) setEditing(false)
  }
  const update = (id, k, v) => setScenes((list) => list.map((s) => (s.id === id ? { ...s, [k]: v } : s)))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Storyboard v{sb.version} · {sb.scenes.length} scenes · {seconds(total)} of {seconds(project.plan.totalSeconds)} target
          {total === project.plan.totalSeconds && <span className="ml-1 text-completed"> · durations add up</span>}
        </p>
        {!editing ? (
          <Button variant="outline" onClick={() => { setScenes(sb.scenes); setEditing(true) }}><PenLine data-icon="inline-start" /> Edit scenes</Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={save}><Save data-icon="inline-start" /> Save new version</Button>
            <Button variant="ghost" onClick={() => { if (confirmDiscard(dirty)) { setEditing(false); setEditError('') } }}><X data-icon="inline-start" /> Cancel</Button>
          </div>
        )}
      </div>
      {editing && <InlineError>{editError}</InlineError>}
      {editing && <p className="text-sm text-muted-foreground">Edit on-screen text, visual descriptions or notes. Saving creates storyboard v{sb.version + 1}; draft frames are redrawn from your text.</p>}
      <ol className="flex flex-col gap-3">
        {(editing ? scenes : sb.scenes).map((s) => (
          <li key={s.id} className={cn('grid grid-cols-1 gap-4 rounded-xl border bg-surface p-4 md:grid-cols-[14rem_minmax(0,1fr)]', selected.includes(s.id) && 'border-review-line ring-2 ring-review-line/30')}>
            <DraftFrame scene={s} rtl={rtl} className="w-full rounded-md" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif font-semibold tabular">{s.id}</span>
                <span className={cn('font-semibold', rtl && 'rtl-content text-base')} dir={rtl ? 'rtl' : undefined}>{s.heading}</span>
                <span className="text-sm text-muted-foreground tabular">· {s.seconds} s</span>
                {s.editedInVersion && <ToneBadge tone="processing" icon={PenLine}>Your edit</ToneBadge>}
                {!editing && (
                  <label className="ml-auto flex items-center gap-2 text-sm">
                    <Checkbox checked={selected.includes(s.id)} onCheckedChange={(v) => toggle(s.id, v)} aria-label={`Needs changes, scene ${s.id}`} />
                    Needs changes
                  </label>
                )}
              </div>
              {editing ? (
                <div className="mt-3 grid gap-3">
                  <label className="text-sm font-semibold" htmlFor={`on-${s.id}`}>On-screen text</label>
                  <Input id={`on-${s.id}`} value={s.onScreen} onChange={(e) => update(s.id, 'onScreen', e.target.value)} dir={rtl ? 'auto' : undefined} />
                  <label className="text-sm font-semibold" htmlFor={`vis-${s.id}`}>Visual description</label>
                  <Textarea id={`vis-${s.id}`} rows={2} value={s.visual} onChange={(e) => update(s.id, 'visual', e.target.value)} />
                  <label className="text-sm font-semibold" htmlFor={`notes-${s.id}`}>Scene notes</label>
                  <Input id={`notes-${s.id}`} value={s.notes} onChange={(e) => update(s.id, 'notes', e.target.value)} />
                </div>
              ) : (
                <dl className="mt-2 grid gap-1 text-sm">
                  <div><dt className="inline font-semibold">On screen: </dt><dd className={cn('inline', rtl && 'rtl-content text-base')} dir={rtl ? 'rtl' : undefined}>{s.onScreen}</dd></div>
                  <div><dt className="inline font-semibold">Visual: </dt><dd className="inline text-muted-foreground">{s.visual}</dd></div>
                  {s.notes && <div><dt className="inline font-semibold">Notes: </dt><dd className="inline">{s.notes}</dd></div>}
                </dl>
              )}
            </div>
          </li>
        ))}
      </ol>
      <Panel title="Prompt for narration transcripts" description="Used after the silent visuals are produced.">
        <PromptPicker stage="C" id="next-C" value={extras.nextPrompts?.C} onChange={(v) => setExtras((x) => ({ ...x, nextPrompts: { ...x.nextPrompts, C: v } }))} />
      </Panel>
    </div>
  )
}

// ------------------------------------------------------------------------------------- H4

function SpeakerText({ text, rtl }) {
  return (
    <div className={cn('flex max-w-[72ch] flex-col gap-1.5 font-serif text-[1.02rem] leading-relaxed', rtl && 'rtl-content')} dir={rtl ? 'rtl' : undefined} lang={rtl ? 'ar-EG' : undefined}>
      {text.split('\n').map((line, i) => {
        const m = line.match(/^([^:]{1,30}):\s(.*)$/)
        return m ? (
          <p key={i}><span className="font-sans text-sm font-bold text-navy">{m[1]}: </span>{m[2]}</p>
        ) : <p key={i}>{line}</p>
      })}
    </div>
  )
}

export function H4Review({ project, fp, extras, setExtras, onEdited }) {
  const { act } = useStore()
  const rtl = isArabic(project)
  const tr = currentTranscripts(project)
  const [editing, setEditing] = useState(null)
  const [text, setText] = useState('')
  const [editError, setEditError] = useState('')
  const done = useEditResult(onEdited, setEditError)
  const dirty = Boolean(editing) && text.trim() !== (tr[editing]?.text || '').trim()
  useUnsavedGuard(dirty)
  const selected = extras.selected || []
  const toggle = (id, on) => setExtras((x) => ({ ...x, selected: on ? [...new Set([...(x.selected || []), id])] : (x.selected || []).filter((i) => i !== id) }))
  const guide = pronunciationGuide(project)
  const lastApprovedFp = project.approvals.H4?.fp

  const save = (chunkId) => {
    const r = act(editTranscript, { projectId: project.id, fp, chunkId, text })
    done(r, `Saved transcript ${chunkId} as a new version.`)
    if (r.ok) setEditing(null)
  }

  return (
    <Tabs defaultValue="transcripts">
      <TabsList variant="line" className="border-b">
        <TabsTrigger value="transcripts" className="h-10 px-3">Transcripts ({project.plan.chunks.length})</TabsTrigger>
        <TabsTrigger value="manifest" className="h-10 px-3">Chunk manifest</TabsTrigger>
        {guide && <TabsTrigger value="guide" className="h-10 px-3">Pronunciation guide</TabsTrigger>}
      </TabsList>
      <TabsContent value="transcripts" className="pt-5">
        <p className="mb-4 text-sm text-muted-foreground">
          Read every chunk. Edit a chunk directly, or tick “Needs changes” to ask for an AI revision of only those chunks — the others stay as they are.
          {lastApprovedFp && ' Chunks marked “New” changed since your last H4 approval.'}
        </p>
        <nav aria-label="Jump to chunk" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="mr-1 font-semibold">Jump to</span>
          {project.plan.chunks.map((c) => (
            <a key={c.id} href={`#chunk-${c.id}`} className={cn('inline-flex h-9 min-w-10 items-center justify-center rounded-md border px-2 font-semibold tabular hover:bg-subtle', selected.includes(c.id) ? 'border-review-line bg-review-bg text-review' : 'bg-surface')}>
              {c.id}
            </a>
          ))}
        </nav>
        <ol className="flex flex-col gap-3">
          {project.plan.chunks.map((c) => {
            const t = tr[c.id]
            const est = estimateSeconds(project, t.text)
            const isNew = t.version > 1
            return (
              <li key={c.id} id={`chunk-${c.id}`} className={cn('scroll-mt-24 rounded-xl border bg-surface', selected.includes(c.id) && 'border-review-line ring-2 ring-review-line/30')}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5">
                  <span className="font-serif text-lg font-semibold tabular">{c.id}</span>
                  <span className="text-sm text-muted-foreground tabular">{c.window} · target {c.targetSeconds} s · about {est} s · {wordCount(t.text)} words</span>
                  <span className="text-sm tabular">v{t.version}</span>
                  {t.producer === 'doctor' && <ToneBadge tone="processing" icon={PenLine}>Your edit</ToneBadge>}
                  {isNew && t.producer !== 'doctor' && <ToneBadge tone="review">New</ToneBadge>}
                  <div className="ml-auto flex items-center gap-2">
                    {editing !== c.id && (
                      <>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={selected.includes(c.id)} onCheckedChange={(v) => toggle(c.id, v)} aria-label={`Needs changes, chunk ${c.id}`} />
                          Needs changes
                        </label>
                        <Button size="sm" variant="outline" onClick={() => { if (confirmDiscard(dirty)) { setEditing(c.id); setText(t.text); setEditError('') } }} aria-label={`Edit, chunk ${c.id}`}>
                          <PenLine data-icon="inline-start" /> Edit
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="px-4 py-3">
                  {editing === c.id ? (
                    <div className="flex flex-col gap-3">
                      <label htmlFor={`tr-${c.id}`} className="sr-only">Transcript {c.id}</label>
                      <Textarea id={`tr-${c.id}`} rows={8} value={text} onChange={(e) => setText(e.target.value)} dir={rtl ? 'rtl' : undefined} className={cn(rtl && 'rtl-content')} />
                      <p className="text-sm text-muted-foreground">About {estimateSeconds(project, text)} s at the planned pace (target {c.targetSeconds} s). Saving creates v{t.version + 1}; only this chunk’s voice is regenerated later.</p>
                      <InlineError>{editError}</InlineError>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => save(c.id)}><Save data-icon="inline-start" /> Save new version</Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirmDiscard(dirty)) { setEditing(null); setEditError('') } }}>Cancel</Button>
                      </div>
                    </div>
                  ) : <SpeakerText text={t.text} rtl={rtl} />}
                </div>
              </li>
            )
          })}
        </ol>
        <Panel title="Prompt for voice generation" className="mt-6" description="Used for every voice chunk so the voices stay consistent.">
          <PromptPicker stage="D" id="next-D" value={extras.nextPrompts?.D} onChange={(v) => setExtras((x) => ({ ...x, nextPrompts: { ...x.nextPrompts, D: v } }))} />
        </Panel>
      </TabsContent>
      <TabsContent value="manifest" className="pt-5">
        <pre className="max-h-[32rem] overflow-auto rounded-xl border bg-surface p-4 text-sm">{chunkManifest(project)}</pre>
      </TabsContent>
      {guide && (
        <TabsContent value="guide" className="pt-5">
          <table className="w-full rounded-xl border bg-surface text-sm">
            <thead><tr className="border-b text-left"><th className="px-4 py-2">Term</th><th className="px-4 py-2">Say</th><th className="px-4 py-2">Note</th></tr></thead>
            <tbody>
              {guide.map((g) => (
                <tr key={g.term} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-semibold">{g.term}</td>
                  <td className="px-4 py-2"><bdi className="rtl-content" dir="rtl" lang="ar-EG">{g.say}</bdi></td>
                  <td className="px-4 py-2 text-muted-foreground">{g.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
      )}
    </Tabs>
  )
}

// ------------------------------------------------------------------------------------- H5

export function H5Review({ project, extras, setExtras }) {
  const au = currentAudio(project)
  const exceptions = timingExceptions(project)
  const selected = extras.selected || []
  const toggle = (id, on) => setExtras((x) => ({ ...x, selected: on ? [...new Set([...(x.selected || []), id])] : (x.selected || []).filter((i) => i !== id) }))
  const total = Object.values(au).reduce((s, x) => s + x.measuredSeconds, 0)

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Listen to each chunk for pace, accent and voice consistency. Tick “Regenerate” for any chunk that sounds wrong — only those are redone.
        To change the words themselves, the transcript must change first (use the H6 transcript route, or request transcript changes).
      </p>
      <Alert variant="info">
        <Info aria-hidden />
        <AlertTitle>Sample audio</AlertTitle>
        <AlertDescription>Each player uses a short synthetic clip produced on the developer’s computer. Measured durations are simulated values for this demo.</AlertDescription>
      </Alert>
      <ol className="flex flex-col gap-3">
        {project.plan.chunks.map((c) => {
          const x = au[c.id]
          const out = x.measuredSeconds < CHUNK_MIN_S || x.measuredSeconds > CHUNK_MAX_S
          return (
            <li key={c.id} className={cn('grid grid-cols-1 gap-3 rounded-xl border bg-surface px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center', selected.includes(c.id) && 'border-review-line ring-2 ring-review-line/30')}>
              <div className="flex items-center gap-3">
                <span className="font-serif text-lg font-semibold tabular">{c.id}</span>
                <span className="text-sm text-muted-foreground tabular">v{x.version}</span>
                {x.version > 1 && <ToneBadge tone="review">New</ToneBadge>}
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <audio controls preload="none" src={audioSampleFor(project, c.id)} className="h-10 w-full max-w-md" aria-label={`Voice chunk ${c.id} (sample clip)`} />
                <p className={cn('flex items-center gap-1.5 text-sm tabular', out ? 'font-semibold text-blocked' : 'text-muted-foreground')}>
                  {out ? <AlertTriangle aria-hidden className="size-4" /> : <Check aria-hidden className="size-4 text-completed" />}
                  Measured {x.measuredSeconds} s · target {c.targetSeconds} s {out ? '· outside 60–90 s' : '· within 60–90 s'}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm md:justify-end">
                <Checkbox checked={selected.includes(c.id)} onCheckedChange={(v) => toggle(c.id, v)} aria-label={`Regenerate, chunk ${c.id}`} />
                Regenerate
              </label>
            </li>
          )
        })}
      </ol>
      <p className="text-sm text-muted-foreground tabular">Total narration: {seconds(total)} (simulated).</p>
      {exceptions.length > 0 && (
        <div className="flex flex-col gap-3">
          <Alert variant="warning">
            <AlertTriangle aria-hidden />
            <AlertTitle>Timing exception{exceptions.length > 1 ? 's' : ''}: chunk {exceptions.map((e) => `${e.chunkId} (${e.seconds} s)`).join(', ')}</AlertTitle>
            <AlertDescription>Chunks should be 60–90 seconds. Regenerate them, or accept the exception explicitly in “Your decision”.</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------------------------- H6

export function H6Review({ project, extras, setExtras }) {
  const render = last(project.artifacts.renders)
  const base = import.meta.env.BASE_URL
  const report = useMemo(() => renderReport(project, render), [project, render])
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title={`Final video — render v${render.version}`} description={`${seconds(render.durationSeconds)} simulated length · gap ${render.gapSeconds} s · fade ${render.fadeSeconds} s`}>
          <video controls preload="metadata" poster={`${base}samples/final-video-poster.jpg`} src={`${base}samples/final-video-sample.mp4`} className="aspect-video w-full rounded-lg bg-navy">
            <track kind="captions" srcLang="en" label="English (sample)" src={`${base}samples/final-video-sample.vtt`} default />
          </video>
          <p className="mt-2 text-sm text-muted-foreground">
            Synthetic sample clip (about 20 s). In the real product this is the complete lecture video, and reviewing it takes its full length. <DemoTag>Sample</DemoTag>
          </p>
        </Panel>
        <Panel title="Verification report" description="Automated checks inform you — they never approve.">
          <dl className="flex flex-col gap-2 text-sm">
            {report.map((r) => (
              <div key={r.label}>
                <dt className="font-semibold">{r.label}</dt>
                <dd className="text-muted-foreground">{r.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  )
}
