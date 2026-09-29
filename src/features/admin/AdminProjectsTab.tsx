import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ApiError } from '../../lib/api'
import * as api from '../../lib/api'
import type { ApiAdminProject } from '../../lib/api'
import { useAdminProjects } from '../../lib/hooks'
import { formatDate } from '../../lib/documentMeta'
import { AdminSection, NoRows, Pill, SearchField, TableShell, Td, Th } from './adminUi'

const STATUSES = ['all', 'active', 'archived'] as const

const STATUS_LABEL: Record<string, string> = { active: 'Aktif', archived: 'Diarsipkan' }

export function AdminProjectsTab() {
  const projects = useAdminProjects()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all')
  const [open, setOpen] = useState<number | null>(null)
  const [confirming, setConfirming] = useState<ApiAdminProject | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const statuses = useMemo(
    () => [...new Set((projects.data ?? []).map((project) => project.status))].sort(),
    [projects.data],
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (projects.data ?? []).filter((project) => {
      if (status !== 'all' && project.status !== status) return false
      if (!needle) return true
      return (
        project.name.toLowerCase().includes(needle) ||
        project.slug.toLowerCase().includes(needle) ||
        project.user.name.toLowerCase().includes(needle) ||
        project.user.email.toLowerCase().includes(needle)
      )
    })
  }, [projects.data, query, status])

  const filtered = Boolean(query.trim()) || status !== 'all'

  async function remove(project: ApiAdminProject) {
    setDeleting(true)
    setError('')
    try {
      await api.adminDeleteProject(project.id)
      setConfirming(null)
      await projects.refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus proyek.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AdminSection
      title="Proyek"
      description={`${projects.data?.length ?? 0} proyek di seluruh workspace. Hapus proyek beserta dokumen dan riwayat generasinya.`}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-56">
            <SearchField value={query} onChange={setQuery} label="Cari proyek" placeholder="Cari proyek, slug, atau pemilik…" />
          </div>
          <label>
            <span className="sr-only">Filter status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
              <option value="all">Semua status</option>
              {statuses.map((item) => <option key={item} value={item}>{STATUS_LABEL[item] ?? item}</option>)}
            </select>
          </label>
        </div>
      }
    >
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <TableShell minWidth="min-w-[860px]">
        <thead className="border-b border-border bg-background">
          <tr>
            <Th className="w-8" />
            <Th>Proyek</Th>
            <Th>Pemilik</Th>
            <Th className="text-right">Dokumen</Th>
            <Th>Status</Th>
            <Th>Dibuat</Th>
            <Th className="text-right">Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((project) => {
            const isOpen = open === project.id
            return (
              <Fragment key={project.id}>
                <tr className="transition hover:bg-slate-50">
                  <Td>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : project.id)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? `Tutup detail ${project.name}` : `Buka detail ${project.name}`}
                      className="rounded-md p-1 text-muted transition hover:bg-slate-100 hover:text-foreground"
                    >
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </Td>
                  <Td>
                    <p className="font-medium text-foreground">{project.name}</p>
                    <p className="text-xs text-muted">{project.slug}</p>
                  </Td>
                  <Td className="text-muted">
                    {project.user.name}
                    <span className="block text-xs text-slate-400">{project.user.email}</span>
                  </Td>
                  <Td className="text-right font-semibold tabular-nums">{project.documents_count}</Td>
                  <Td><Pill tone={project.status === 'active' ? 'success' : 'neutral'}>{STATUS_LABEL[project.status] ?? project.status}</Pill></Td>
                  <Td className="whitespace-nowrap text-xs text-muted">{formatDate(project.created_at)}</Td>
                  <Td className="text-right">
                    <Button variant="danger" size="sm" onClick={() => setConfirming(project)} aria-label={`Hapus ${project.name}`}>
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  </Td>
                </tr>
                {isOpen && (
                  <tr className="bg-background">
                    <td />
                    <td colSpan={6} className="px-4 pb-4">
                      <dl className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">ID proyek</dt>
                          <dd className="text-sm text-foreground">#{project.id}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">Jumlah dokumen</dt>
                          <dd className="text-sm text-foreground">{project.documents_count} dokumen</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wide text-slate-400">Pemilik</dt>
                          <dd className="text-sm text-foreground">{project.user.name} (#{project.user.id})</dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Link
                          to={`/app/projects/${project.id}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition hover:text-primary-dark"
                        >
                          <ExternalLink size={14} aria-hidden /> Buka workspace proyek
                        </Link>
                        <span className="text-xs text-muted">
                          Dokumen, konteks, dan riwayat generasi lengkap hanya tersedia di halaman pemilik proyek.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {rows.length === 0 && (
            <NoRows colSpan={7} label={filtered ? 'Tidak ada proyek yang cocok dengan filter ini.' : 'Belum ada proyek.'} />
          )}
        </tbody>
      </TableShell>

      <Modal open={confirming !== null} onClose={() => setConfirming(null)} labelledBy="delete-project-title">
        <div className="p-6">
          <h3 id="delete-project-title" className="font-semibold text-foreground">Hapus proyek?</h3>
          <p className="mt-2 text-sm text-muted">
            <span className="font-medium text-foreground">{confirming?.name}</span> milik{' '}
            <span className="font-medium text-foreground">{confirming?.user.name}</span> akan dihapus permanen, termasuk{' '}
            {confirming?.documents_count} dokumen dan seluruh versinya. Tindakan ini tidak bisa dibatalkan.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(null)} data-autofocus>Batal</Button>
            <Button variant="danger" disabled={deleting} onClick={() => confirming && remove(confirming)}>
              {deleting ? 'Menghapus…' : 'Hapus permanen'}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminSection>
  )
}
