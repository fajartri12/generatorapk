import type { ReactNode } from 'react'
import { Card } from '../../components/ui/Card'

/** Generation status values, in the order admins expect to see them. */
export const GENERATION_STATUSES = ['completed', 'running', 'pending', 'failed', 'cancelled'] as const

/** Bahasa Indonesia labels for generation statuses — shared so tabs never disagree. */
export const statusLabel: Record<string, string> = {
  completed: 'Selesai',
  running: 'Diproses',
  pending: 'Menunggu',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
}

/** Badge tone per status, shared for the same reason. */
export function statusTone(status: string) {
  if (status === 'completed') return 'success' as const
  if (status === 'failed') return 'danger' as const
  if (status === 'cancelled') return 'warning' as const
  return 'neutral' as const
}

/** Shared chrome for every admin tab: a title row plus optional actions. */
export function AdminSection({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

/** Warning banner for actions the API does not support yet — never a dead control. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">{children}</p>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
      />
    </label>
  )
}

/** Scrollable table shell so wide admin tables never break the page layout. */
export function TableShell({ minWidth, children }: { minWidth: string; children: ReactNode }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className={`w-full ${minWidth} text-left text-sm`}>{children}</table>
    </Card>
  )
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <th scope="col" className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted ${className}`}>{children}</th>
}

export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-foreground ${className}`}>{children}</td>
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-600',
    primary: 'bg-blue-50 text-primary-dark',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
  }
  return <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>
}

/** Empty state for a filtered list — always names the filter that emptied it. */
export function NoRows({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted">
        {label}
      </td>
    </tr>
  )
}

export function StatTile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="flex items-start gap-3">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
        <p className="text-xs text-muted">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
      </div>
    </Card>
  )
}
