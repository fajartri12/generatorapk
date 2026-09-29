import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Filter, X } from 'lucide-react'
import { useAdminAuditLogs } from '../../lib/hooks'
import { formatDateTime } from '../../lib/documentMeta'
import type { ApiAuditLog } from '../../lib/api'
import { AdminSection, NoRows, Pill, TableShell, Td, Th } from './adminUi'

/** The actions the backend records, with a label and tone each. */
const ACTIONS = [
  { id: 'payment.approve', label: 'Pembayaran disetujui', tone: 'success' },
  { id: 'payment.settle', label: 'Pakasir melunasi', tone: 'success' },
  { id: 'payment.amount_mismatch', label: 'Nominal tidak cocok', tone: 'danger' },
  { id: 'payment.reject', label: 'Pembayaran ditolak', tone: 'danger' },
  { id: 'user.role', label: 'Role diubah', tone: 'primary' },
  { id: 'user.plan', label: 'Paket diubah', tone: 'primary' },
  { id: 'user.grant', label: 'Kredit ditambah', tone: 'warning' },
  { id: 'project.delete', label: 'Proyek dihapus', tone: 'danger' },
  { id: 'costs.update', label: 'Biaya diubah', tone: 'warning' },
  { id: 'bank.update', label: 'Rekening diubah', tone: 'warning' },
] as const

const meta = (action: string) => ACTIONS.find((a) => a.id === action) ?? { label: action, tone: 'neutral' as const }

const FILTERS = [{ id: undefined, label: 'Semua' }, ...ACTIONS.map((a) => ({ id: a.id as string | undefined, label: a.label }))]

/** Tipe objek yang dapat difilter, memakai nama kelas pendek dari API. */
const SUBJECTS = [
  { id: 'User', label: 'Pengguna' },
  { id: 'Project', label: 'Proyek' },
  { id: 'Payment', label: 'Pembayaran' },
] as const

/** Renders a `{field: {from, to}}` changes payload as readable lines. */
function ChangeDetail({ log }: { log: ApiAuditLog }) {
  const changes = log.changes

  if (!changes || Object.keys(changes).length === 0) {
    return <p className="text-xs text-muted">Tidak ada detail perubahan.</p>
  }

  return (
    <ul className="space-y-1">
      {Object.entries(changes).map(([field, value]) => {
        const pair = value as { from?: unknown; to?: unknown } | null

        // A flat value (e.g. `{ name: 'Proyek' }`) has no from/to to compare.
        if (!pair || typeof pair !== 'object' || !('to' in pair)) {
          return (
            <li key={field} className="text-xs text-muted">
              <span className="font-medium text-foreground">{field}</span>: {JSON.stringify(value)}
            </li>
          )
        }

        return (
          <li key={field} className="text-xs text-muted">
            <span className="font-medium text-foreground">{field}</span>:{' '}
            <span className="text-slate-500">{JSON.stringify(pair.from)}</span>
            <span aria-hidden className="mx-1.5 text-slate-400">→</span>
            <span className="font-medium text-foreground">{JSON.stringify(pair.to)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function AdminAuditTab() {
  const [filter, setFilter] = useState<string | undefined>(undefined)
  const [subjectType, setSubjectType] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [open, setOpen] = useState<number | null>(null)

  // Filter objek dipakai untuk menjawab "apa saja yang pernah terjadi pada
  // pengguna/proyek/pembayaran ini".
  const subjectFilterActive = subjectType !== '' || subjectId !== ''
  const logs = useAdminAuditLogs({
    action: filter,
    subjectType: subjectType || undefined,
    subjectId: Number(subjectId) > 0 ? Number(subjectId) : undefined,
  })

  const rows = logs.data?.data ?? []
  const total = logs.data?.meta.total ?? 0

  function clearSubject() {
    setSubjectType('')
    setSubjectId('')
  }

  function showSubject(log: ApiAuditLog) {
    if (!log.subject_type) return
    setSubjectType(log.subject_type)
    setSubjectId(String(log.subject_id ?? ''))
    setOpen(null)
  }

  return (
    <AdminSection
      title="Jejak audit"
      description={
        total > 0
          ? `${total} tindakan tercatat. Baris tidak dapat diubah atau dihapus.`
          : 'Setiap perubahan role, paket, kredit, biaya, dan keputusan pembayaran tercatat di sini.'
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filter jenis tindakan" className="flex max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-lg border border-border bg-background p-0.5">
            {FILTERS.map(({ id, label }) => {
              const active = filter === id
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(id)}
                  className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    active ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Filter size={14} aria-hidden className="text-muted" />
            <select
              aria-label="Filter jenis objek"
              value={subjectType}
              onChange={(event) => setSubjectType(event.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="">Semua objek</option>
              {SUBJECTS.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.label}</option>
              ))}
            </select>
            <input
              aria-label="ID objek"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              placeholder="ID"
              className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
            {subjectFilterActive && (
              <button
                type="button"
                onClick={clearSubject}
                className="rounded-md p-1 text-muted transition hover:text-foreground"
                aria-label="Hapus filter objek"
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </div>
        </div>
      }
    >
      <TableShell minWidth="min-w-[900px]">
        <thead className="border-b border-border bg-background">
          <tr>
            <Th className="w-8" />
            <Th>Waktu</Th>
            <Th>Pelaku</Th>
            <Th>Tindakan</Th>
            <Th>Keterangan</Th>
            <Th>Objek</Th>
            <Th>IP</Th>
          </tr>
        </thead>
        <tbody>
          {logs.isLoading ? (
            <NoRows colSpan={7} label="Memuat jejak audit…" />
          ) : rows.length === 0 ? (
            <NoRows colSpan={7} label="Tidak ada tindakan pada filter ini." />
          ) : (
            rows.map((log) => {
              const info = meta(log.action)
              const expanded = open === log.id

              return (
                <Fragment key={log.id}>
                  <tr className="cursor-pointer transition hover:bg-slate-50" onClick={() => setOpen(expanded ? null : log.id)}>
                    <Td>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Tutup detail' : 'Buka detail'}
                        onClick={(event) => {
                          event.stopPropagation()
                          setOpen(expanded ? null : log.id)
                        }}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-foreground"
                      >
                        {expanded ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
                      </button>
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap text-xs text-muted">{formatDateTime(log.created_at)}</span>
                    </Td>
                    <Td>
                      {log.actor ? (
                        <>
                          <p className="text-sm text-foreground">{log.actor.name}</p>
                          <p className="text-xs text-muted">{log.actor.email}</p>
                        </>
                      ) : (
                        <span className="text-xs text-muted">Sistem</span>
                      )}
                    </Td>
                    <Td>
                      <Pill tone={info.tone}>{info.label}</Pill>
                    </Td>
                    <Td>
                      <span className="text-sm text-foreground">{log.description}</span>
                    </Td>
                    <Td>
                      {log.subject_type ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            showSubject(log)
                          }}
                          title="Lihat riwayat objek ini"
                          className="font-mono text-xs text-muted underline decoration-dotted underline-offset-2 transition hover:text-primary"
                        >
                          {log.subject_type}#{log.subject_id ?? '·'}
                        </button>
                      ) : (
                        <span className="text-xs text-muted">·</span>
                      )}
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-muted">{log.ip ?? '—'}</span>
                    </Td>
                  </tr>
                  {expanded && (
                    <tr className="bg-background">
                      <td colSpan={7} className="px-4 py-3">
                        <ChangeDetail log={log} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })
          )}
        </tbody>
      </TableShell>
    </AdminSection>
  )
}
