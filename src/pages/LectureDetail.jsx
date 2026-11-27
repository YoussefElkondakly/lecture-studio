import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Archive, ArchiveRestore, CheckCircle2, Copy, FileQuestion, MoreHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'
import { useNow, useStore } from '@/state/store.jsx'
import { STATUS } from '@/engine/constants.js'
import { archiveProject, completedGateCount, duplicateProject, getProject, restoreProject } from '@/engine/workflow.js'
import { bytes, relativeTime, usd } from '@/lib/format.js'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog, DemoTag, EmptyState, KeyValue, PageHeader, Panel } from '@/components/app/common.jsx'
import { StatusBadge } from '@/components/app/status.jsx'
import { ProductionRail } from '@/components/app/ProductionRail.jsx'
import { NowPanel } from './lecture/NowPanel.jsx'
import { DeliverablesTab, HistoryTab, SetupTab, VersionsTab } from './lecture/Tabs.jsx'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'versions', label: 'Versions & files' },
  { id: 'history', label: 'Approval history' },
  { id: 'setup', label: 'Prompts & settings' },
  { id: 'deliverables', label: 'Deliverables' },
]

export default function LectureDetail() {
  const { id } = useParams()
  const { state, act } = useStore()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const [archiving, setArchiving] = useState(false)
  const p = getProject(state, id)

  if (!p) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Lecture not found"
        description="It may have been removed when the demo was reset."
        action={<Button render={<Link to="/lectures" />} nativeButton={false}>Back to My lectures</Button>}
      />
    )
  }

  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview'
  const setTab = (t) => {
    const next = new URLSearchParams(params)
    next.delete('started')
    if (t === 'overview') next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true })
  }
  const started = params.get('started') === '1'
  const cost = state.usage.filter((u) => u.projectId === p.id).reduce((s, u) => s + u.estimatedCost, 0)
  const notifications = state.notifications.filter((n) => n.projectId === p.id).slice(0, 4)

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'My lectures', to: '/lectures' }, { label: p.title }]}
        title={p.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge status={p.status} />
            <span>{p.prefs.audience} · {p.prefs.language} · {p.prefs.durationMin} min</span>
            <span>Updated {relativeTime(p.updatedAt, now)}</span>
          </span>
        }
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <MoreHorizontal data-icon="inline-start" /> Actions
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => { const r = act(duplicateProject, p.id); if (r.ok) toast.success('Duplicated as a new draft', { description: 'Approvals are not copied.' }) }}>
                  <Copy /> Duplicate as new lecture
                </DropdownMenuItem>
                {p.archivedAt ? (
                  <DropdownMenuItem onClick={() => { act(restoreProject, p.id); toast.success('Restored') }}><ArchiveRestore /> Restore</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setArchiving(true)}><Archive /> Archive…</DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {started && (
        <Alert variant="success" className="mb-6">
          <CheckCircle2 aria-hidden />
          <AlertTitle>Lecture started</AlertTitle>
          <AlertDescription>
            <p>Lecture content generation is queued with the selected prompt version. You can go back to your dashboard now — you’ll be notified as soon as the medical content review (H1) is ready.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" render={<Link to="/" />} nativeButton={false}>Back to Home</Button>
              <Button size="sm" variant="ghost" onClick={() => setTab('overview')}><X data-icon="inline-start" /> Dismiss</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {p.status !== STATUS.DRAFT && (
        <Panel
          className="mb-6"
          title="Production line"
          description={`${completedGateCount(p)} of 6 approvals recorded. Machine steps run on their own; the six gates wait for you.`}
          bodyClassName="px-4 py-6 md:px-6"
        >
          <ProductionRail project={p} />
        </Panel>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <TabsList variant="line" className="w-max gap-1 border-b">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="h-10 px-3">{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="pt-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              <NowPanel project={p} />
              <Panel title="Source">
                <KeyValue items={[
                  ['File', p.source.name],
                  ['Type', `${p.source.type}${p.source.size ? ` · ${bytes(p.source.size)}` : ''}`],
                  ['Origin', p.source.origin === 'demo' ? 'Synthetic demo source' : p.source.origin === 'upload' ? 'Attached file — metadata only (prototype)' : 'Pasted notes'],
                  ['Content prompt', `${p.promptRefs.A?.title} — v${p.promptRefs.A?.version}`],
                ]} />
              </Panel>
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <Panel title="Notifications for this lecture">
                {notifications.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
                  <ul className="flex flex-col divide-y">
                    {notifications.map((n) => (
                      <li key={n.id} className="py-2.5 text-sm">
                        {n.deepLink ? <Link to={n.deepLink} className="font-semibold underline-offset-4 hover:underline">{n.title}</Link> : <span className="font-semibold">{n.title}</span>}
                        <p className="text-xs text-muted-foreground">{relativeTime(n.createdAt, now)}{n.resolvedAt ? ` · ${n.resolution}` : ' · open'}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Cost so far">
                <p className="font-serif text-2xl font-semibold tabular">{usd(cost)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Mock estimate from simulated jobs. <DemoTag>No real charges</DemoTag></p>
              </Panel>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="versions" className="pt-6"><VersionsTab project={p} /></TabsContent>
        <TabsContent value="history" className="pt-6"><HistoryTab project={p} /></TabsContent>
        <TabsContent value="setup" className="pt-6"><SetupTab project={p} /></TabsContent>
        <TabsContent value="deliverables" className="pt-6"><DeliverablesTab project={p} onArchive={() => setArchiving(true)} /></TabsContent>
      </Tabs>

      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title="Archive this lecture?"
        description="Running simulated jobs stop. Files, versions and approval history are kept, and you can restore it later."
        confirmLabel="Archive lecture"
        destructive
        onConfirm={() => { act(archiveProject, p.id); setArchiving(false); toast.success('Archived') }}
      />
    </div>
  )
}
