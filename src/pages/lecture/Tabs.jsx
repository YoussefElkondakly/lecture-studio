import { Link } from 'react-router-dom'
import { AlertTriangle, Ban, CheckCircle2, Download, FileText, Film, Music, Package, PenLine, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { useNow, useStore } from '@/state/store.jsx'
import { GATES, STATION_BY_ID, STATUS, H6_ROUTES } from '@/engine/constants.js'
import { audioSampleFor, isArabic, renderReport } from '@/engine/content.js'
import { completedGateCount, currentAudio, describeJob, duplicateProject, gateFingerprint } from '@/engine/workflow.js'
import { last } from '@/engine/util.js'
import { dateTime, relativeTime, seconds, usd } from '@/lib/format.js'
import { canRenderPdf, downloadBlob, downloadText, markdownToPdfBlob } from '@/lib/pdf.js'
import { chunkManifest, slug, storyboardMarkdown, transcriptsText } from '@/lib/exports.js'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { DemoTag, KeyValue, Panel } from '@/components/app/common.jsx'
import { ToneBadge } from '@/components/app/status.jsx'

export function downloadContentPdf(project, content) {
  if (!canRenderPdf(content.md)) {
    toast.error('PDF download unavailable for Arabic in the prototype', { description: 'It needs an embedded Arabic font with shaping. The on-screen PDF preview shows the same text.' })
    return
  }
  downloadBlob(
    markdownToPdfBlob(content.md, { title: project.title, footer: `${project.title} - doctor_review.pdf from lecture_master.md r${content.version} - SYNTHETIC PROTOTYPE OUTPUT` }),
    `${slug(project.title)}_doctor_review_r${content.version}.pdf`,
  )
}

function VersionRow({ label, version, current, rejected, producer, note, at, actions }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3">
      <span className="w-14 font-serif font-semibold tabular">{label}{version}</span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm">{note}</p>
        <p className="text-xs text-muted-foreground">{producer === 'doctor' ? 'Your direct edit' : 'Simulated AI job'} · {dateTime(at)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {current && <ToneBadge tone="processing">Current</ToneBadge>}
        {rejected && <ToneBadge tone="blocked" icon={Ban}>Changes requested</ToneBadge>}
        {!current && !rejected && <ToneBadge tone="draft">Superseded</ToneBadge>}
        {actions}
      </div>
    </li>
  )
}

export function VersionsTab({ project: p }) {
  const a = p.artifacts
  const rej = (id) => p.rejectedKeys.includes(id)
  const curContent = last(a.content)
  const chunkVersions = p.plan.chunks.map((c) => ({ c, tr: a.transcripts[c.id] || [], au: a.audio[c.id] || [] }))
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">Every version ever produced is kept. Approved versions are never edited in place — a change always creates a new version.</p>
      <Panel title="Lecture content and paired PDF" description="Canonical Markdown; the PDF is always rendered from the same revision.">
        {a.content.length === 0 ? <p className="text-sm text-muted-foreground">Not generated yet.</p> : (
          <ul className="divide-y">
            {[...a.content].reverse().map((c) => (
              <VersionRow
                key={c.id} label="r" version={c.version} current={c === curContent} rejected={rej(c.id)} producer={c.producer} note={c.note} at={c.createdAt}
                actions={
                  <>
                    <Button size="xs" variant="outline" onClick={() => downloadText(c.md, `${slug(p.title)}_lecture_master_r${c.version}.md`, 'text/markdown')}><Download /> .md</Button>
                    <Button size="xs" variant="outline" disabled={c.pdf.status !== 'ready'} onClick={() => downloadContentPdf(p, c)}><Download /> PDF</Button>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Storyboard and draft frames">
        {a.storyboard.length === 0 ? <p className="text-sm text-muted-foreground">Not generated yet.</p> : (
          <ul className="divide-y">
            {[...a.storyboard].reverse().map((s) => (
              <VersionRow key={s.id} label="v" version={s.version} current={s === last(a.storyboard)} rejected={rej(s.id)} producer={s.producer} note={s.note} at={s.createdAt}
                actions={<Button size="xs" variant="outline" onClick={() => downloadText(storyboardMarkdown(p, s), `${slug(p.title)}_storyboard_v${s.version}.md`, 'text/markdown')}><Download /> .md</Button>}
              />
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Silent visuals">
        {a.visuals.length === 0 ? <p className="text-sm text-muted-foreground">Not generated yet.</p> : (
          <ul className="divide-y">
            {[...a.visuals].reverse().map((v) => (
              <VersionRow key={v.id} label="v" version={v.version} current={v === last(a.visuals)} rejected={rej(v.id)} producer="ai" note={`${v.note} · ${v.frames} frames`} at={v.createdAt} />
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Narration chunks" description="Transcript and voice versions per chunk. Unrelated chunks keep their versions when one is revised.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Chunk</th>
                <th className="py-2 pr-4 font-semibold">Window</th>
                <th className="py-2 pr-4 font-semibold">Transcript</th>
                <th className="py-2 pr-4 font-semibold">Voice</th>
                <th className="py-2 font-semibold">Measured</th>
              </tr>
            </thead>
            <tbody>
              {chunkVersions.map(({ c, tr, au }) => (
                <tr key={c.id} className="border-b last:border-b-0">
                  <td className="py-2.5 pr-4 font-semibold tabular">{c.id}</td>
                  <td className="py-2.5 pr-4 tabular">{c.window}</td>
                  <td className="py-2.5 pr-4">{tr.length ? `v${last(tr).version}${last(tr).producer === 'doctor' ? ' (your edit)' : ''}${tr.length > 1 ? ` · ${tr.length} versions` : ''}` : '—'}</td>
                  <td className="py-2.5 pr-4">{au.length ? `v${last(au).version}${au.length > 1 ? ` · ${au.length} versions` : ''}` : '—'}</td>
                  <td className="py-2.5 tabular">{au.length ? `${last(au).measuredSeconds} s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Final renders">
        {a.renders.length === 0 ? <p className="text-sm text-muted-foreground">Not rendered yet.</p> : (
          <ul className="divide-y">
            {[...a.renders].reverse().map((r) => (
              <VersionRow key={r.id} label="v" version={r.version} current={r === last(a.renders)} rejected={rej(r.id)} producer="ai" note={`${r.note} · ${seconds(r.durationSeconds)} · gap ${r.gapSeconds}s, fade ${r.fadeSeconds}s`} at={r.createdAt} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

const DECISION_STYLE = {
  APPROVE: { label: 'Approved', tone: 'completed', icon: CheckCircle2 },
  REJECT: { label: 'Changes requested', tone: 'review', icon: RotateCw },
}

export function HistoryTab({ project: p }) {
  const { state } = useStore()
  const now = useNow()
  const decisions = state.decisions.filter((d) => d.projectId === p.id)
  const jobs = state.jobs.filter((j) => j.projectId === p.id)
  const activity = state.activity.filter((x) => x.projectId === p.id)
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Approval history" description="Append-only. Each decision is bound to the exact version reviewed." className="xl:col-span-2">
        {decisions.length === 0 ? <p className="text-sm text-muted-foreground">No decisions yet.</p> : (
          <ol className="flex flex-col divide-y">
            {decisions.map((d) => {
              const s = DECISION_STYLE[d.decision]
              const route = H6_ROUTES.find((r) => r.id === d.route)
              return (
                <li key={d.id} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:gap-4">
                  <div className="flex shrink-0 items-start gap-2 sm:w-56">
                    <span className="font-serif font-semibold tabular">{d.gate}</span>
                    <ToneBadge tone={s.tone} icon={s.icon}>{s.label}</ToneBadge>
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p>{STATION_BY_ID[d.gate].long}{route ? ` — route ${route.label}` : ''}{d.affectedIds?.length ? ` — chunks/scenes ${d.affectedIds.join(', ')}` : ''}</p>
                    {d.note && <p className="mt-0.5 text-muted-foreground">“{d.note}”</p>}
                    {d.extra?.skills && <p className="mt-0.5 text-muted-foreground">Skills confirmed: {d.extra.skills.join(', ')}</p>}
                    {d.extra?.prompts && <p className="mt-0.5 text-muted-foreground">Next-stage prompts: {Object.entries(d.extra.prompts).map(([k, v]) => `${k}: ${v}`).join('; ')}</p>}
                    {d.extra?.timingExceptionsAccepted?.length > 0 && <p className="mt-0.5 text-muted-foreground">Timing exceptions accepted: {d.extra.timingExceptionsAccepted.join(', ')}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {d.reviewer}{d.seeded ? ' (seeded demo history)' : ''} · {dateTime(d.createdAt)} · fingerprint {d.artifactFingerprint.split(':').slice(1).join(':').slice(0, 18)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Panel>
      <Panel title="Processing jobs" description="Simulated jobs, attempts and errors.">
        <ul className="flex flex-col divide-y">
          {jobs.slice(0, 25).map((j) => (
            <li key={j.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{describeJob(j)}{j.attempt > 1 ? ` · attempt ${j.attempt}` : ''}</p>
                <p className="text-xs text-muted-foreground">{j.model}{j.promptRef ? ` · prompt “${j.promptRef.title}” v${j.promptRef.version}` : ''} · {dateTime(j.startedAt)}</p>
                {j.errorMessage && <p className="text-xs font-medium text-blocked">{j.errorMessage}</p>}
              </div>
              <ToneBadge tone={j.status === 'done' ? 'completed' : j.status === 'failed' ? 'blocked' : j.status === 'running' ? 'processing' : 'draft'}>
                {j.status === 'done' ? 'Done' : j.status === 'failed' ? 'Failed' : j.status === 'running' ? 'Running' : 'Cancelled'}
              </ToneBadge>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Activity">
        <ol className="flex flex-col divide-y">
          {activity.slice(0, 25).map((x) => (
            <li key={x.id} className="py-2.5 text-sm">
              <p>{x.text}</p>
              <p className="text-xs text-muted-foreground">{relativeTime(x.at, now)}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  )
}

export function SetupTab({ project: p }) {
  const { state } = useStore()
  const stages = ['A', 'B', 'B2', 'C', 'D']
  const cost = state.usage.filter((u) => u.projectId === p.id).reduce((s, u) => s + u.estimatedCost, 0)
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Master prompt versions used" description="Exact snapshots — library edits never change them." className="lg:col-span-2">
        <ul className="divide-y">
          {stages.map((st) => {
            const ref = p.promptRefs[st]
            const prompt = ref && state.prompts.find((x) => x.id === ref.promptId)
            const libVersion = prompt && state.promptVersions.find((v) => v.id === prompt.activeVersionId)?.version
            return (
              <li key={st} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                <span className="w-56 shrink-0 text-muted-foreground">{STATION_BY_ID[st].long}</span>
                {ref ? (
                  <>
                    <Link to={`/prompts/${ref.promptId}?version=${ref.versionId}`} className="font-semibold underline-offset-4 hover:underline">{ref.title}</Link>
                    <span className="tabular">v{ref.version}</span>
                    <span className="text-muted-foreground">category “{ref.categoryName}”</span>
                    {libVersion && libVersion !== ref.version && <ToneBadge tone="draft">Library is now v{libVersion}</ToneBadge>}
                  </>
                ) : <span className="text-muted-foreground">Chosen when this stage starts (saved default or your choice at the gate before it)</span>}
              </li>
            )
          })}
        </ul>
      </Panel>
      <Panel title="Preferences snapshot">
        <KeyValue items={[
          ['Audience', p.prefs.audience], ['Language', p.prefs.language], ['PDF style', p.prefs.pdfStyle === 'Other' ? `Other — ${p.prefs.pdfStyleOther}` : p.prefs.pdfStyle],
          ['Duration', `${p.prefs.durationMin} min · ${p.plan.chunks.length} chunks`], ['Speakers', p.prefs.speakerMode], ['Voice direction', p.prefs.voiceDirection],
          ['Timing exceptions', p.prefs.timingPolicy === 'FINAL_SHORT' ? 'Short final chunk allowed' : 'Ask at audio review'],
        ]} />
      </Panel>
      <Panel title="Source, Skills and models">
        <KeyValue items={[
          ['Source', `${p.source.name}${p.source.origin === 'demo' ? ' (synthetic demo)' : p.source.origin === 'upload' ? ' (metadata only)' : ''}`],
          ['Claude Skills', p.skillRefs ? (p.skillRefs.length ? p.skillRefs.map((s) => `${s.title}${s.status !== 'api_ready' ? ' (unverified)' : ''}`).join(', ') : 'NONE (confirmed at H2)') : 'Confirmed at H2'],
          ['Content model', p.providerSnapshot.content], ['Creative model', p.providerSnapshot.creative], ['Voice model', p.providerSnapshot.tts],
          ['Mock cost so far', <span key="c">{usd(cost)} <DemoTag>Mock estimate</DemoTag></span>],
        ]} />
      </Panel>
    </div>
  )
}

export function DeliverablesTab({ project: p, onArchive }) {
  const { act } = useStore()
  const done = p.status === STATUS.COMPLETED
  const a = p.artifacts
  const content = last(a.content)
  const sb = last(a.storyboard)
  const render = last(a.renders)
  const base = import.meta.env.BASE_URL
  const ar = isArabic(p)
  const au = currentAudio(p)

  const files = [
    { name: 'lecture_master.md', icon: FileText, desc: content ? `Canonical text r${content.version}` : null, action: content && (() => downloadText(content.md, `${slug(p.title)}_lecture_master_r${content.version}.md`, 'text/markdown')) },
    {
      name: 'doctor_review.pdf', icon: FileText,
      desc: content ? (canRenderPdf(content.md) ? `Generated in your browser from r${content.version}` : 'Arabic PDF export unavailable in the prototype (needs an embedded Arabic font)') : null,
      action: content && canRenderPdf(content.md) && (() => downloadContentPdf(p, content)),
    },
    { name: 'storyboard.md', icon: FileText, desc: sb ? `Storyboard v${sb.version}` : null, action: sb && (() => downloadText(storyboardMarkdown(p, sb), `${slug(p.title)}_storyboard_v${sb.version}.md`, 'text/markdown')) },
    { name: 'transcripts (all chunks)', icon: FileText, desc: Object.keys(a.transcripts).length ? `${p.plan.chunks.length} transcripts, combined text file` : null, action: Object.keys(a.transcripts).length && (() => downloadText(transcriptsText(p), `${slug(p.title)}_transcripts.txt`)) },
    { name: 'chunk_manifest.json', icon: FileText, desc: Object.keys(a.transcripts).length ? 'Chunk plan with versions and measured durations' : null, action: Object.keys(a.transcripts).length && (() => downloadText(chunkManifest(p), `${slug(p.title)}_chunk_manifest.json`, 'application/json')) },
    { name: 'voice files', icon: Music, desc: Object.values(au).some(Boolean) ? 'Synthetic sample clips stand in for generated voices' : null, href: Object.values(au).some(Boolean) ? audioSampleFor(p, '01') : null, sample: true },
    { name: 'final_video.mp4', icon: Film, desc: render ? 'Synthetic sample video stands in for the real render' : null, href: render ? `${base}samples/final-video-sample.mp4` : null, sample: true },
    { name: 'Complete bundle (.zip)', icon: Package, desc: 'Not available in the prototype — planned for V1', unavailable: true },
  ]

  return (
    <div className="flex flex-col gap-6">
      {!done && (
        <Alert variant="info">
          <AlertTriangle aria-hidden />
          <AlertTitle>Deliverables are final after H6</AlertTitle>
          <AlertDescription>Files produced so far are listed below; the lecture is not complete until the final video is approved.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Final video" description={render ? `Render v${render.version} · ${seconds(render.durationSeconds)} (simulated length)` : 'Not rendered yet'}>
          {render ? (
            <figure>
              <video controls preload="metadata" poster={`${base}samples/final-video-poster.jpg`} className="aspect-video w-full rounded-lg bg-navy" src={`${base}samples/final-video-sample.mp4`}>
                <track kind="captions" />
              </video>
              <figcaption className="mt-2 text-sm text-muted-foreground">
                Synthetic sample clip (about 20 s) standing in for the real render. {ar ? 'The real Arabic video would use the approved Egyptian Arabic voices.' : ''}
              </figcaption>
            </figure>
          ) : <p className="text-sm text-muted-foreground">The final video appears here after stage E.</p>}
        </Panel>
        <Panel title="Files">
          <ul className="divide-y">
            {files.map((f) => (
              <li key={f.name} className="flex items-center gap-3 py-2.5">
                <f.icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.desc || 'Not produced yet'}</p>
                </div>
                {f.unavailable || !f.desc ? (
                  <ToneBadge tone="draft">Unavailable</ToneBadge>
                ) : f.href ? (
                  <Button size="sm" variant="outline" render={<a href={f.href} download />} nativeButton={false}><Download data-icon="inline-start" /> Sample</Button>
                ) : f.action ? (
                  <Button size="sm" variant="outline" onClick={f.action}><Download data-icon="inline-start" /> Download</Button>
                ) : <ToneBadge tone="draft">Unavailable</ToneBadge>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {render && (
        <Panel title="Render verification report" description="Software checks inform you — they never approve anything.">
          <KeyValue items={renderReport(p, render).map((r) => [r.label, r.value])} />
        </Panel>
      )}
      <Panel title="Approvals" description={`${completedGateCount(p)} of 6 currently valid`}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GATES.map((g) => {
            const valid = p.approvals[g] && p.approvals[g].fp === gateFingerprint(p, g)
            return (
              <li key={g} className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', valid ? 'border-completed/25 bg-completed-bg' : 'bg-surface')}>
                {valid ? <CheckCircle2 aria-hidden className="size-4 text-completed" /> : <PenLine aria-hidden className="size-4 text-muted-foreground" />}
                <span className="font-serif font-semibold">{g}</span> {STATION_BY_ID[g].name}
                <span className="ml-auto text-xs text-muted-foreground">{valid ? dateTime(p.approvals[g].at) : 'Pending'}</span>
              </li>
            )
          })}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { const r = act(duplicateProject, p.id); if (r.ok) toast.success('Duplicated as a new draft', { description: 'Settings and source are copied; approvals are not.' }) }}>
            Duplicate as new lecture
          </Button>
          {!p.archivedAt && <Button variant="destructive" onClick={onArchive}>Archive…</Button>}
        </div>
      </Panel>
    </div>
  )
}
