import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { useProjects } from '../../lib/hooks'
import { Badge } from '../../components/ui/Badge'
import { NewProjectWizard } from './NewProjectWizard'

const PIPELINE_TOTAL = 9

export function ProjectsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const { data: projects, isLoading, isError, refetch } = useProjects()
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const next = new URLSearchParams(params)
    if (q) next.set('q', q)
    else next.delete('q')
    setParams(next, { replace: true })
  }, [q, params, setParams])

  const filtered = useMemo(
    () => (projects ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [projects, q],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="mt-1 text-muted">{projects?.length ?? 0} proyek di workspace ini.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={16} aria-hidden /> Proyek Baru</Button>
      </div>

      <NewProjectWizard
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(project) => navigate(`/app/projects/${project.id}`)}
      />

      <label className="relative block max-w-md">
        <span className="sr-only">Cari proyek</span>
        <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari proyek…" className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
      </label>

      {isError ? (
        <EmptyState title="Gagal memuat proyek" body="Tidak dapat menghubungi API." actionLabel="Coba lagi" onAction={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-[170px] animate-pulse rounded-xl border border-border bg-surface" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState title={q ? 'Tidak ada hasil' : 'Belum ada proyek'} body={q ? `Tidak ada proyek yang cocok dengan "${q}".` : 'Satu proyek menampung konteks dan semua dokumennya. Mulai dari sini.'} actionLabel="Buat proyek" onAction={() => setCreating(true)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => {
            const docs = project.documents_count ?? 0
            return (
              <button key={project.id} onClick={() => navigate(`/app/projects/${project.id}`)} className="flex flex-col rounded-xl border border-border bg-surface p-5 text-left transition hover:border-primary">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[13px] font-semibold text-white" style={{ background: project.color }} aria-hidden>{project.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-foreground">{project.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{project.description || 'Belum ada deskripsi.'}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">{(project.tags ?? []).map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>
                <div className="mt-4"><ProgressBar value={Math.round((docs / PIPELINE_TOTAL) * 100)} label={`Progres ${project.name}`} /></div>
                <p className="mt-2 text-xs text-muted">{docs} dokumen · Diperbarui {new Date(project.updated_at).toLocaleDateString('id-ID')}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
