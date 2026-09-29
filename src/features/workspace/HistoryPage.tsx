import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Ban, CheckCircle2, Coins, Timer, XCircle } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useGenerations, useProjects } from '../../lib/hooks'
import { docMeta, formatDateTime, generatorName } from '../../lib/documentMeta'
import type { ApiGeneration } from '../../lib/api'

/**
 * Status presentation for a generation. Keys mirror `App\Models\Generation`
 * constants; anything unknown falls back to a neutral "pending" look.
 */
const STATUSES = {
  completed: { label: 'Selesai', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100', dot: 'bg-emerald-500', Icon: CheckCircle2 },
  running: { label: 'Diproses', chip: 'bg-blue-50 text-blue-700 ring-blue-100', dot: 'bg-blue-500', Icon: Timer },
  pending: { label: 'Menunggu', chip: 'bg-amber-50 text-amber-700 ring-amber-100', dot: 'bg-amber-500', Icon: Timer },
  failed: { label: 'Gagal', chip: 'bg-red-50 text-red-700 ring-red-100', dot: 'bg-red-500', Icon: XCircle },
  cancelled: { label: 'Dibatalkan', chip: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', Icon: Ban },
} as const

type StatusKey = keyof typeof STATUSES

const statusOf = (status: string) => STATUSES[status as StatusKey] ?? STATUSES.pending

/** A generation "spent" credits unless it failed or was cancelled (those are refunded). */
const isBillable = (gen: ApiGeneration) => gen.status === 'completed'

const FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'completed', label: 'Selesai' },
  { id: 'issue', label: 'Gagal & batal' },
] as const

type FilterId = (typeof FILTERS)[number]['id']

function duration(ms: number | null) {
  if (!ms || ms <= 0) return null
  if (ms < 1000) return `${ms} md`
  const seconds = ms / 1000
  return seconds < 60 ? `${seconds.toFixed(1)} dtk` : `${Math.floor(seconds / 60)} mnt ${Math.round(seconds % 60)} dtk`
}

