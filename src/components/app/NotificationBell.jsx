import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCircle2, Eye } from 'lucide-react'
import { useNow, useStore } from '@/state/store.jsx'
import { markAllRead, markNotificationRead } from '@/engine/library.js'
import { relativeTime } from '@/lib/format.js'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export const KIND_ICON = { review: Eye, issue: AlertTriangle, completed: CheckCircle2, info: Bell }
export const KIND_TONE = {
  review: 'bg-review-bg text-review',
  issue: 'bg-blocked-bg text-blocked',
  completed: 'bg-completed-bg text-completed',
  info: 'bg-subtle text-muted-foreground',
}

export function NotificationBell() {
  const { state, act } = useStore()
  const now = useNow()
  const [open, setOpen] = useState(false)
  const unread = state.notifications.filter((n) => !n.readAt).length
  const recent = state.notifications.slice(0, 6)

  const openItem = (n) => {
    act(markNotificationRead, n.id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} unread`} />
        }
      >
        <Bell />
        {unread > 0 && (
          <span aria-hidden className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 ring-2 ring-surface items-center justify-center rounded-full bg-destructive px-1 text-[0.7rem] font-bold text-white tabular">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Notifications</h2>
          <Button variant="ghost" size="sm" disabled={!unread} onClick={() => act(markAllRead)}>Mark all read</Button>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No notifications yet. You’ll be told here as soon as a review is ready.</p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto">
            {recent.map((n) => {
              const Icon = KIND_ICON[n.kind] || Bell
              return (
                <li key={n.id} className="border-b last:border-b-0">
                  <Link
                    to={n.deepLink || '/notifications'}
                    onClick={() => openItem(n)}
                    className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle focus-visible:bg-subtle"
                  >
                    <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md', KIND_TONE[n.kind])}>
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm leading-snug', !n.readAt ? 'font-semibold' : 'font-medium')}>{!n.readAt && <span className="sr-only">Unread: </span>}{n.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{n.body}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {relativeTime(n.createdAt, now)}
                        {n.resolvedAt ? ` · ${n.resolution}` : ''}
                      </span>
                    </span>
                    {!n.readAt && <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-teal" />}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        <div className="border-t px-4 py-2.5">
          <Link to="/notifications" onClick={() => setOpen(false)} className="text-sm font-semibold text-navy underline-offset-4 hover:underline">
            View all notifications and delivery log
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
