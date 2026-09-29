import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  Coins,
  FileText,
  Hash,
  Layers,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { TOOL_CATALOG } from '../../lib/tools'
import { useCreditCosts, useGenerate, useProject, useUpdateProjectContext } from '../../lib/hooks'
import { ApiError, deleteProject, type ApiContext, type ApiDocument } from '../../lib/api'
import { GenerationProgress } from './GenerationProgress'

const PIPELINE = ['brief', 'prd', 'srs', 'sdd', 'database', 'api', 'ui_ux', 'wbs', 'agents_md'] as const

type PipelineType = (typeof PIPELINE)[number]

const PIPELINE_TOOL = new Map(TOOL_CATALOG.filter((tool) => tool.documentType).map((tool) => [tool.documentType as string, tool]))

function pipelineLabel(type: PipelineType) {
  return PIPELINE_TOOL.get(type)?.name ?? type.toUpperCase()
}

/** Short category shown next to each pipeline stage. */
const STAGE_GROUP: Record<PipelineType, string> = {
  brief: 'Business',
  prd: 'Product',
  srs: 'Engineering',
  sdd: 'Engineering',
  database: 'Database',
  api: 'Development',
  ui_ux: 'Design',
  wbs: 'Planning',
  agents_md: 'Development',
}

const CONTEXT_FIELDS: { key: keyof ApiContext; label: string; placeholder: string }[] = [
  { key: 'summary', label: 'Ringkasan', placeholder: 'Satu paragraf tentang produk ini' },
  { key: 'audience', label: 'Target Pengguna', placeholder: 'Siapa yang memakainya' },
  { key: 'problem', label: 'Masalah', placeholder: 'Masalah apa yang dipecahkan' },
  { key: 'features', label: 'Fitur Utama', placeholder: 'Fitur kunci, pisahkan dengan baris baru' },
  { key: 'business_goal', label: 'Tujuan Bisnis', placeholder: 'Kenapa ini dibangun' },
]

/** Conic-gradient progress ring. Pure CSS, no chart dependency. */
function ProgressRing({ value, size = 132, stroke = 10 }: { value: number; size?: number; stroke?: number }) {
  const safe = Math.min(100, Math.max(0, value))
  const complete = safe >= 100
  const ring = complete ? '#10b981' : '#2563eb'
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${ring} ${safe * 3.6}deg, #e2e8f0 0deg)`,
      }}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progres dokumen proyek"
    >
      <div className="grid place-items-center rounded-full bg-surface" style={{ width: size - stroke * 2, height: size - stroke * 2 }}>
        <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{safe}%</span>
        <span className="text-[11px] text-muted">selesai</span>
      </div>
    </div>
  )
}

