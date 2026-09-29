import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import type { ToolDefinition } from '../../lib/tools'

type ToolCardProps = {
  tool: ToolDefinition
  /** Credits come from the backend cost table, not the catalogue. */
  credits: number | null
}

export function ToolCard({ tool, credits }: ToolCardProps) {
  const runnable = tool.documentType !== null

  const body = (
    <Card className="flex h-full flex-col gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-base text-primary" aria-hidden>{tool.icon}</span>
        <Badge tone={runnable ? 'accent' : 'neutral'}>
          {runnable ? (credits != null ? `${credits} kredit` : '—') : 'Segera'}
        </Badge>
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-foreground">{tool.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{tool.description}</p>
      </div>
      <span className="mt-auto border-t border-border pt-3 text-xs font-medium text-muted">{tool.category}</span>
    </Card>
  )

  if (!runnable) {
    return <div className="opacity-70" aria-disabled>{body}</div>
  }

  return (
    <Link to={`/app/tools/${tool.category.toLowerCase()}`} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2">
      {body}
    </Link>
  )
}
