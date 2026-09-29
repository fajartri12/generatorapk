import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { useAllDocuments, useProjects } from '../../lib/hooks'
import type { ApiDocument } from '../../lib/api'
import { docMetaFor as metaFor, relativeDate, statusKey, StatusPill, type StatusKey } from '../../lib/documentMeta'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatCard } from '../../components/domain/StatCard'


function DocumentCard({ doc, project }: { doc: ApiDocument; project: { name: string; color: string; icon: string } }) {
  const meta = metaFor(doc)
  return (
    <Link
      to={`/app/documents/${doc.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_28px_-12px_rgba(15,23,42,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span aria-hidden className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${meta.accent}`} />

      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-lg text-xs font-bold ${meta.chip} ${meta.text}`} aria-hidden>{meta.initials}</span>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground transition group-hover:text-primary">{doc.title}</h2>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{meta.category}</p>
        </div>
        <StatusPill status={doc.status} />
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">{meta.description}</p>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
          <span className="grid size-4 shrink-0 place-items-center rounded text-[8px] font-bold text-white" style={{ background: project.color }} aria-hidden>{project.icon}</span>
          <span className="truncate">{project.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium tabular-nums text-slate-500">v{doc.current_version}</span>
          <span>{relativeDate(doc.updated_at)}</span>
          <ArrowUpRight size={13} aria-hidden className="text-slate-300 transition group-hover:text-primary" />
        </span>
      </div>
    </Link>
  )
}

function DocumentRow({ doc, project }: { doc: ApiDocument; project: { name: string; color: string; icon: string } }) {
  const meta = metaFor(doc)
  return (
    <Link
      to={`/app/documents/${doc.id}`}
      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 transition last:border-0 hover:bg-slate-50/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_auto_auto]"
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${meta.chip} ${meta.text}`} aria-hidden>{meta.initials}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground transition group-hover:text-primary">{doc.title}</p>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{meta.category}</p>
      </div>
      <span className="hidden min-w-0 items-center gap-1.5 text-xs text-muted sm:flex">
        <span className="grid size-4 shrink-0 place-items-center rounded text-[8px] font-bold text-white" style={{ background: project.color }} aria-hidden>{project.icon}</span>
        <span className="truncate">{project.name}</span>
      </span>
      <span className="hidden text-right text-xs text-muted sm:block">
        <span className="tabular-nums">v{doc.current_version}</span> · {relativeDate(doc.updated_at)}
      </span>
      <StatusPill status={doc.status} />
    </Link>
  )
}

const STATUS_FILTERS: { key: 'all' | StatusKey; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'ready', label: 'Siap' },
  { key: 'draft', label: 'Draf' },
  { key: 'generating', label: 'Diproses' },
  { key: 'failed', label: 'Gagal' },
  { key: 'archived', label: 'Diarsipkan' },
]

