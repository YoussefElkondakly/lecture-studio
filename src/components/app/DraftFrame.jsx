// Simulated draft frame drawn from storyboard scene data (no image generation involved).
const PALETTES = [
  { bg: '#153C63', fg: '#FFFFFF', sub: '#C5D3E0', accent: '#5FD3C6' },
  { bg: '#F5F7FA', fg: '#142B45', sub: '#52647A', accent: '#087F76' },
  { bg: '#E3F3F1', fg: '#0F2E4D', sub: '#3E5A55', accent: '#153C63' },
]

function wrap(text, max) {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) {
      if (line) lines.push(line)
      line = w
    } else line = `${line} ${w}`.trim()
    if (lines.length === 2) break
  }
  if (line && lines.length < 3) lines.push(line)
  return lines.slice(0, 3)
}

export function DraftFrame({ scene, rtl, final = false, className }) {
  const c = PALETTES[scene.palette ?? 0]
  const lines = wrap(scene.onScreen, 26)
  const x = rtl ? 300 : 20
  const anchor = rtl ? 'end' : 'start'
  return (
    <svg viewBox="0 0 320 180" role="img" aria-label={`${final ? 'Final' : 'Draft'} frame ${scene.id}: ${scene.onScreen}`} className={className}>
      <rect width="320" height="180" rx="6" fill={c.bg} />
      {scene.id === 'S01' ? (
        <circle cx={rtl ? 60 : 260} cy="90" r="46" fill={c.accent} opacity=".25" />
      ) : (
        <g opacity=".9">
          <rect x={rtl ? 20 : 196} y="64" width="104" height="70" rx="4" fill="none" stroke={c.accent} strokeWidth="2" />
          <path d={rtl ? 'M30 120 L55 98 L75 110 L105 80' : 'M206 120 L231 98 L251 110 L281 80'} stroke={c.accent} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      )}
      <text x={x} y="24" fill={c.sub} fontSize="10" fontFamily="Source Sans 3 Variable, sans-serif" textAnchor={anchor} direction={rtl ? 'rtl' : 'ltr'}>
        {scene.id} · {scene.heading}
      </text>
      {lines.map((l, i) => (
        <text key={i} x={x} y={66 + i * 20} fill={c.fg} fontSize="16" fontWeight="600" fontFamily="Source Serif 4 Variable, Georgia, serif" textAnchor={anchor} direction={rtl ? 'rtl' : 'ltr'}>
          {l}
        </text>
      ))}
      <rect x="0" y="172" width="320" height="8" fill={c.accent} />
      <text x={rtl ? 20 : 300} y="164" fill={c.sub} fontSize="8.5" fontFamily="Source Sans 3 Variable, sans-serif" textAnchor={rtl ? 'start' : 'end'}>
        {final ? 'Final frame · simulated' : 'Draft frame · simulated'}
      </text>
    </svg>
  )
}
