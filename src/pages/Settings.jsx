import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, Bell, CheckCircle2, CircleDollarSign, FastForward, FlaskConical, KeyRound, ListChecks, PlugZap, RotateCcw, Unplug, UserRound, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/state/store.jsx'
import { AUDIENCES, FAILURE_CODES, LANGUAGES, PDF_STYLES, SPEAKER_MODES, SPEEDS, TIMING_POLICIES } from '@/engine/constants.js'
import {
  connectProvider, disconnectProvider, invalidateProvider, sendTestNotification, setModel, testProvider, updateBudget, updateDefaults,
  updateDemo, updateNotificationPrefs, updateProfile,
} from '@/engine/library.js'
import { finishRunningJobs, monthSpend } from '@/engine/workflow.js'
import { seedDemo, emptyWorkspace } from '@/engine/seed.js'
import { dateTime, relativeTime, usd } from '@/lib/format.js'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog, DemoTag, FormRow, NativeSelect, PageHeader, Panel } from '@/components/app/common.jsx'
import { ChoiceGroup } from '@/components/app/ChoiceGroup.jsx'
import { ToneBadge } from '@/components/app/status.jsx'

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'defaults', label: 'Lecture defaults', icon: ListChecks },
  { id: 'providers', label: 'Providers & models', icon: PlugZap },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'budget', label: 'Budget & usage', icon: CircleDollarSign },
  { id: 'demo', label: 'Demo controls', icon: FlaskConical },
]

function SwitchRow({ id, label, help, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        {help && <p className="text-sm text-muted-foreground">{help}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function ProfileSection() {
  const { state, act } = useStore()
  const [name, setName] = useState(state.profile.displayName)
  return (
    <Panel title="Profile" description="One doctor plus an administrator in V1. No sign-in exists in the prototype.">
      <div className="flex max-w-lg flex-col gap-4">
        <FormRow label="Display name" htmlFor="pf-name">
          <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <FormRow label="Role" htmlFor="pf-role" help="Only the doctor can approve medical content (H1) in V1.">
          <Input id="pf-role" value="Doctor — lecture author and medical reviewer" readOnly aria-describedby="pf-role-help" />
        </FormRow>
        <FormRow label="Notification email" htmlFor="pf-email" help="Placeholder address. Real delivery is configured later.">
          <Input id="pf-email" value="dr.ashraf@example.invalid" readOnly aria-describedby="pf-email-help" />
        </FormRow>
        <div><Button onClick={() => { act(updateProfile, { displayName: name.trim() || state.profile.displayName }); toast.success('Profile saved') }}>Save profile</Button></div>
      </div>
    </Panel>
  )
}

function DefaultsSection() {
  const { state, act } = useStore()
  const [d, setD] = useState(state.profile.defaults)
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }))
  return (
    <Panel title="Lecture defaults" description="Pre-filled on every new lecture. You can still change them per lecture.">
      <div className="flex flex-col gap-6">
        <ChoiceGroup legend="Audience" name="d-aud" value={d.audience} onChange={(v) => set('audience', v)} options={AUDIENCES.map((a) => ({ value: a, label: a }))} />
        <ChoiceGroup legend="Language" name="d-lang" value={d.language} onChange={(v) => set('language', v)} options={LANGUAGES.map((a) => ({ value: a, label: a }))} />
        <ChoiceGroup legend="PDF style" name="d-pdf" value={d.pdfStyle} onChange={(v) => set('pdfStyle', v)} options={PDF_STYLES.map((a) => ({ value: a, label: a }))} />
        <FormRow label="Duration (minutes)" htmlFor="d-dur">
          <Input id="d-dur" type="number" min={1} max={30} className="w-32" value={d.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} />
        </FormRow>
        <ChoiceGroup legend="Speakers" name="d-sp" value={d.speakerMode} onChange={(v) => set('speakerMode', v)} options={SPEAKER_MODES.map((m) => ({ value: m.id, label: m.label }))} />
        <FormRow label="Voice direction" htmlFor="d-voice"><Textarea id="d-voice" rows={2} value={d.voiceDirection} onChange={(e) => set('voiceDirection', e.target.value)} /></FormRow>
        <ChoiceGroup legend="Timing exceptions" name="d-tp" value={d.timingPolicy} onChange={(v) => set('timingPolicy', v)} options={TIMING_POLICIES.map((t) => ({ value: t.id, label: t.label, help: t.help }))} columns="grid-cols-1 sm:grid-cols-2" />
        <div><Button onClick={() => { act(updateDefaults, { ...d, durationMin: Math.min(30, Math.max(1, Number(d.durationMin) || 10)) }); toast.success('Defaults saved') }}>Save defaults</Button></div>
      </div>
    </Panel>
  )
}

