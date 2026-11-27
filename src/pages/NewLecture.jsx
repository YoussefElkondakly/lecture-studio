import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, FileText, Paperclip, Play, Save, Settings2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/state/store.jsx'
import { AUDIENCES, LANGUAGES, PDF_STYLES, SPEAKER_MODES, TIMING_POLICIES } from '@/engine/constants.js'
import { DEMO_SOURCES } from '@/engine/content.js'
import { planChunks } from '@/engine/chunks.js'
import { compatiblePrompts, createProject, getProject, updateDraft, validateIntake } from '@/engine/workflow.js'
import { updateDefaults } from '@/engine/library.js'
import { bytes } from '@/lib/format.js'
import { cn } from '@/lib/utils'
import { Button, ButtonLink } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FormRow, NativeSelect, PageHeader, describedBy } from '@/components/app/common.jsx'
import { ChoiceGroup } from '@/components/app/ChoiceGroup.jsx'
import { PromptPicker } from '@/components/app/PromptPicker.jsx'

const SOURCE_MODES = [
  { value: 'demo', label: 'Demo source', icon: FileText },
  { value: 'upload', label: 'Attach a file', icon: Paperclip },
  { value: 'notes', label: 'Paste notes', icon: FileText },
]

function uid() {
  return `req_${Date.now().toString(36)}_${Math.floor(performance.now()).toString(36)}`
}

