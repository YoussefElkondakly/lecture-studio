const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function relativeTime(ts, now = Date.now()) {
  if (!ts) return '—'
  const diff = ts - now
  const abs = Math.abs(diff)
  const min = 60_000
  if (abs < min) return diff <= 0 ? 'just now' : 'in a moment'
  if (abs < 60 * min) return rtf.format(Math.round(diff / min), 'minute')
  if (abs < 24 * 60 * min) return rtf.format(Math.round(diff / (60 * min)), 'hour')
  return rtf.format(Math.round(diff / (24 * 60 * min)), 'day')
}

/** "2 h 05 min" style elapsed duration for review wait times. */
export function elapsed(ts, now = Date.now()) {
  if (!ts) return '—'
  const m = Math.max(0, Math.floor((now - ts) / 60_000))
  if (m < 1) return 'under a minute'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ${String(m % 60).padStart(2, '0')} min`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ${h % 24} h`
}

export function dateTime(ts) {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ts)
}

export function longDate(ts) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(ts)
}

export function bytes(n) {
  if (!n && n !== 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function usd(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

export function seconds(s) {
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return m ? `${m}:${String(r).padStart(2, '0')}` : `${r} s`
}

export function greeting(now = Date.now()) {
  const h = new Date(now).getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}
