import { memo, type ReactNode } from 'react'

/**
 * Minimal, dependency-free Markdown renderer for AI-generated documents.
 *
 * Handles the subset the generators actually emit: headings, fenced code,
 * tables, blockquotes, ordered/unordered lists, rules, and inline
 * bold/italic/code/links. Output goes through React elements, never
 * `dangerouslySetInnerHTML`, so document content cannot inject HTML.
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Order matters: code first, then links, then emphasis.
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${i++}`
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    } else {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)
      nodes.push(
        <a key={key} href={link?.[2]} target="_blank" rel="noreferrer" className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
          {link?.[1]}
        </a>,
      )
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

/** Split a table row into trimmed cells, dropping the outer pipes. */
const cells = (line: string) =>
  line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())

export type Heading = { id: string; text: string; level: number }

/** Headings of the document, for an in-page table of contents. */
export function markdownHeadings(markdown: string): Heading[] {
  const found: Heading[] = []
  let inFence = false
  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) inFence = !inFence
    if (inFence) continue
    const match = /^(#{1,4})\s+(.*)$/.exec(line)
    if (match) found.push({ id: slug(match[2]), text: match[2].replace(/[*`]/g, ''), level: match[1].length })
  }
  // Deduplicate ids so anchors stay unique when headings repeat.
  const seen = new Map<string, number>()
  return found.map((heading) => {
    const count = seen.get(heading.id) ?? 0
    seen.set(heading.id, count + 1)
    return count === 0 ? heading : { ...heading, id: `${heading.id}-${count}` }
  })
}

export const Markdown = memo(function Markdown({ source, className = '' }: { source: string; className?: string }) {
  const lines = source.split('\n')
  const blocks: ReactNode[] = []
  const seen = new Map<string, number>()
  let key = 0

  const uniqueId = (text: string) => {
    const base = slug(text)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  }

  for (let i = 0; i < lines.length; ) {
    const line = lines[i]

    // Fenced code block.
    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```/, '').trim()
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      i++ // consume closing fence
      blocks.push(
        <div key={key++} className="my-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {lang && <div className="border-b border-slate-700/60 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{lang}</div>}
          <pre className="overflow-x-auto p-4 text-[13px] leading-6">
            <code className="font-mono text-slate-100">{body.join('\n')}</code>
          </pre>
        </div>,
      )
      continue
    }

    // Table: header row followed by a separator row.
    if (line.includes('|') && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1] ?? '')) {
      const header = cells(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') rows.push(cells(lines[i++]))
      blocks.push(
        <div key={key++} className="my-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                {header.map((cell, index) => (
                  <th key={index} className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-left font-semibold text-foreground">
                    {inline(cell, `th-${index}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border-b border-border px-3.5 py-2.5 align-top text-slate-600">
                      {inline(cell, `td-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // Heading.
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const text = heading[2]
      const id = uniqueId(text)
      const styles: Record<number, string> = {
        1: 'mt-8 mb-3 border-b border-border pb-2 text-2xl font-bold tracking-tight text-foreground first:mt-0',
        2: 'mt-7 mb-2.5 text-xl font-semibold tracking-tight text-foreground',
        3: 'mt-5 mb-2 text-base font-semibold text-foreground',
        4: 'mt-4 mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted',
      }
      const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3' | 'h4'
      blocks.push(
        <Tag key={key++} id={id} className={`scroll-mt-24 ${styles[level]}`}>
          {inline(text, `h-${id}`)}
        </Tag>,
      )
      i++
      continue
    }

    // Horizontal rule.
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-6 border-border" />)
      i++
      continue
    }

    // Blockquote (may span consecutive lines).
    if (/^\s*>/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''))
      blocks.push(
        <blockquote key={key++} className="my-4 rounded-r-lg border-l-4 border-primary/30 bg-blue-50/50 px-4 py-3 text-sm text-slate-700">
          {inline(body.join(' '), `bq-${key}`)}
        </blockquote>,
      )
      continue
    }

    // Lists — unordered and ordered, with one level of nesting.
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items: { text: string; sub: string[] }[] = []
      while (i < lines.length && (/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        if (/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          items.push({ text: lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''), sub: [] })
        } else if (items.length) {
          items[items.length - 1].sub.push(lines[i].trim())
        }
        i++
      }
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={key++} className={`my-3 space-y-1.5 pl-5 text-sm leading-6 text-slate-700 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-slate-400`}>
          {items.map((item, index) => (
            <li key={index}>
              {inline(item.text, `li-${key}-${index}`)}
              {item.sub.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-1 pl-5 marker:text-slate-400">
                  {item.sub.map((sub, subIndex) => (
                    <li key={subIndex}>{inline(sub, `sub-${key}-${index}-${subIndex}`)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </Tag>,
      )
      continue
    }

    // Blank line — skip (block spacing is handled by margins).
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph: gather lines until a blank line or another block starts.
    const paragraph: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*(#{1,4}\s|```|>|([-*+]|\d+\.)\s)/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      paragraph.push(lines[i++])
    }
    blocks.push(
      <p key={key++} className="my-3 text-sm leading-7 text-slate-700">
        {inline(paragraph.join(' '), `p-${key}`)}
      </p>,
    )
  }

  return <div className={className}>{blocks}</div>
})
