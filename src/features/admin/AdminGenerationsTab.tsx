import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import type { ApiAdminGeneration } from '../../lib/api'
import { useAdminGenerations } from '../../lib/hooks'
import { formatDateTime, generatorName } from '../../lib/documentMeta'
import { ExportButton } from './ExportButton'
import { AdminSection, GENERATION_STATUSES, NoRows, SearchField, TableShell, Td, Th, statusLabel, statusTone } from './adminUi'

const STATUSES = GENERATION_STATUSES

/** Only a completed run actually consumed the user's credits. */
const isBillable = (generation: ApiAdminGeneration) => generation.status === 'completed'

function duration(ms: number | null) {
  if (!ms) return null
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} dtk`
}

export function AdminGenerationsTab() {
  const generations = useAdminGenerations()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | (typeof STATUSES)[number]>('all')
  const [onlyFailures, setOnlyFailures] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (generations.data ?? []).filter((generation) => {
      if (onlyFailures && generation.status !== 'failed') return false
      if (status !== 'all' && generation.status !== status) return false
      if (!needle) return true
      return (
        (generation.user?.name ?? '').toLowerCase().includes(needle) ||
        (generation.user?.email ?? '').toLowerCase().includes(needle) ||
        generation.document_type.toLowerCase().includes(needle) ||
        (generatorName(generation.document_type) ?? '').toLowerCase().includes(needle) ||
        (generation.error ?? '').toLowerCase().includes(needle)
      )
    })
  }, [generations.data, query, status, onlyFailures])

  const all = generations.data ?? []
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of all) map[item.status] = (map[item.status] ?? 0) + 1
    return map
  }, [all])

  const creditsSpent = all.filter(isBillable).reduce((sum, item) => sum + (item.credits_used ?? 0), 0)
  const filtered = Boolean(query.trim()) || status !== 'all' || onlyFailures

  // Rata-rata hanya dari generasi yang benar-benar selesai: durasi yang gagal
  // di tengah jalan menyesatkan kalau ikut dirata-ratakan.
  const finished = all.filter((item) => item.duration_ms && item.status === 'completed')
  const avgMs = finished.length > 0 ? finished.reduce((sum, item) => sum + (item.duration_ms ?? 0), 0) / finished.length : null

  const failed = counts.failed ?? 0

  return (
    <AdminSection
      title="Riwayat generasi"
      description={`${all.length} generasi tercatat, ${creditsSpent.toLocaleString('id-ID')} kredit benar-benar terpakai dari ${all.filter(isBillable).length} generasi yang selesai${avgMs ? `, rata-rata ${duration(Math.round(avgMs))}` : ''}.`}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-56">
            <SearchField value={query} onChange={setQuery} label="Cari generasi" placeholder="Cari pengguna, jenis dokumen, atau pesan error…" />
          </div>
          <label>
            <span className="sr-only">Filter status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
              <option value="all">Semua status</option>
              {STATUSES.map((item) => <option key={item} value={item}>{statusLabel[item]} ({counts[item] ?? 0})</option>)}
            </select>
          </label>
          <button
            type="button"
            aria-pressed={onlyFailures}
            onClick={() => setOnlyFailures(!onlyFailures)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              onlyFailures ? 'border-red-200 bg-red-50 text-red-700' : 'border-border bg-background text-muted hover:text-foreground'
            }`}
          >
            Hanya gagal{failed > 0 ? ` (${failed})` : ''}
          </button>
          <ExportButton kind="generations" />
        </div>
      }
    >
      <TableShell minWidth="min-w-[880px]">
        <thead className="border-b border-border bg-background">
          <tr>
            <Th className="w-8" />
            <Th>Dokumen</Th>
            <Th>Pengguna</Th>
            <Th>Provider / model</Th>
            <Th>Status</Th>
            <Th className="text-right">Kredit</Th>
            <Th className="text-right">Durasi</Th>
            <Th>Waktu</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((generation) => {
            const isOpen = open === generation.id
            const failedRun = generation.status === 'failed'

            return (
              <Fragment key={generation.id}>
                <tr className={`transition hover:bg-slate-50 ${failedRun ? 'bg-red-50/40' : ''}`}>
                  <Td>
                    {generation.error ? (
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : generation.id)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? 'Tutup pesan error' : 'Buka pesan error'}
                        className="rounded-md p-1 text-muted transition hover:bg-slate-100 hover:text-foreground"
                      >
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                    ) : null}
                  </Td>
                  <Td>
                    <p className="font-medium text-foreground">{generatorName(generation.document_type) ?? generation.document_type}</p>
                    <p className="text-xs text-slate-400">{generation.document_type}</p>
                  </Td>
                  <Td className="text-muted">
                    {generation.user?.name ?? 'pengguna dihapus'}
                    <span className="block text-xs text-slate-400">{generation.user?.email ?? ''}</span>
                  </Td>
                  <Td className="text-xs text-muted">{generation.provider} / {generation.model}</Td>
                  <Td>
                    <Badge tone={statusTone(generation.status)}>
                      {statusLabel[generation.status] ?? generation.status}
                    </Badge>
                  </Td>
                  <Td className={`text-right tabular-nums ${isBillable(generation) ? 'font-semibold text-foreground' : 'text-slate-400'}`}>
                    {isBillable(generation) ? generation.credits_used : '—'}
                  </Td>
                  <Td className="text-right tabular-nums text-muted">{duration(generation.duration_ms) ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-xs text-muted">{formatDateTime(generation.created_at)}</Td>
                </tr>
                {isOpen && generation.error && (
                  <tr className="bg-background">
                    <td />
                    <td colSpan={7} className="px-4 pb-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Pesan error</p>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-relaxed text-red-800">
                        {generation.error}
                      </pre>
                      <dl className="mt-3 grid gap-3 sm:grid-cols-4">
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">Tahap terakhir</dt>
                          <dd className="text-sm text-foreground">{generation.stage ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">Provider / model</dt>
                          <dd className="text-sm text-foreground">{generation.provider} / {generation.model}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">Proyek</dt>
                          <dd className="text-sm text-foreground">
                            {generation.project_id ? (
                              <a href={`/app/projects/${generation.project_id}`} className="text-primary hover:text-primary-dark">
                                Buka proyek #{generation.project_id}
                              </a>
                            ) : (
                              '—'
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">Dokumen</dt>
                          <dd className="text-sm text-foreground">
                            {generation.document_id ? (
                              <a href={`/app/documents/${generation.document_id}`} className="text-primary hover:text-primary-dark">
                                Buka dokumen #{generation.document_id}
                              </a>
                            ) : (
                              '—'
                            )}
                          </dd>
                        </div>
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {rows.length === 0 && (
            <NoRows colSpan={8} label={filtered ? 'Tidak ada generasi yang cocok dengan filter ini.' : 'Belum ada generasi.'} />
          )}
        </tbody>
      </TableShell>

      <p className="text-xs text-slate-400">
        Kredit hanya ditampilkan untuk generasi berstatus selesai. Status lain tidak memotong saldo pengguna. Baris merah
        menandai generasi gagal; klik ikon panah untuk membaca pesan errornya.
      </p>
    </AdminSection>
  )
}