export function HistoryPage() {
  const { data: generations, isLoading, isError, refetch } = useGenerations()
  const { data: projects } = useProjects()
  const [filter, setFilter] = useState<FilterId>('all')

  const projectName = useMemo(() => {
    const map = new Map<number, string>()
    for (const project of projects ?? []) map.set(project.id, project.name)
    return map
  }, [projects])

  if (isError) return <EmptyState title="Gagal memuat riwayat" body="Tidak dapat menghubungi API." actionLabel="Coba lagi" onAction={() => refetch()} />
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" />
        <div className="h-72 animate-pulse rounded-xl border border-border bg-surface" />
      </div>
    )
  }

  const runs = generations ?? []

  const done = runs.filter((gen) => gen.status === 'completed').length
  const failed = runs.filter((gen) => gen.status === 'failed').length
  const inFlight = runs.filter((gen) => gen.status === 'running' || gen.status === 'pending').length
  const cancelled = runs.filter((gen) => gen.status === 'cancelled').length

  // Only completed runs actually cost credits; the rest were refunded by the server.
  const spent = runs.filter(isBillable).reduce((sum, gen) => sum + gen.credits_used, 0)
  const finished = runs.filter((gen) => gen.status === 'completed' && gen.duration_ms)
  const avgMs = finished.length > 0 ? finished.reduce((sum, gen) => sum + (gen.duration_ms ?? 0), 0) / finished.length : 0
  const successRate = runs.length > 0 ? Math.round((done / runs.length) * 100) : 0

  const countFor: Record<FilterId, number> = { all: runs.length, completed: done, issue: failed + cancelled }
  const visible = runs.filter((gen) => {
    if (filter === 'all') return true
    if (filter === 'completed') return gen.status === 'completed'
    return gen.status === 'failed' || gen.status === 'cancelled'
  })

  return (
    <div className="space-y-5">
      {/* ── Ringkasan ───────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="absolute inset-x-0 top-0 h-1 gradient-brand" aria-hidden />
        <div className="flex flex-wrap items-center gap-5 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            {/* Success-rate ring, pure conic-gradient — no chart dependency. */}
            <div
              role="img"
              aria-label={`Tingkat keberhasilan ${successRate} persen`}
              className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full"
              style={{ background: `conic-gradient(var(--color-success) ${successRate}%, var(--color-border) ${successRate}% 100%)` }}
            >
              <span className="grid h-[62px] w-[62px] place-items-center rounded-full bg-surface">
                <span className="text-lg leading-none font-bold tabular-nums text-foreground">{successRate}%</span>
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tingkat keberhasilan</p>
              <p className="mt-1.5 text-sm text-foreground">
                <span className="font-semibold">{done}</span> dari <span className="font-semibold">{runs.length}</span> generasi berhasil.
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {inFlight > 0 && <span>{inFlight} sedang berjalan</span>}
                {failed > 0 && <span>{failed} gagal</span>}
                {cancelled > 0 && <span>{cancelled} dibatalkan</span>}
              </p>
            </div>
          </div>

          <dl className="ml-auto grid grid-cols-2 gap-x-6 gap-y-3 sm:gap-x-8">
            <div>
              <dt className="text-xs text-muted">Kredit terpakai</dt>
              <dd className="mt-1 flex items-baseline gap-1 text-lg font-semibold tabular-nums text-foreground">
                {spent}
                <Coins size={13} aria-hidden className="text-warning" />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Rata-rata durasi</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {avgMs > 0 ? duration(avgMs) : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {runs.length === 0 ? (
        <EmptyState title="Belum ada riwayat" body="Setiap generasi yang Anda jalankan muncul di sini beserta status, durasi, dan biaya kreditnya." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground">Riwayat generasi</h2>
              <p className="mt-0.5 text-xs text-muted">Terbaru di atas. Klik untuk membuka dokumen hasilnya.</p>
            </div>
            <div role="group" aria-label="Filter riwayat" className="flex max-w-full shrink-0 flex-wrap gap-0.5 rounded-lg border border-border bg-background p-0.5">
              {FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    filter === id ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
                  }`}
                >
                  {label}
                  <span className="ml-1 tabular-nums text-muted">{countFor[id]}</span>
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Tidak ada generasi untuk filter ini.</p>
          ) : (
            <ul>
              {visible.map((gen) => {
                const meta = docMeta(gen.document_type)
                const status = statusOf(gen.status)
                const tool = generatorName(gen.document_type)
                const took = duration(gen.duration_ms)
                const project = projectName.get(gen.project_id)

                return (
                  <li key={gen.id}>
                    <Link
                      to={`/app/documents/${gen.document_id}`}
                      className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50/70"
                    >
                      <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold ${meta.chip} ${meta.text}`}>
                        {meta.initials}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{tool ?? meta.category}</p>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${status.chip}`}>
                            {gen.status === 'running' && <span className={`size-1.5 animate-pulse rounded-full ${status.dot}`} aria-hidden />}
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {project ? `${project} · ` : ''}
                          {formatDateTime(gen.created_at)}
                          {took ? ` · ${took}` : ''}
                        </p>
                        {gen.status === 'failed' && gen.error && (
                          <p className="mt-1 flex items-start gap-1.5 text-xs text-red-600">
                            <AlertTriangle size={12} aria-hidden className="mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{gen.error}</span>
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        {isBillable(gen) ? (
                          <>
                            <p className="text-sm font-semibold tabular-nums text-foreground">-{gen.credits_used}</p>
                            <p className="mt-0.5 text-xs text-muted">kredit</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold tabular-nums text-emerald-600">+{gen.credits_used}</p>
                            <p className="mt-0.5 text-xs text-muted">dikembalikan</p>
                          </>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {runs.length >= 50 && (
            <p className="border-t border-border px-5 py-3 text-xs text-muted">Menampilkan 50 generasi terbaru.</p>
          )}
        </Card>
      )}
    </div>
  )
}