export function ProjectPage() {
  const params = useParams()
  const projectId = Number(params.id)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<'overview' | 'context' | 'documents'>('overview')
  const [deleting, setDeleting] = useState(false)

  const { data: project, isLoading, isError } = useProject(projectId)
  const { data: costs } = useCreditCosts()
  const generate = useGenerate(projectId)
  const saveContext = useUpdateProjectContext(projectId)

  const documentsByType = useMemo(() => {
    const map = new Map<string, ApiDocument>()
    project?.documents?.forEach((doc) => map.set(doc.type, doc))
    return map
  }, [project])

  const requestedTool = searchParams.get('tool')

  useEffect(() => {
    if (!requestedTool || !project || generate.isPending) return
    // Any runnable catalogue entry can be launched straight from a template card.
    if (PIPELINE_TOOL.has(requestedTool)) generate.start(requestedTool)
    const next = new URLSearchParams(searchParams)
    next.delete('tool')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTool, project])

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />
  if (isError || !project) {
    return <EmptyState title="Proyek tidak ditemukan" body="Proyek mungkin sudah dihapus atau bukan milik akun ini." />
  }

  async function handleDelete() {
    if (!project || !window.confirm(`Hapus proyek "${project.name}"? Semua dokumen di dalamnya ikut terhapus.`)) return
    setDeleting(true)
    try {
      await deleteProject(project.id)
      navigate('/app/projects')
    } finally {
      setDeleting(false)
    }
  }

  const done = PIPELINE.filter((type) => documentsByType.has(type)).length
  const percent = Math.round((done / PIPELINE.length) * 100)
  const remainingCredits = PIPELINE.filter((type) => !documentsByType.has(type)).reduce((sum, type) => sum + (costs?.[type] ?? 0), 0)
  const nextStage = PIPELINE.find((type) => !documentsByType.has(type))
  const activeStage = PIPELINE.findIndex((type) => !documentsByType.has(type))

  // Which document the in-flight (or just-finished) run is producing.
  const runningType = (generate.generation?.document_type as PipelineType | undefined) ?? nextStage
  const runningTitle = runningType ? PIPELINE_TOOL.get(runningType)?.name ?? pipelineLabel(runningType) : undefined
  // Keep the dialog mounted while a run is in flight, and after it succeeds so
  // the user gets a real success state the project query cannot report yet.
  const showProgress = generate.isPending || generate.generation?.status === 'completed'

  function closeProgress() {
    generate.reset()
    // Land the user on the document the run just produced.
    if (generate.generation?.document_id) navigate(`/app/documents/${generate.generation.document_id}`)
  }

  return (
    <div className="space-y-6">
      {/* ── Header hero ────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: project.color }} />
        <div className="flex flex-wrap items-start gap-5 p-6">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-base font-semibold text-white shadow-sm"
            style={{ background: project.color }}
            aria-hidden
          >
            {project.icon}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">{project.name}</h1>
              <Badge tone={done === PIPELINE.length ? 'success' : 'accent'}>
                <Sparkles size={11} aria-hidden /> {done}/{PIPELINE.length} dokumen
              </Badge>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{project.description || 'Belum ada deskripsi.'}</p>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><Hash size={13} aria-hidden />{project.slug}</span>
              <span className="inline-flex items-center gap-1.5"><Calendar size={13} aria-hidden />Dibuat {new Date(project.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              {project.tags && project.tags.length > 0 && (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <Layers size={13} aria-hidden />
                  {project.tags.map((tag) => <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{tag}</span>)}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {nextStage && (
              <Button size="sm" disabled={generate.isPending} onClick={() => generate.start(nextStage)}>
                <Sparkles size={14} aria-hidden /> Lanjut: {pipelineLabel(nextStage)}
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={14} aria-hidden /> {deleting ? 'Menghapus…' : 'Hapus'}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <nav className="flex gap-1 border-b border-border" role="tablist">
        {([['overview', 'Ringkasan'], ['context', 'Konteks'], ['documents', `Dokumen${project.documents?.length ? ` (${project.documents.length})` : ''}`]] as const).map(([item, label]) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${tab === item ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Pipeline */}
          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold text-foreground">Pipa Dokumen</h2>
                <p className="mt-0.5 text-sm text-muted">Setiap tahap memakai konteks proyek dan dokumen sebelumnya.</p>
              </div>
              <span className="text-xs font-medium text-muted tabular-nums">{done}/{PIPELINE.length} selesai</span>
            </div>

            <ol className="relative px-3 py-3">
              {/* Vertical connector guiding the eye through the stages. */}
              <span aria-hidden className="absolute bottom-8 left-[30px] top-8 w-px bg-gradient-to-b from-emerald-200 via-slate-200 to-slate-100" />
              {PIPELINE.map((type, index) => {
                const doc = documentsByType.get(type)
                const credits = costs?.[type]
                const isNext = index === activeStage
                return (
                  <li
                    key={type}
                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition ${isNext ? 'bg-primary/[0.04] ring-1 ring-inset ring-primary/15' : 'hover:bg-slate-50'}`}
                  >
                    <span
                      className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ring-4 ring-surface ${
                        doc ? 'bg-emerald-500 text-white' : isNext ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
                      }`}
                      aria-hidden
                    >
                      {doc ? <Check size={13} /> : index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{pipelineLabel(type)}</span>
                        {isNext && !generate.isPending && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary-dark">Berikutnya</span>}
                      </div>
                      <span className="text-[11px] text-muted">{STAGE_GROUP[type]}{doc ? ` · diperbarui ${new Date(doc.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}` : ''}</span>
                    </div>

                    {doc
                      ? <Badge tone="success">v{doc.current_version}</Badge>
                      : <span className="shrink-0 text-xs text-muted tabular-nums">{credits != null ? `${credits} kredit` : '—'}</span>}

                    <Button
                      size="sm"
                      variant={doc ? 'ghost' : isNext ? 'primary' : 'secondary'}
                      disabled={generate.isPending}
                      onClick={() => generate.start(type)}
                    >
                      {doc ? 'Generate ulang' : 'Generate'}
                    </Button>
                  </li>
                )
              })}
            </ol>
          </Card>

          {/* Summary rail */}
          <div className="space-y-4">
            <Card className="flex flex-col items-center text-center">
              <div className="flex w-full items-center gap-2 text-sm font-medium text-foreground">
                <FileText size={15} aria-hidden /> Progres
              </div>
              <div className="mt-4"><ProgressRing value={percent} /></div>
              <p className="mt-4 text-sm text-muted">
                <span className="font-semibold text-foreground">{done}</span> dari {PIPELINE.length} dokumen selesai
              </p>
              <div className="mt-4 w-full">
                <ProgressBar value={percent} size="lg" tone="auto" showValue={false} label="Progres dokumen" />
              </div>
              {nextStage ? (
                <p className="mt-3 text-xs text-muted">Langkah berikutnya: <span className="font-medium text-foreground">{pipelineLabel(nextStage)}</span></p>
              ) : (
                <p className="mt-3 text-xs font-medium text-emerald-600">Semua dokumen sudah lengkap 🎉</p>
              )}
            </Card>

            {showProgress && generate.stage && (
              <GenerationProgress
                stage={generate.stage}
                elapsedMs={generate.elapsedMs}
                onCancel={generate.cancel}
                cancelling={generate.isCancelling}
                status={generate.generation?.status ?? 'running'}
                documentTitle={runningTitle}
                error={(generate.error as ApiError)?.message ?? null}
                onClose={closeProgress}
              />
            )}

            <Card>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Coins size={15} aria-hidden className="text-warning" /> Sisa biaya generate</div>
              <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-foreground">{remainingCredits}</p>
              <p className="mt-1 text-xs text-muted">kredit untuk menyelesaikan {PIPELINE.length - done} dokumen tersisa.</p>
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted">Kredit dipotong hanya jika generasi berhasil. Gagal = otomatis dikembalikan.</p>
            </Card>

            {generate.error && !generate.isPending && (
              <Card className="border-red-200 bg-red-50">
                <div className="flex items-start gap-2 text-sm text-red-700"><AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0" />
                  <span>{(generate.error as ApiError)?.message ?? 'Generasi gagal.'}</span>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'context' && <ContextTab projectId={projectId} context={project.context} onSave={saveContext} />}

      {tab === 'documents' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(project.documents ?? []).map((doc) => (
            <Card key={doc.id} className="transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground"><Link to={`/app/documents/${doc.id}`} className="hover:text-primary">{doc.title}</Link></h3>
                <Badge tone={doc.status === 'ready' ? 'success' : 'neutral'}>{doc.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">{doc.type.toUpperCase()} · v{doc.current_version}</p>
              <Link to={`/app/documents/${doc.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark">
                Buka dokumen <ArrowRight size={12} aria-hidden />
              </Link>
            </Card>
          ))}
          {(project.documents ?? []).length === 0 && <EmptyState title="Belum ada dokumen" body="Jalankan salah satu tahap di tab Ringkasan untuk membuat dokumen pertama." />}
        </div>
      )}
    </div>
  )
}

function ContextTab({ projectId, context, onSave }: { projectId: number; context: ApiContext | null | undefined; onSave: { mutate: (data: Partial<ApiContext>) => void; isPending: boolean; isSuccess: boolean } }) {
  const [form, setForm] = useState<Partial<ApiContext>>({
    summary: context?.summary ?? '',
    audience: context?.audience ?? '',
    problem: context?.problem ?? '',
    features: context?.features ?? '',
    business_goal: context?.business_goal ?? '',
  })

  return (
    <Card>
      <h2 className="font-semibold text-foreground">Konteks Proyek</h2>
      <p className="mt-1 text-sm text-muted">Konteks ini dipakai ulang oleh semua generator. Isi sekali, pakai berkali-kali.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {CONTEXT_FIELDS.map((field) => (
          <label key={field.key} className={field.key === 'features' ? 'md:col-span-2' : ''}>
            <span className="text-sm font-medium text-foreground">{field.label}</span>
            <textarea
              rows={field.key === 'features' ? 4 : 2}
              value={(form[field.key] as string) ?? ''}
              placeholder={field.placeholder}
              onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => onSave.mutate(form)} disabled={onSave.isPending}>{onSave.isPending ? 'Menyimpan…' : 'Simpan Konteks'}</Button>
        {onSave.isSuccess && <span className="text-sm text-emerald-600">Tersimpan</span>}
      </div>
      {projectId === 0 && <span className="hidden" />}
    </Card>
  )
}
