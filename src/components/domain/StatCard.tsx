import type { ReactNode } from 'react'

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-slate-400" aria-hidden>{icon}</span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
