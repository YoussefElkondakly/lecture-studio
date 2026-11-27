import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, ClipboardCheck, FlaskConical, House, Library, Menu, Plus, ScrollText, Settings, Shapes,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/state/store.jsx'
import { pendingReviews } from '@/engine/workflow.js'
import { Button, ButtonLink } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { NotificationBell } from './NotificationBell.jsx'

export function BrandMark({ className }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#087F76" />
      <path d="M6 16h20" stroke="#fff" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
      <rect x="9" y="10" width="5" height="12" rx="1.5" fill="#fff" />
      <rect x="18" y="10" width="5" height="12" rx="1.5" fill="#fff" />
    </svg>
  )
}

function useNav() {
  const { state } = useStore()
  const reviews = pendingReviews(state).length
  const unread = state.notifications.filter((n) => !n.readAt).length
  return [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/lectures', label: 'My lectures', icon: Library },
    { to: '/reviews', label: 'Pending reviews', icon: ClipboardCheck, count: reviews, countLabel: `${reviews} waiting` },
    { to: '/prompts', label: 'Master prompts', icon: ScrollText },
    { to: '/skills', label: 'Claude Skills', icon: Shapes },
    { to: '/notifications', label: 'Notifications', icon: Bell, count: unread, countLabel: `${unread} unread`, mobileOnly: true },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]
}

function NavItems({ onNavigate, mobile }) {
  const items = useNav().filter((i) => mobile || !i.mobileOnly)
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative flex h-11 items-center gap-3 rounded-md px-3 text-[0.975rem] font-medium transition-colors',
                mobile
                  ? isActive ? 'bg-navy-tint text-navy' : 'text-foreground hover:bg-subtle'
                  : isActive ? 'bg-white/12 text-white' : 'text-[#c5d3e0] hover:bg-white/8 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !mobile && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-1 rounded-r bg-[#5fd3c6]" />}
                <item.icon aria-hidden className="size-[1.15rem] shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.count > 0 && (
                  <span
                    className={cn(
                      'ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-bold tabular',
                      item.to === '/reviews' ? 'bg-review-bg text-review' : mobile ? 'bg-navy text-white' : 'bg-white/15 text-white',
                    )}
                  >
                    {item.count}
                    <span className="sr-only"> {item.countLabel}</span>
                  </span>
                )}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

function PrototypeIndicator({ dark }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to="/settings?section=demo"
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed px-2.5 text-xs font-semibold',
              dark ? 'border-white/35 text-[#c5d3e0] hover:text-white' : 'border-[#7c8ea3] text-muted-foreground hover:text-foreground',
            )}
          />
        }
      >
        <FlaskConical aria-hidden className="size-3.5" />
        Prototype · simulated data
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        Every AI job, provider, notification and cost here is simulated. No real APIs, keys or patient data are used.
      </TooltipContent>
    </Tooltip>
  )
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const onNewLecture = location.pathname === '/lectures/new'
  const pageHasCta = ['/', '/lectures'].includes(location.pathname)

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-navy px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy lg:flex" aria-label="Primary">
        <Link to="/" className="flex h-16 items-center gap-2.5 px-5 text-white">
          <BrandMark className="size-8" />
          <span className="font-serif text-xl font-semibold tracking-[-0.01em]">Lecture Studio</span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pt-2" aria-label="Main navigation">
          <NavItems />
        </nav>
        <div className="flex flex-col gap-3 border-t border-white/12 px-5 py-4">
          <PrototypeIndicator dark />
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-white/12 font-serif text-sm font-semibold text-white">AE</span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-white">Dr. Ashraf Elbasel</p>
              <p className="text-xs text-[#c5d3e0]">Lecture author</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
          <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-3 px-4 md:px-8">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu" onClick={() => setMenuOpen(true)}>
              <Menu />
            </Button>
            <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="Lecture Studio home">
              <BrandMark className="size-7" />
              <span className="hidden font-serif text-lg font-semibold sm:inline">Lecture Studio</span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden md:block lg:hidden"><PrototypeIndicator /></div>
              <NotificationBell />
              {!onNewLecture && !pageHasCta && (
                <ButtonLink as={Link} to="/lectures/new" className="hidden sm:inline-flex">
                  <Plus data-icon="inline-start" />
                  Start new lecture
                </ButtonLink>
              )}
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto max-w-[1320px] px-4 pt-6 pb-24 outline-none md:px-8 md:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile navigation */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[19rem] p-0">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="flex items-center gap-2 font-serif text-lg">
              <BrandMark className="size-7" /> Lecture Studio
            </SheetTitle>
            <SheetDescription className="sr-only">Main navigation</SheetDescription>
          </SheetHeader>
          <nav className="px-3 py-3" aria-label="Main navigation">
            <NavItems mobile onNavigate={() => setMenuOpen(false)} />
          </nav>
          <div className="flex flex-col gap-3 border-t px-5 py-4">
            <Button onClick={() => { setMenuOpen(false); navigate('/lectures/new') }}>
              <Plus data-icon="inline-start" /> Start new lecture
            </Button>
            <PrototypeIndicator />
          </div>
        </SheetContent>
      </Sheet>

      {/* Phone: persistent primary action */}
      {!onNewLecture && !location.pathname.includes('/review/') && (
        <div className="fixed right-4 bottom-4 z-20 sm:hidden">
          <ButtonLink as={Link} to="/lectures/new" size="lg" className="shadow-overlay">
            <Plus data-icon="inline-start" /> New lecture
          </ButtonLink>
        </div>
      )}
    </div>
  )
}