const STATUS_BADGE = {
  connected: { tone: 'completed', icon: CheckCircle2, label: 'Connected (demo)' },
  disconnected: { tone: 'draft', icon: Unplug, label: 'Not connected' },
  invalid: { tone: 'blocked', icon: XCircle, label: 'Credential rejected' },
}
const TASK_LABEL = { content: 'Lecture content (Gemini)', tts: 'Voice generation (Google TTS)', creative: 'Storyboard, visuals and transcripts (Claude)' }

function ProviderCard({ id }) {
  const { state, act } = useStore()
  const p = state.providers[id]
  const b = STATUS_BADGE[p.status]
  return (
    <section aria-labelledby={`prov-${id}`} className="rounded-xl border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-4">
        <div>
          <h3 id={`prov-${id}`} className="text-lg font-semibold">{p.label}</h3>
          <p className="text-sm text-muted-foreground">{p.maskedIdentifier ? <>Credential {p.maskedIdentifier} <DemoTag>Fake</DemoTag></> : 'No credential'}</p>
        </div>
        <ToneBadge tone={b.tone} icon={b.icon}>{b.label}</ToneBadge>
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        <p className="text-sm text-muted-foreground">Last check {p.lastCheckedAt ? relativeTime(p.lastCheckedAt) : 'never'}: {p.lastCheckResult}</p>
        {Object.entries(p.models).map(([task, model]) => (
          <FormRow key={task} label={TASK_LABEL[task]} htmlFor={`m-${id}-${task}`} help={p.status !== 'connected' ? 'Connect the demo account to change models.' : `Cost per call: ${p.catalog.find((m) => m.id === model)?.cost || 'Unknown'}. No automatic fallback to another model.`}>
            <NativeSelect
              id={`m-${id}-${task}`}
              value={model}
              disabled={p.status !== 'connected'}
              aria-describedby={`m-${id}-${task}-help`}
              onChange={(e) => { const r = act(setModel, id, task, e.target.value); r.ok ? toast.success('Model updated', { description: 'Applies to new jobs only.' }) : toast.error(r.error) }}
            >
              {p.catalog.filter((m) => m.tasks.includes(task)).map((m) => (
                <option key={m.id} value={m.id}>{m.label}{m.unavailable ? ' — unavailable (demo error)' : ''}</option>
              ))}
            </NativeSelect>
          </FormRow>
        ))}
        <div className="flex flex-wrap gap-2">
          {p.status === 'connected' ? (
            <Button variant="outline" onClick={() => { act(disconnectProvider, id); toast('Disconnected') }}><Unplug data-icon="inline-start" /> Disconnect</Button>
          ) : (
            <Button onClick={() => { act(connectProvider, id); toast.success('Demo account connected', { description: 'No real key was requested or stored.' }) }}><PlugZap data-icon="inline-start" /> Connect demo account</Button>
          )}
          <Button variant="outline" onClick={() => { const r = act(testProvider, id); r.passed ? toast.success('Simulated test passed') : toast.error('Simulated test failed') }}>Test connection</Button>
          {p.status === 'connected' && <Button variant="ghost" onClick={() => { act(invalidateProvider, id); toast.error('Credential marked invalid (demo)') }}><KeyRound data-icon="inline-start" /> Simulate rejected credential</Button>}
        </div>
      </div>
    </section>
  )
}

