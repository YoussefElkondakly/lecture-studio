// Tiny, safe Markdown renderer for the synthetic lecture documents (headings, lists, tables,
// blockquotes, paragraphs). Produces React elements — never injects raw HTML.
import { Fragment } from 'react'
import { cn } from '@/lib/utils'

function inline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|“[^”]*”)/g)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>
    return <Fragment key={i}>{part}</Fragment>
  })
}

/** Lines present in `md` but not in `previous` are marked as changed. */
export function Markdown({ md, previous, highlight = false, className, rtl }) {
  const prevSet = new Set((previous || '').split('\n').map((l) => l.trim()))
  const changed = (line) => highlight && previous != null && line.trim() && !prevSet.has(line.trim())
  const lines = md.split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^#{1,3} /.test(line)) {
      const level = line.match(/^#+/)[0].length
      const H = `h${level + 1}`
      blocks.push(<H key={i} dir={rtl ? 'auto' : undefined} className={cn(changed(line) && 'changed-line')}>{inline(line.replace(/^#+ /, ''))}</H>)
      i++
    } else if (/^> /.test(line)) {
      blocks.push(
        <p key={i} dir={rtl ? 'auto' : undefined} className="rounded-md border-s-4 border-review-line bg-review-bg/60 px-3 py-2 text-sm font-sans text-review">
          {inline(line.slice(2))}
        </p>,
      )
      i++
    } else if (/^- /.test(line)) {
      const items = []
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(<li key={i} dir={rtl ? 'auto' : undefined} className={cn(changed(lines[i]) && 'changed-line')}>{inline(lines[i].slice(2))}</li>)
        i++
      }
      blocks.push(<ul key={`ul${i}`}>{items}</ul>)
    } else if (/^\|/.test(line)) {
      const rows = []
      while (i < lines.length && /^\|/.test(lines[i])) {
        if (!/^\|\s*-/.test(lines[i])) rows.push({ cells: lines[i].split('|').slice(1, -1).map((c) => c.trim()), changed: changed(lines[i]), key: i })
        i++
      }
      const [head, ...body] = rows
      blocks.push(
        <div key={`t${i}`} className="overflow-x-auto">
          <table>
            <thead><tr>{head.cells.map((c, j) => <th key={j} scope="col">{c}</th>)}</tr></thead>
            <tbody>
              {body.map((r) => (
                <tr key={r.key} className={cn(r.changed && 'changed-line')}>{r.cells.map((c, j) => <td key={j}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
    } else if (line.trim() === '') {
      i++
    } else {
      blocks.push(<p key={i} dir={rtl ? 'auto' : undefined} className={cn(changed(line) && 'changed-line')}>{inline(line)}</p>)
      i++
    }
  }
  return (
    <div className={cn('doc-prose', rtl && 'rtl-content', className)} dir={rtl ? 'rtl' : undefined} lang={rtl ? 'ar-EG' : undefined}>
      {blocks}
    </div>
  )
}
