// React binding for the simulation engine: versioned localStorage persistence, a 1 s simulation
// clock, cross-tab sync and toasts for new review-ready events. The engine itself stays pure.
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SCHEMA_VERSION, STORAGE_KEY } from '@/engine/constants.js'
import { emptyWorkspace, seedDemo } from '@/engine/seed.js'
import { finishRunningJobs, hasDueJobs, tick } from '@/engine/workflow.js'

const StoreContext = createContext(null)

function load() {
  const now = Date.now()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.schemaVersion === SCHEMA_VERSION) {
        const doneBefore = parsed.jobs.filter((j) => j.status === 'done').length
        const reconciled = tick(parsed, now)
        const finishedWhileAway = reconciled.jobs.filter((j) => j.status === 'done').length - doneBefore
        return { state: reconciled, finishedWhileAway, restored: true }
      }
    }
  } catch {
    // Corrupt or unavailable storage — fall back to a fresh synthetic demo.
  }
  return { state: seedDemo(now), finishedWhileAway: 0, restored: false }
}

function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function StoreProvider({ children, onNavigate }) {
  const initial = useMemo(load, [])
  const [state, setState] = useState(initial.state)
  const ref = useRef(initial.state)
  const toasted = useRef(new Set(initial.state.notifications.map((n) => n.id)))
  const navRef = useRef(onNavigate)
  navRef.current = onNavigate

  const commit = useCallback((next) => {
    ref.current = next
    setState(next)
    persist(next)
  }, [])

  /** Run a pure engine operation: fn(state, ...args, now) -> { state, result }. Returns result. */
  const act = useCallback((fn, ...args) => {
    const { state: next, result } = fn(ref.current, ...args, Date.now())
    if (next !== ref.current) commit(next)
    return result
  }, [commit])

  const replace = useCallback((next) => commit(next), [commit])

  // Simulation clock
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      if (hasDueJobs(ref.current, now)) commit(tick(ref.current, now))
    }, 1000)
    return () => clearInterval(id)
  }, [commit])

  // Persist the reconciled state once and report work finished while closed.
  useEffect(() => {
    persist(ref.current)
    if (initial.restored && initial.finishedWhileAway > 0) {
      toast.info(`While you were away, ${initial.finishedWhileAway} simulated job${initial.finishedWhileAway === 1 ? '' : 's'} finished.`)
    }
  }, [initial])

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue)
        if (parsed?.schemaVersion === SCHEMA_VERSION) {
          ref.current = parsed
          setState(parsed)
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // In-app toast for each new actionable notification (immediate, no batching).
  useEffect(() => {
    const fresh = state.notifications.filter((n) => !toasted.current.has(n.id))
    fresh.forEach((n) => toasted.current.add(n.id))
    if (!state.profile.notificationPrefs.toast) return
    fresh.slice(0, 3).forEach((n) => {
      const opts = {
        description: n.body,
        action: n.deepLink ? { label: n.kind === 'review' ? 'Review' : 'Open', onClick: () => navRef.current?.(n.deepLink) } : undefined,
        duration: 8000,
      }
      if (n.kind === 'issue') toast.error(n.title, opts)
      else if (n.kind === 'completed') toast.success(n.title, opts)
      else toast(n.title, opts)
    })
  }, [state.notifications, state.profile.notificationPrefs.toast])

  // Test / demo hooks (synthetic state only).
  useEffect(() => {
    window.__lectureStudio = {
      getState: () => ref.current,
      finishRunningJobs: () => commit(finishRunningJobs(ref.current, Date.now())),
      reset: (opts = {}) => {
        const next = opts.empty ? emptyWorkspace(Date.now(), opts) : seedDemo(Date.now(), opts)
        toasted.current = new Set(next.notifications.map((n) => n.id))
        commit(next)
      },
    }
  }, [commit])

  const value = useMemo(() => ({ state, act, replace, toastedRef: toasted }), [state, act, replace])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

/** Re-render on an interval so relative times stay fresh. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