function ProvidersSection() {
  return (
    <div className="flex flex-col gap-6">
      <Alert variant="info">
        <KeyRound aria-hidden />
        <AlertTitle>Never enter real API keys here</AlertTitle>
        <AlertDescription>The prototype only offers demo accounts with fake, masked credentials. In V1 keys are stored securely on the server by the administrator — never in the browser.</AlertDescription>
      </Alert>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ProviderCard id="google" />
        <ProviderCard id="anthropic" />
      </div>
      <Panel title="Local tools" description="Run on the lecture computer in V1; no provider cost.">
        <p className="text-sm">Paired PDF renderer and FFmpeg video render — simulated in the prototype.</p>
      </Panel>
    </div>
  )
}

function NotificationsSection() {
  const { state, act } = useStore()
  const n = state.profile.notificationPrefs
  const set = (k) => (v) => act(updateNotificationPrefs, { [k]: v })
  return (
    <div className="flex flex-col gap-6">
      <Panel title="Channels" description="Which channels to use. Delivery is simulated — see the delivery log.">
        <div className="divide-y">
          <SwitchRow id="n-toast" label="Pop-up in the app" help="Shows immediately while Lecture Studio is open." checked={n.toast} onChange={set('toast')} />
          <SwitchRow id="n-email" label="Email (simulated)" help="Would send to your notification email." checked={n.email} onChange={set('email')} />
          <SwitchRow id="n-push" label="Phone push (simulated)" help="Would notify your phone. No browser permission is requested in the prototype." checked={n.push} onChange={set('push')} />
        </div>
      </Panel>
      <Panel title="What to notify about">
        <div className="divide-y">
          <SwitchRow id="n-review" label="A review is ready" help="Immediately, once per lecture, stage and version. No batching." checked={n.reviewReady} onChange={set('reviewReady')} />
          <SwitchRow id="n-issue" label="A lecture needs attention" help="Provider errors, budget stops." checked={n.issues} onChange={set('issues')} />
          <SwitchRow id="n-done" label="A lecture is completed" checked={n.completed} onChange={set('completed')} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">The in-app notification list always records every event. Quiet hours and reminders are open questions for the next design review.</p>
      </Panel>
      <Panel title="Test">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { act(sendTestNotification, 'email'); toast.success('Test email logged (simulated — not sent)') }}>Send test email</Button>
          <Button variant="outline" onClick={() => { act(sendTestNotification, 'push'); toast.success('Test push logged (simulated — not sent)') }}>Send test push</Button>
        </div>
      </Panel>
    </div>
  )
}

