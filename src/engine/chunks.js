// 60–90 second narration chunk planning — JavaScript port of the baseline helper/app/chunks.py rules.
// 600 s → 7 chunks of 85–86 s; 7..10 chunks are valid, 6 is not.
import { CHUNK_MAX_S, CHUNK_MIN_S } from './constants.js'
import { mmss, pad2 } from './util.js'

const PREFERRED_MAX_S = 88

export function chunkCountRange(totalSeconds) {
  return [Math.ceil(totalSeconds / CHUNK_MAX_S), Math.floor(totalSeconds / CHUNK_MIN_S)]
}

export function isPartitionable(totalSeconds) {
  const [lo, hi] = chunkCountRange(totalSeconds)
  return totalSeconds > 0 && lo <= hi
}

/**
 * Deterministic chunk plan. Policy FINAL_SHORT allows a declared short last chunk when the
 * duration cannot be split into 60–90 s pieces; ASK (default) adjusts to the nearest valid duration.
 */
export function planChunks(totalSeconds, policy = 'ASK') {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) throw new Error('Duration must be positive.')
  let seconds = Math.round(totalSeconds)
  let exception = null
  if (!isPartitionable(seconds)) {
    if (policy === 'FINAL_SHORT') {
      const full = Math.floor(seconds / PREFERRED_MAX_S)
      const chunks = []
      let start = 0
      for (let i = 0; i < full; i++) {
        chunks.push(makeChunk(i, start, PREFERRED_MAX_S))
        start += PREFERRED_MAX_S
      }
      chunks.push(makeChunk(full, start, seconds - start, true))
      return { totalSeconds: seconds, chunks, exception: 'FINAL_SHORT' }
    }
    exception = { requested: seconds }
    seconds = seconds < CHUNK_MIN_S ? CHUNK_MIN_S : CHUNK_MAX_S
    exception.adjustedTo = seconds
  }
  const [lo, hi] = chunkCountRange(seconds)
  const count = Math.min(hi, Math.max(lo, Math.ceil(seconds / PREFERRED_MAX_S)))
  const base = Math.floor(seconds / count)
  const extra = seconds - base * count
  const chunks = []
  let start = 0
  for (let i = 0; i < count; i++) {
    const len = base + (i < extra ? 1 : 0)
    chunks.push(makeChunk(i, start, len))
    start += len
  }
  return { totalSeconds: seconds, chunks, exception }
}

function makeChunk(i, start, seconds, shortException = false) {
  const id = pad2(i + 1)
  return {
    id,
    startSeconds: start,
    endSeconds: start + seconds,
    targetSeconds: seconds,
    window: `${mmss(start)}–${mmss(start + seconds)}`,
    transcriptFile: `transcript_${id}.txt`,
    audioFile: `voice_${id}.wav`,
    finalShortException: shortException,
  }
}

export function validatePlan(plan) {
  const errors = []
  plan.chunks.forEach((c, i) => {
    const ok = c.targetSeconds >= CHUNK_MIN_S && c.targetSeconds <= CHUNK_MAX_S
    if (!ok && !(c.finalShortException && i === plan.chunks.length - 1)) {
      errors.push(`Chunk ${c.id} targets ${c.targetSeconds} s (outside 60–90 s).`)
    }
  })
  return errors
}
