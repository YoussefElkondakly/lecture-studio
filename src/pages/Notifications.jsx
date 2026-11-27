import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Bell, BellOff, Mail, MailOpen, Smartphone } from 'lucide-react'
import { useNow, useStore } from '@/state/store.jsx'
import { markAllRead, markNotificationRead, markNotificationUnread } from '@/engine/library.js'
import { dateTime, relativeTime } from '@/lib/format.js'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DemoTag, EmptyState, PageHeader, Panel } from '@/components/app/common.jsx'
import { KIND_ICON, KIND_TONE } from '@/components/app/NotificationBell.jsx'
import { BrandMark } from '@/components/app/AppShell.jsx'

const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'unread', label: 'Unread', match: (n) => !n.readAt },
  { id: 'review', label: 'Needs review', match: (n) => n.kind === 'review' && !n.resolvedAt },
  { id: 'issues', label: 'Issues', match: (n) => n.kind === 'issue' },
]

const CHANNEL_TEXT = { delivered: 'Shown', simulated: 'Simulated', off: 'Off' }

function Previews({ n }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return (
    <div className="flex flex-col gap-6">
      <Panel title="Email preview" description={n.channelStatuses.email === 'simulated' ? 'What would be sent. Not sent — simulated.' : 'Email is off for this kind of notification.'}>
        <div className={cn('rounded-lg border', n.channelStatuses.email === 'off' && 'opacity-60')}>
          <div className="border-b px-4 py-2.5 text-sm">
            <p><span className="text-muted-foreground">To:</span> dr.ashraf@example.invalid</p>
            <p><span className="text-muted-foreground">Subject:</span> <span className="font-semibold">{n.title}</span></p>
          </div>
          <div className="px-4 py-4 text-sm">
            <div className="mb-3 flex items-center gap-2 font-serif font-semibold"><BrandMark className="size-5" /> Lecture Studio</div>
            <p>Dear Dr. Ashraf,</p>
            <p className="mt-2">{n.body}</p>
            {n.deepLink && (
              <p className="mt-3">
                <span className="inline-block rounded-md bg-teal px-3 py-1.5 font-semibold text-white">{n.kind === 'review' ? 'Open the review' : 'Open the lecture'}</span>
                <span className="mt-1 block break-all text-xs text-muted-foreground">{origin}{n.deepLink}</span>
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">You receive this because email notifications are on. Prototype — nothing was sent.</p>
          </div>
        </div>
      </Panel>
      <Panel title="Phone push preview" description={n.channelStatuses.push === 'simulated' ? 'Simulated — no browser permission is requested.' : 'Push is off for this kind of notification.'}>
        <div className={cn('mx-auto max-w-sm rounded-2xl bg-[#0f2e4d] p-3', n.channelStatuses.push === 'off' && 'opacity-60')}>
          <div className="flex gap-3 rounded-xl bg-white/95 p-3">
            <BrandMark className="size-9 shrink-0" />
            <div className="min-w-0 text-sm">
              <p className="flex justify-between gap-2"><span className="font-semibold">Lecture Studio</span><span className="text-xs text-muted-foreground">now</span></p>
              <p className="font-semibold">{n.title}</p>
              <p className="line-clamp-2 text-muted-foreground">{n.body}</p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}

export default function Notifications() {
  const { state, act } = useStore()
  const now = useNow()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = FILTERS.find((f) => f.id === params.get('filter')) || FILTERS[0]
  const rows = state.notifications.filter(filter.match)
  const [selectedId, setSelectedId] = useState(null)
  const selected = state.notifications.find((n) => n.id === selectedId) || rows[0]
  const unread = state.notifications.filter((n) => !n.readAt).length

  const open = (n) => {
    act(markNotificationRead, n.id)
    if (n.deepLink) navigate(n.deepLink)
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="A notification is created the moment a review is ready — one per lecture, stage and version. Email and push are simulated; nothing leaves this browser."
        actions={<Button variant="outline" disabled={!unread} onClick={() => act(markAllRead)}><MailOpen data-icon="inline-start" /> Mark all read</Button>}
      />
      <Tabs defaultValue="inbox">
        <TabsList variant="line" className="mb-5 border-b">
          <TabsTrigger value="inbox" className="h-10 px-3">Inbox ({unread} unread)</TabsTrigger>
          <TabsTrigger value="log" className="h-10 px-3">Delivery log</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox">
          <div role="group" aria-label="Filter notifications" className="mb-4 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter.id === f.id} onClick={() => setParams(f.id === 'all' ? {} : { filter: f.id }, { replace: true })}
                className={cn('inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold', filter.id === f.id ? 'border-navy bg-navy text-white' : 'bg-surface hover:bg-subtle')}>
                {f.label}
                <span className={cn('text-xs tabular', filter.id === f.id ? 'text-[#c5d3e0]' : 'text-muted-foreground')}>{state.notifications.filter(f.match).length}</span>
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={BellOff} title="Nothing here" description={filter.id === 'all' ? 'Notifications appear when a lecture needs you or a job stops.' : 'No notifications match this filter.'} />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <ul className="flex flex-col divide-y rounded-xl border bg-surface">
                {rows.map((n) => {
                  const Icon = KIND_ICON[n.kind] || Bell
                  return (
                    <li key={n.id} className={cn('flex gap-3 px-4 py-3.5', selected?.id === n.id && 'bg-subtle')}>
                      <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md', KIND_TONE[n.kind])}><Icon aria-hidden className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-[0.975rem] leading-snug', !n.readAt ? 'font-semibold' : 'font-medium')}>
                          {!n.readAt && <span className="sr-only">Unread: </span>}{n.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{n.body}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{relativeTime(n.createdAt, now)}</span>
                          <span>In-app: {CHANNEL_TEXT[n.channelStatuses.inApp]}</span>
                          <span>Email: {CHANNEL_TEXT[n.channelStatuses.email]}</span>
                          <span>Push: {CHANNEL_TEXT[n.channelStatuses.push]}</span>
                          {n.resolvedAt && <span className="font-semibold">Resolved — {n.resolution}</span>}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {n.deepLink && <Button size="sm" variant={n.kind === 'review' && !n.resolvedAt ? 'accent' : 'outline'} onClick={() => open(n)}>{n.kind === 'review' && !n.resolvedAt ? 'Open review' : 'Open'}</Button>}
                          <Button size="sm" variant="ghost" onClick={() => act(n.readAt ? markNotificationUnread : markNotificationRead, n.id)}>{n.readAt ? 'Mark unread' : 'Mark read'}</Button>
                          <Button size="sm" variant="ghost" className="xl:inline-flex" onClick={() => setSelectedId(n.id)} aria-pressed={selected?.id === n.id}>Preview email &amp; push</Button>
                        </div>
                      </div>
                      {!n.readAt && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-teal" aria-hidden />}
                    </li>
                  )
                })}
              </ul>
              {selected && <div className="xl:sticky xl:top-24 xl:self-start"><Previews n={selected} /></div>}
            </div>
          )}
        </TabsContent>
        <TabsContent value="log">
          <Panel title="Simulated delivery log" description={<>Every email and push event that would have been sent. <DemoTag>No network requests</DemoTag> <Link to="/settings?section=notifications" className="font-semibold text-navy underline">Channel settings</Link></>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-4">Time</th><th className="py-2 pr-4">Channel</th><th className="py-2 pr-4">To</th><th className="py-2 pr-4">Subject</th><th className="py-2">Status</th></tr></thead>
                <tbody>
                  {state.deliveryLog.slice(0, 60).map((d) => (
                    <tr key={d.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 whitespace-nowrap tabular">{dateTime(d.at)}</td>
                      <td className="py-2 pr-4"><span className="inline-flex items-center gap-1.5">{d.channel === 'email' ? <Mail aria-hidden className="size-4" /> : <Smartphone aria-hidden className="size-4" />}{d.channel === 'email' ? 'Email' : 'Push'}</span></td>
                      <td className="py-2 pr-4">{d.to}</td>
                      <td className="py-2 pr-4">{d.subject}</td>
                      <td className="py-2 whitespace-nowrap">{d.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
