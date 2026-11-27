// Minimal text-only PDF writer (Helvetica, WinAnsi). Renders the exact canonical Markdown of a
// revision so the downloadable "paired PDF" really is generated from the same text.
// Arabic needs an embedded font with shaping — not supported here (reported honestly in the UI).

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 56

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function toWinAnsi(s) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/·/g, '-')
    .replace(/×/g, 'x')
    .replace(/•/g, '-')
    .replace(/[^\x20-\x7E]/g, '?')
}

export function canRenderPdf(text) {
  return !/[؀-ۿ]/.test(text)
}

function wrap(text, size, width) {
  const charW = size * 0.5
  const max = Math.max(10, Math.floor(width / charW))
  const words = text.split(/\s+/)
  const out = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) {
      if (line) out.push(line)
      line = w
    } else line = (line + ' ' + w).trim()
  }
  if (line) out.push(line)
  return out.length ? out : ['']
}

export function markdownToPdfBlob(md, { title, footer }) {
  const lines = []
  for (const raw of md.split('\n')) {
    const l = toWinAnsi(raw)
    if (/^# /.test(l)) lines.push({ text: l.slice(2), size: 18, bold: true, gap: 10 })
    else if (/^## /.test(l)) lines.push({ text: l.slice(3), size: 13.5, bold: true, gap: 12 })
    else if (/^### /.test(l)) lines.push({ text: l.slice(4), size: 11.5, bold: true, gap: 8 })
    else if (/^\|\s*-/.test(l)) continue
    else if (/^\|/.test(l)) lines.push({ text: l.split('|').slice(1, -1).map((c) => c.trim()).join('   |   '), size: 9.5, mono: false })
    else if (/^> /.test(l)) lines.push({ text: l.slice(2), size: 9.5, italic: true })
    else if (l.trim() === '') lines.push({ text: '', size: 6 })
    else lines.push({ text: l, size: 10.5 })
  }
  const pages = [[]]
  let y = PAGE_H - MARGIN
  for (const ln of lines) {
    const wrapped = wrap(ln.text, ln.size, PAGE_W - MARGIN * 2)
    for (const w of wrapped) {
      const h = ln.size * 1.45 + (ln.gap || 0)
      if (y - h < MARGIN + 20) {
        pages.push([])
        y = PAGE_H - MARGIN
      }
      y -= h
      pages[pages.length - 1].push({ ...ln, text: w, y })
    }
  }

  const objs = []
  const add = (s) => { objs.push(s); return objs.length }
  const catalog = add('')
  const pagesObj = add('')
  const fReg = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const fBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const fIt = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>')
  const pageIds = []
  pages.forEach((pg, i) => {
    let stream = 'BT\n'
    for (const ln of pg) {
      const f = ln.bold ? 'F2' : ln.italic ? 'F3' : 'F1'
      stream += `/${f} ${ln.size} Tf 1 0 0 1 ${MARGIN} ${ln.y.toFixed(1)} Tm (${esc(ln.text)}) Tj\n`
    }
    const foot = toWinAnsi(`${footer} - page ${i + 1} of ${pages.length}`)
    stream += `/F3 8 Tf 1 0 0 1 ${MARGIN} 30 Tm (${esc(foot)}) Tj\nET`
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    pageIds.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fReg} 0 R /F2 ${fBold} 0 R /F3 ${fIt} 0 R >> >> /Contents ${content} 0 R >>`))
  })
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
  const info = add(`<< /Title (${esc(toWinAnsi(title))}) /Producer (Lecture Studio prototype - synthetic) >>`)

  let out = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((o) => { out += `${String(o).padStart(10, '0')} 00000 n \n` })
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([out], { type: 'application/pdf' })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(text, filename, type = 'text/plain') {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename)
}