export function DocumentsPage() {
  const { data: documents, isLoading, isError, refetch } = useAllDocuments()
  const { data: projects } = useProjects()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | StatusKey>('all')
  const [projectId, setProjectId] = useState<'all' | number>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const projectById = useMemo(() => new Map((projects ?? []).map((project) => [project.id, project])), [projects])

  const docProject = (doc: ApiDocument) => {
    const project = projectById.get(doc.project_id)
    return { name: project?.name ?? 'Proyek tidak diketahui', color: project?.color ?? '#94a3b8', icon: project?.icon ?? '??' }
  }

  const all = documents ?? []

  const stats = useMemo(() => {
    const counts = { total: all.length, ready: 0, draft: 0, failed: 0 }
    const categories = new Set<string>()
    const projectIds = new Set<number>()
    for (const doc of all) {
      const key = statusKey(doc.status)
      if (key === 'ready') counts.ready += 1
      else if (key === 'failed') counts.failed += 1
      else if (key === 'draft') counts.draft += 1
      categories.add(metaFor(doc).category)
      projectIds.add(doc.project_id)
    }
    return { ...counts, categories: categories.size, projects: projectIds.size }
  }, [all])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return all
      .filter((doc) => {
        if (status !== 'all' && statusKey(doc.status) !== status) return false
        if (projectId !== 'all' && doc.project_id !== projectId) return false
        if (!needle) return true
        const projectName = projectById.get(doc.project_id)?.name ?? ''
        return `${doc.title} ${doc.type} ${metaFor(doc).category} ${projectName}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [all, query, status, projectId, projectById])

  const activeFilters = status !== 'all' || projectId !== 'all' || query.trim() !== ''

  function resetFilters() {
    setQuery('')
    setStatus('all')
    setProjectId('all')
  }

  if (isError) return <EmptyState title="Gagal memuat dokumen" body="Tidak dapat menghubungi API." actionLabel="Coba lagi" onAction={() => refetch()} />

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted">
            <span>Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">Dokumen</span>
          </div>
          <h1 className="text-3xl font-bold tracking-[-0.035em] text-foreground md:text-[34px]">Dokumen</h1>
          <p className="mt-1.5 text-sm text-muted">
            {isLoading ? 'Memuat dokumen…' : `${stats.total} dokumen tersebar di ${stats.projects} proyek.`}
          </p>
        </div>
        <Link
          to="/app/tools"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] gradient-brand px-4 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:opacity-90"
        >
          <Sparkles size={16} aria-hidden /> Generate dokumen
        </Link>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      {!isLoading && all.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total dokumen" value={stats.total} hint={`${stats.categories} jenis dokumen`} icon={<FileText size={18} />} />
          <StatCard label="Siap dipakai" value={stats.ready} hint={stats.total ? `${Math.round((stats.ready / stats.total) * 100)}% dari total` : '—'} icon={<CheckCircle2 size={18} />} />
          <StatCard label="Perlu dilanjutkan" value={stats.draft} hint="Masih berstatus draf" icon={<Clock3 size={18} />} />
          <StatCard label="Proyek tercakup" value={stats.projects} hint="Proyek dengan dokumen" icon={<FileText size={18} />} />
        </section>
      )}

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      {all.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari judul, jenis, atau proyek…"
                aria-label="Cari dokumen"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <SlidersHorizontal size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                  aria-label="Filter proyek"
                  className="h-10 min-w-[11rem] appearance-none rounded-lg border border-border bg-background pl-9 pr-8 text-sm text-foreground outline-none transition focus:border-primary"
                >
                  <option value="all">Semua proyek</option>
                  {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </div>

              <div className="flex rounded-lg border border-border bg-background p-0.5" role="group" aria-label="Mode tampilan">
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-pressed={view === 'grid'}
                  aria-label="Tampilan kartu"
                  className={`grid size-8 place-items-center rounded-md transition ${view === 'grid' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-foreground'}`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  aria-pressed={view === 'list'}
                  aria-label="Tampilan daftar"
                  className={`grid size-8 place-items-center rounded-md transition ${view === 'list' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-foreground'}`}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            {STATUS_FILTERS.map((filter) => {
              const count = filter.key === 'all' ? stats.total : all.filter((doc) => statusKey(doc.status) === filter.key).length
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatus(filter.key)}
                  aria-pressed={status === filter.key}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${status === filter.key ? 'bg-primary/10 text-primary-dark ring-1 ring-inset ring-primary/20' : 'text-muted hover:bg-slate-100 hover:text-foreground'}`}
                >
                  {filter.label}
                  <span className={`tabular-nums ${status === filter.key ? 'text-primary/70' : 'text-slate-400'}`}>{count}</span>
                </button>
              )
            })}
            {activeFilters && (
              <button type="button" onClick={resetFilters} className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-slate-100 hover:text-foreground">
                <X size={12} aria-hidden /> Reset
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[172px] animate-pulse rounded-xl border border-border bg-surface" />)}
        </div>
      ) : all.length === 0 ? (
        <EmptyState title="Belum ada dokumen" body="Dokumen muncul di sini setelah Anda menjalankan generator dari halaman proyek." />
      ) : filtered.length === 0 ? (
        <EmptyState title="Tidak ada hasil" body="Tidak ada dokumen yang cocok dengan pencarian atau filter Anda." actionLabel="Reset filter" onAction={resetFilters} />
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((doc) => <DocumentCard key={doc.id} doc={doc} project={docProject(doc)} />)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {filtered.map((doc) => <DocumentRow key={doc.id} doc={doc} project={docProject(doc)} />)}
        </div>
      )}

      {!isLoading && filtered.length > 0 && activeFilters && (
        <p className="text-center text-xs text-muted">Menampilkan {filtered.length} dari {stats.total} dokumen.</p>
      )}
    </div>
  )
}
