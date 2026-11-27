// Small deterministic helpers (no randomness: simulation must be reproducible in tests).

/** FNV-1a 32-bit hash → 8 hex chars. Used as a stand-in for SHA-256 fingerprints. */
export function hash(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Deterministic pseudo-random number in [0, 1) derived from a seed string. */
export function seeded(seed) {
  return parseInt(hash(seed), 16) / 0x100000000
}

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function mmss(totalSeconds) {
  const s = Math.round(totalSeconds)
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}

/** Monotonic id generator stored in state so ids survive reloads without collisions. */
export function nextId(state, prefix) {
  state.counters = state.counters || {}
  state.counters[prefix] = (state.counters[prefix] || 0) + 1
  return `${prefix}_${state.counters[prefix].toString(36).padStart(3, '0')}`
}

export function clone(value) {
  return structuredClone(value)
}

export function last(arr) {
  return arr.length ? arr[arr.length - 1] : undefined
}