export default function NewLecture() {
  const { state, act } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const draft = params.get('draft') ? getProject(state, params.get('draft')) : null
  const defaults = state.profile.defaults
  const stageDefault = state.profile.stageDefaults.A
  const firstA = compatiblePrompts(state, 'A')[0]?.id

  const [title, setTitle] = useState(draft?.title || '')
  const [sourceMode, setSourceMode] = useState(draft?.source?.origin || 'demo')
  const [demoSourceId, setDemoSourceId] = useState(draft?.source?.origin === 'demo' ? DEMO_SOURCES.find((d) => d.name === draft.source.name)?.id || '' : '')
  const [file, setFile] = useState(draft?.source?.origin === 'upload' ? draft.source : null)
  const [notes, setNotes] = useState(draft?.source?.notes || '')
  const [promptId, setPromptId] = useState(draft?.promptRefs?.A?.promptId || stageDefault || firstA || '')
  const [prefs, setPrefs] = useState(draft?.prefs || { ...defaults })
  const [advanced, setAdvanced] = useState(false)
  const [saveDefaults, setSaveDefaults] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const requestId = useRef(uid())
  const summaryRef = useRef(null)

  const setPref = (k, v) => setPrefs((p) => ({ ...p, [k]: v }))
  const plan = useMemo(() => {
    try { return planChunks((Number(prefs.durationMin) || 1) * 60, prefs.timingPolicy) } catch { return null }
  }, [prefs.durationMin, prefs.timingPolicy])

  const source = useMemo(() => {
    if (sourceMode === 'demo') {
      const d = DEMO_SOURCES.find((x) => x.id === demoSourceId)
      return d ? { ...d, origin: 'demo' } : null
    }
    if (sourceMode === 'upload') return file ? { ...file, origin: 'upload' } : null
    return notes.trim() ? { name: 'Pasted notes', type: 'Text', size: new Blob([notes]).size, origin: 'notes', notes: notes.trim(), topic: null } : { origin: 'notes', notes: '' }
  }, [sourceMode, demoSourceId, file, notes])

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return setFile(null)
    const ok = /\.(pdf|pptx?|docx?|txt|md)$/i.test(f.name)
    if (!ok) {
      setErrors((x) => ({ ...x, source: 'Choose a PDF, PowerPoint, Word, Markdown or text file.' }))
      e.target.value = ''
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      setErrors((x) => ({ ...x, source: 'That file is larger than 50 MB. Choose a smaller file.' }))
      e.target.value = ''
      return
    }
    // Prototype keeps metadata only — the file content is never read or stored.
    setFile({ name: f.name, type: f.name.split('.').pop().toUpperCase(), size: f.size, topic: null })
    setErrors((x) => ({ ...x, source: undefined }))
  }

  const submit = (start) => {
    if (submitting) return
    const data = {
      title, source: source?.origin === 'notes' && !notes.trim() ? source : source, promptId, prefs: { ...prefs, durationMin: Number(prefs.durationMin) },
      start, clientRequestId: requestId.current,
    }
    const errs = validateIntake(data)
    setErrors(errs)
    if (Object.keys(errs).length) {
      if (['audience', 'language', 'pdfStyle', 'pdfStyleOther', 'durationMin', 'speakerMode', 'voiceDirection'].some((k) => errs[k])) setAdvanced(true)
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    setSubmitting(true)
    const r = draft ? act(updateDraft, draft.id, data) : act(createProject, data)
    if (!r.ok) {
      setErrors(r.errors || {})
      setSubmitting(false)
      return
    }
    if (saveDefaults) act(updateDefaults, data.prefs)
    if (start) {
      toast.success('Lecture started', { description: 'Lecture content generation is queued. You can leave — you’ll be notified when H1 is ready.' })
      navigate(`/lectures/${r.projectId}?started=1`)
    } else {
      toast.success('Draft saved')
      navigate(`/lectures/${r.projectId}`)
    }
  }

  const errorList = Object.entries(errors).filter(([, v]) => v)
  const speakers = SPEAKER_MODES.find((m) => m.id === prefs.speakerMode)
  const timing = TIMING_POLICIES.find((t) => t.id === prefs.timingPolicy)

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'My lectures', to: '/lectures' }, { label: draft ? 'Edit draft' : 'Start new lecture' }]}
        title={draft ? 'Edit draft lecture' : 'Start a new lecture'}
        description="Three things are needed: a name, a source and a content prompt. Everything else uses your saved defaults."
      />

      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); submit(true) }}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          {errorList.length > 0 && (
            <div ref={summaryRef} tabIndex={-1} className="outline-none">
              <Alert variant="destructive">
                <AlertCircle aria-hidden />
                <AlertTitle>Check {errorList.length === 1 ? 'one field' : `${errorList.length} fields`} before starting</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {errorList.map(([k, v]) => <li key={k}>{v}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <section className="rounded-xl border bg-surface" aria-labelledby="sec-essentials">
            <h2 id="sec-essentials" className="border-b px-5 py-4 text-lg font-semibold">Lecture</h2>
            <div className="flex flex-col gap-6 px-5 py-5">
              <FormRow label="Lecture name" htmlFor="title" required error={errors.title} help="Shown on your dashboard and in notifications.">
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={Boolean(errors.title) || undefined}
                  aria-describedby={describedBy('title', { help: true, error: errors.title })}
                  placeholder="For example: Neonatal jaundice for parents"
                  autoComplete="off"
                />
              </FormRow>

              <fieldset className="flex flex-col gap-3" aria-describedby={errors.source ? 'source-error' : 'source-help'}>
                <legend className="text-sm font-semibold">Lecture source</legend>
                <div role="radiogroup" aria-label="Source type" className="flex flex-wrap gap-2">
                  {SOURCE_MODES.map((m) => (
                    <label
                      key={m.value}
                      className={cn(
                        'inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal',
                        sourceMode === m.value ? 'border-navy bg-navy-tint text-navy' : 'border-input bg-surface hover:bg-subtle',
                      )}
                    >
                      <input type="radio" name="source-mode" className="sr-only" value={m.value} checked={sourceMode === m.value} onChange={() => setSourceMode(m.value)} />
                      <m.icon aria-hidden className="size-4" /> {m.label}
                    </label>
                  ))}
                </div>
                {sourceMode === 'demo' && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="demo-source" className="sr-only">Demo source file</label>
                    <NativeSelect id="demo-source" value={demoSourceId} onChange={(e) => setDemoSourceId(e.target.value)} invalid={Boolean(errors.source)}>
                      <option value="">Choose a synthetic demo source…</option>
                      {DEMO_SOURCES.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.type}, {d.pages} pages, {bytes(d.size)}</option>)}
                    </NativeSelect>
                  </div>
                )}
                {sourceMode === 'upload' && (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="source-file" className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input bg-subtle/60 px-4 py-5 text-center hover:bg-subtle has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-teal">
                      <Paperclip aria-hidden className="size-5 text-muted-foreground" />
                      <span className="text-sm font-semibold">{file ? file.name : 'Choose a file'}</span>
                      <span className="text-sm text-muted-foreground">{file ? `${file.type} · ${bytes(file.size)}` : 'PDF, PowerPoint, Word, Markdown or text — up to 50 MB'}</span>
                      <input id="source-file" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md" className="sr-only" onChange={onFile} />
                    </label>
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                      Prototype: only the file name and size are kept — the content is never read, stored or uploaded. Never use identifiable patient material.
                    </p>
                  </div>
                )}
                {sourceMode === 'notes' && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="source-notes" className="sr-only">Pasted lecture notes</label>
                    <Textarea id="source-notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste synthetic lecture notes or an outline…" aria-invalid={Boolean(errors.source) || undefined} />
                  </div>
                )}
                {errors.source ? (
                  <p id="source-error" role="alert" className="text-sm font-medium text-destructive">{errors.source}</p>
                ) : (
                  <p id="source-help" className="text-sm text-muted-foreground">All demo sources are synthetic teaching material.</p>
                )}
              </fieldset>

              <PromptPicker
                stage="A"
                id="content-prompt"
                label="Lecture content prompt"
                value={promptId}
                onChange={setPromptId}
                error={errors.promptId}
                help="Only prompts in categories mapped to Lecture content (A) are listed."
              />
            </div>
          </section>

          <section className="rounded-xl border bg-surface" aria-labelledby="sec-prefs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 id="sec-prefs" className="text-lg font-semibold">Lecture preferences</h2>
                <p className="text-sm text-muted-foreground">From your saved defaults. Change them only if this lecture is different.</p>
              </div>
              <Button type="button" variant="outline" aria-expanded={advanced} aria-controls="advanced-prefs" onClick={() => setAdvanced((v) => !v)}>
                <Settings2 data-icon="inline-start" /> {advanced ? 'Hide preferences' : 'Change preferences'}
              </Button>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
              {[
                ['Audience', prefs.audience],
                ['Language', prefs.language],
                ['PDF style', prefs.pdfStyle === 'Other' ? `Other — ${prefs.pdfStyleOther || 'not described'}` : prefs.pdfStyle],
                ['Duration', plan ? `${prefs.durationMin} min · ${plan.chunks.length} narration chunks of 60–90 s` : '—'],
                ['Speakers', speakers?.label],
                ['Timing exceptions', timing?.label],
                ['Voice direction', prefs.voiceDirection || 'Not set'],
              ].map(([k, v]) => (
                <div key={k} className={cn('flex flex-col', k === 'Voice direction' && 'sm:col-span-2')}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            <div id="advanced-prefs" hidden={!advanced} className="flex flex-col gap-6 border-t px-5 py-5">
              <ChoiceGroup legend="Audience" name="audience" value={prefs.audience} onChange={(v) => setPref('audience', v)} error={errors.audience} options={AUDIENCES.map((a) => ({ value: a, label: a }))} />
              <ChoiceGroup
                legend="Language"
                name="language"
                value={prefs.language}
                onChange={(v) => setPref('language', v)}
                error={errors.language}
                options={LANGUAGES.map((l) => ({ value: l, label: l, help: l === 'Egyptian Arabic' ? 'Colloquial, shown right-to-left' : undefined }))}
              />
              <div className="flex flex-col gap-3">
                <ChoiceGroup legend="PDF style" name="pdfStyle" value={prefs.pdfStyle} onChange={(v) => setPref('pdfStyle', v)} error={errors.pdfStyle} options={PDF_STYLES.map((s) => ({ value: s, label: s }))} />
                {prefs.pdfStyle === 'Other' && (
                  <FormRow label="Describe the PDF style" htmlFor="pdf-other" error={errors.pdfStyleOther}>
                    <Input id="pdf-other" value={prefs.pdfStyleOther || ''} onChange={(e) => setPref('pdfStyleOther', e.target.value)} aria-invalid={Boolean(errors.pdfStyleOther) || undefined} />
                  </FormRow>
                )}
              </div>
              <FormRow
                label="Target video duration (minutes)"
                htmlFor="duration"
                error={errors.durationMin}
                help={plan ? `${plan.chunks.length} narration chunks: ${plan.chunks.map((c) => `${c.targetSeconds}s`).join(', ')}` : undefined}
              >
                <Input
                  id="duration"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={30}
                  value={prefs.durationMin}
                  onChange={(e) => setPref('durationMin', e.target.value)}
                  className="w-32"
                  aria-invalid={Boolean(errors.durationMin) || undefined}
                  aria-describedby={describedBy('duration', { help: Boolean(plan), error: errors.durationMin })}
                />
              </FormRow>
              <ChoiceGroup
                legend="Speakers"
                name="speakers"
                value={prefs.speakerMode}
                onChange={(v) => setPref('speakerMode', v)}
                error={errors.speakerMode}
                options={SPEAKER_MODES.map((m) => ({ value: m.id, label: m.label, help: m.speakers.join(', ') }))}
              />
              <FormRow label="Voice direction" htmlFor="voice" error={errors.voiceDirection} help="Used for every chunk so voices stay consistent.">
                <Textarea id="voice" rows={2} value={prefs.voiceDirection} onChange={(e) => setPref('voiceDirection', e.target.value)} aria-invalid={Boolean(errors.voiceDirection) || undefined} aria-describedby={describedBy('voice', { help: true, error: errors.voiceDirection })} />
              </FormRow>
              <ChoiceGroup
                legend="Timing exceptions"
                name="timing"
                value={prefs.timingPolicy}
                onChange={(v) => setPref('timingPolicy', v)}
                options={TIMING_POLICIES.map((t) => ({ value: t.id, label: t.label, help: t.help }))}
                columns="grid-cols-1 sm:grid-cols-2"
              />
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox checked={saveDefaults} onCheckedChange={setSaveDefaults} />
                Save these preferences as my defaults for future lectures
              </label>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="What happens next">
          <div className="rounded-xl border bg-surface">
            <h2 className="border-b px-5 py-4 text-lg font-semibold">What happens next</h2>
            <ol className="flex flex-col gap-3 px-5 py-4 text-sm">
              <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">A</span><span>Lecture content and its paired PDF are generated automatically.</span></li>
              <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-review-bg font-serif text-xs font-bold text-review">H1</span><span>You’re notified to review the medical content. Nothing continues without you.</span></li>
              <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-bold text-muted-foreground">…</span><span>Five more reviews follow, with automatic steps in between. No copying between AI tools.</span></li>
            </ol>
            <div className="flex flex-col gap-2 border-t px-5 py-4">
              <Button type="submit" size="lg" disabled={submitting}>
                <Play data-icon="inline-start" /> {submitting ? 'Starting…' : 'Start now'}
              </Button>
              <Button type="button" variant="outline" disabled={submitting} onClick={() => submit(false)}>
                <Save data-icon="inline-start" /> Save as draft
              </Button>
              <ButtonLink as={Link} variant="ghost" to={draft ? `/lectures/${draft.id}` : '/'}>Cancel</ButtonLink>
            </div>
          </div>
        </aside>
      </form>
    </div>
  )
}