function BudgetSection() {
  const { state, act } = useStore()
  const now = Date.now()
  const b = state.budget
  const spent = monthSpend(state, now)
  const pct = Math.min(100, (spent / b.limit) * 100)
  const level = spent >= b.limit ? 'blocked' : pct >= b.warningPct ? 'warning' : 'ok'
  const [limit, setLimit] = useState(String(b.limit))
  const [warn, setWarn] = useState(String(b.warningPct))
  useEffect(() => { setLimit(String(b.limit)); setWarn(String(b.warningPct)) }, [b.limit, b.warningPct])
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime()
  const usage = state.usage.filter((u) => u.timestamp >= monthStart)
  const byProvider = ['google', 'anthropic'].map((p) => ({ p, total: usage.filter((u) => u.provider === p).reduce((s, u) => s + u.estimatedCost, 0) }))
  const completed = state.projects.filter((p) => p.completedAt && p.completedAt >= monthStart).length

  const save = () => {
    const r = act(updateBudget, { limit: Number(limit), warningPct: Number(warn) })
    r.ok ? toast.success('Budget saved') : toast.error(r.error)
  }

  return (
    <div className="flex flex-col gap-6">
      <Alert variant="warning">
        <CircleDollarSign aria-hidden />
        <AlertTitle>Mock usage — no real charges</AlertTitle>
        <AlertDescription>Costs are illustrative estimates for the demo. The V1 target is USD $10–20 per month; the actual hard cap and provider prices are still open.</AlertDescription>
      </Alert>
      <Panel title="This month" description={`Simulated spend against your demo limit`}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p><span className="font-serif text-3xl font-semibold tabular">{usd(spent)}</span> <span className="text-muted-foreground">of {usd(b.limit)}</span></p>
          {level === 'ok' && <ToneBadge tone="completed" icon={CheckCircle2}>Within budget</ToneBadge>}
          {level === 'warning' && <ToneBadge tone="review" icon={AlertTriangle}>Above {b.warningPct}% warning</ToneBadge>}
          {level === 'blocked' && <ToneBadge tone="blocked" icon={XCircle}>Limit reached — new paid jobs stop</ToneBadge>}
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-subtle" role="meter" aria-valuemin={0} aria-valuemax={b.limit} aria-valuenow={Number(spent.toFixed(2))} aria-label="Simulated monthly spend">
          <div className={cn('h-full rounded-full', level === 'blocked' ? 'bg-blocked' : level === 'warning' ? 'bg-review-line' : 'bg-teal')} style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          {byProvider.map(({ p, total }) => (
            <div key={p}><dt className="text-muted-foreground">{p === 'google' ? 'Google' : 'Anthropic'}</dt><dd className="font-semibold tabular">{usd(total)}</dd></div>
          ))}
          <div><dt className="text-muted-foreground">Lectures completed this month</dt><dd className="font-semibold tabular">{completed}</dd></div>
        </dl>
      </Panel>
      <Panel title="Budget policy" description="Example values only — not an approved production cap.">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-4">
            <FormRow label="Monthly limit (USD)" htmlFor="b-limit"><Input id="b-limit" type="number" min={1} step={1} className="w-36" value={limit} onChange={(e) => setLimit(e.target.value)} /></FormRow>
            <FormRow label="Warn at (% of limit)" htmlFor="b-warn"><Input id="b-warn" type="number" min={10} max={100} className="w-36" value={warn} onChange={(e) => setWarn(e.target.value)} /></FormRow>
          </div>
          <ChoiceGroup
            legend="When the limit is reached"
            name="b-enf"
            value={b.enforcement}
            onChange={(v) => { act(updateBudget, { enforcement: v }); toast.success('Saved') }}
            options={[
              { value: 'stop', label: 'Stop new paid jobs', help: 'The lecture pauses with “Action needed”. Nothing switches to another provider.' },
              { value: 'warn', label: 'Warn only', help: 'Jobs continue; the dashboard shows a warning.' },
            ]}
            columns="grid-cols-1 sm:grid-cols-2"
          />
          <div><Button onClick={save}>Save limit</Button></div>
        </div>
      </Panel>
      <Panel title="Recent usage records" description="Per simulated job.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-4">When</th><th className="py-2 pr-4">Lecture</th><th className="py-2 pr-4">Stage</th><th className="py-2 pr-4">Model</th><th className="py-2 text-right">Estimate</th></tr></thead>
            <tbody>
              {usage.slice(0, 15).map((u) => (
                <tr key={u.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 tabular whitespace-nowrap">{dateTime(u.timestamp)}</td>
                  <td className="py-2 pr-4">{u.label || state.projects.find((p) => p.id === u.projectId)?.title || '—'}</td>
                  <td className="py-2 pr-4">{u.stage}</td>
                  <td className="py-2 pr-4">{u.model}</td>
                  <td className="py-2 text-right tabular">{usd(u.estimatedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function DemoSection() {
  const { state, act, replace } = useStore()
  const [confirm, setConfirm] = useState(null)
  const [failure, setFailure] = useState('QUOTA')
  const running = state.jobs.filter((j) => j.status === 'running').length
  return (
    <div className="flex flex-col gap-6">
      <Panel title="How the simulation works">
        <p className="text-sm">
          Jobs are simulated in this browser. Each job has a due time that is saved, so if you close the tab and come back, finished work is reconciled immediately. Nothing actually runs while the browser is closed, and no AI provider is contacted. In V1 a real server runs jobs around the clock.
        </p>
      </Panel>
      <Panel title="Job speed">
        <ChoiceGroup
          legend="How long simulated jobs take"
          name="speed"
          value={state.demo.speed}
          onChange={(v) => { act(updateDemo, { speed: v }); toast.success(`Speed: ${SPEEDS[v].label}`, { description: 'Applies to jobs started from now on.' }) }}
          options={Object.entries(SPEEDS).map(([k, s]) => ({ value: k, label: s.label, help: s.help }))}
        />
        <div className="mt-4">
          <Button variant="outline" disabled={!running} onClick={() => { replace(finishRunningJobs(state, Date.now())); toast.success('Finished running jobs') }}>
            <FastForward data-icon="inline-start" /> Finish {running} running job{running === 1 ? '' : 's'} now
          </Button>
        </div>
      </Panel>
      <Panel title="Simulate a provider failure" description="The next AI job (any lecture) stops with this error, so you can see the blocked state and recovery.">
        <div className="flex flex-wrap items-end gap-3">
          <FormRow label="Failure" htmlFor="fail-code" className="min-w-64">
            <NativeSelect id="fail-code" value={failure} onChange={(e) => setFailure(e.target.value)}>
              {Object.entries(FAILURE_CODES).filter(([k]) => k !== 'BUDGET' && k !== 'CREDENTIAL' && k !== 'MODEL').map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
            </NativeSelect>
          </FormRow>
          <Button variant="outline" onClick={() => { act(updateDemo, { injectFailure: failure }); toast.success('Armed', { description: 'The next AI job will fail.' }) }}>Fail the next job</Button>
          {state.demo.injectFailure && <Button variant="ghost" onClick={() => act(updateDemo, { injectFailure: null })}>Cancel ({FAILURE_CODES[state.demo.injectFailure].label})</Button>}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Budget, credential and model errors come from real settings: lower the budget limit, disconnect or reject a provider, or pick an “unavailable” model.</p>
      </Panel>
      <Panel title="Reset">
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={() => setConfirm('reset')}><RotateCcw data-icon="inline-start" /> Reset demo data</Button>
          <Button variant="outline" onClick={() => setConfirm('empty')}>Start with an empty workspace</Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Data is stored only in this browser (localStorage, versioned). Resetting restores the synthetic fixtures.</p>
      </Panel>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'empty' ? 'Start with an empty workspace?' : 'Reset all demo data?'}
        description={confirm === 'empty' ? 'All lectures, notifications and history are removed. Sample prompts, Skills and settings are kept so you can try the first-run experience.' : 'Everything you changed is replaced with the original synthetic demo lectures, prompts and settings.'}
        confirmLabel={confirm === 'empty' ? 'Empty the workspace' : 'Reset demo'}
        destructive
        onConfirm={() => {
          const next = confirm === 'empty' ? emptyWorkspace(Date.now(), { speed: state.demo.speed }) : seedDemo(Date.now(), { speed: state.demo.speed })
          window.__lectureStudio?.reset ? window.__lectureStudio.reset({ empty: confirm === 'empty', speed: state.demo.speed }) : replace(next)
          setConfirm(null)
          toast.success(confirm === 'empty' ? 'Workspace emptied' : 'Demo data restored')
        }}
      />
    </div>
  )
}

const RENDER = { profile: ProfileSection, defaults: DefaultsSection, providers: ProvidersSection, notifications: NotificationsSection, budget: BudgetSection, demo: DemoSection }

export default function Settings() {
  const [params, setParams] = useSearchParams()
  const section = SECTIONS.some((s) => s.id === params.get('section')) ? params.get('section') : 'providers'
  const Section = RENDER[section]
  return (
    <div>
      <PageHeader title="Settings" description="Everything here is simulated. No real credentials, providers, notifications or charges." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  aria-current={section === s.id ? 'page' : undefined}
                  onClick={() => setParams({ section: s.id }, { replace: true })}
                  className={cn('flex h-11 w-full items-center gap-2.5 rounded-md px-3 text-sm font-semibold whitespace-nowrap', section === s.id ? 'bg-navy text-white' : 'hover:bg-subtle')}
                >
                  <s.icon aria-hidden className="size-4" /> {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0"><Section key={section} /></div>
      </div>
    </div>
  )
}
