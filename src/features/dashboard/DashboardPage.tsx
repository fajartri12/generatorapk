import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Check,
  Coins,
  FileText,
  FolderKanban,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProjectCard } from '../../components/domain/ProjectCard'
import { ToolCard } from '../../components/domain/ToolCard'
import { TOOL_CATALOG, toolCredits } from '../../lib/tools'
import { DOC_STAGE_ORDER, docMeta, relativeDate } from '../../lib/documentMeta'
import { useAuth } from '../../lib/auth'
import { useCreditCosts, useCredits, useGenerations, useProjects } from '../../lib/hooks'
import { NewProjectWizard } from '../projects/NewProjectWizard'

/** Tools that map to a real generator, ordered by the delivery pipeline. */
const PIPELINE_TOOLS = DOC_STAGE_ORDER.map((documentType) => TOOL_CATALOG.find((tool) => tool.documentType === documentType)).filter(
  (tool) => tool != null,
)

/** Generators the model has no stage for, appended after the core pipeline. */
const EXTRA_TOOLS = TOOL_CATALOG.filter((tool) => tool.documentType !== null && !DOC_STAGE_ORDER.includes(tool.documentType as never))

const STAGE_LABEL: Record<string, string> = {
  queued: 'Menunggu antrean',
  context: 'Menyusun konteks',
  generating: 'Menulis dokumen',
  finalizing: 'Menyelesaikan',
}

/** Compact credit figure for the header pill. */
function CreditPill({ balance, loading }: { balance: number | undefined; loading: boolean }) {
  return (
    <Link
      to="/app/billing"
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/[0.12]"
      title="Kelola kredit"
    >
      <Coins className="size-4 text-sky-300" aria-hidden />
      <span className="tabular-nums">{loading ? '…' : (balance ?? 0).toLocaleString('id-ID')}</span>
      <span className="text-xs font-normal text-slate-400">kredit</span>
    </Link>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data: projects, isLoading, isError, refetch } = useProjects()
  const { data: credits, isLoading: creditsLoading } = useCredits()
  const { data: costs } = useCreditCosts()
  const { data: generations, isLoading: runsLoading } = useGenerations()

  const [formOpen, setFormOpen] = useState(false)

  const projectCount = projects?.length ?? 0
  const totalDocuments = projects?.reduce((sum, project) => sum + (project.documents_count ?? 0), 0) ?? 0
  const balance = credits?.balance ?? 0
  const plan = credits?.plan ?? 'free'

  // Spend is derived from the ledger so the figure can never drift from reality.
  const spent = useMemo(
    () => (credits?.transactions ?? []).filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
    [credits],
  )

  const runs = useMemo(() => [...(generations ?? [])].sort((a, b) => b.id - a.id), [generations])
  const recentRuns = runs.slice(0, 6)
  const activeRuns = runs.filter((run) => run.status === 'running' || run.status === 'pending')
  const failedRuns = runs.filter((run) => run.status === 'failed').length
  const completedRuns = runs.filter((run) => run.status === 'completed')

  const projectNames = useMemo(() => new Map((projects ?? []).map((project) => [project.id, project.name])), [projects])

  const scores = useMemo(
    () =>
      (projects ?? [])
        .map((project) => {
          const count = project.documents_count ?? 0
          return { project, count, percent: Math.min(100, Math.round((count / DOC_STAGE_ORDER.length) * 100)) }
        })
        .sort((a, b) => b.count - a.count || a.project.name.localeCompare(b.project.name)),
    [projects],
  )

  const readyCount = scores.filter((score) => score.count >= DOC_STAGE_ORDER.length).length
  const gaps = scores.slice(0, 3).map((score) => ({ ...score, missing: DOC_STAGE_ORDER.length - score.count }))

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? 'kreator'

  return (
    <div className="space-y-6">
      {/* ── Motivating header: greeting, status, next action ───────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              {firstName ? `Halo, ${firstName}` : 'Workspace Anda'}
            </p>
            <CreditPill balance={credits?.balance} loading={creditsLoading} />
          </div>

          <h1 className="mt-4 max-w-2xl text-[1.7rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[2.1rem]">
            Dokumentasi proyek Anda, dalam satu alur.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400">
            {activeRuns.length > 0
              ? `${activeRuns.length} dokumen sedang dibuat. Prosesnya jalan di server, halaman ini boleh ditutup.`
              : gaps.length > 0 && gaps[0].missing > 0
                ? `${gaps[0].project.name} kurang ${gaps[0].missing} dokumen lagi untuk lengkap.`
                : 'Isi konteks proyek sekali, lalu jalankan generator mana pun yang Anda butuhkan.'}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-3">
            <Button
              onClick={() => setFormOpen(true)}
              className="min-h-11 border-0 bg-white text-slate-900 hover:bg-slate-100"
            >
              <Plus size={16} aria-hidden /> Buat proyek baru
            </Button>
            <Link
              to="/app/tools/product"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/15 px-4 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
            >
              Jelajahi alat
              <ArrowUpRight size={15} aria-hidden />
            </Link>
          </div>

          {/* At-a-glance strip: real numbers, no invented quota */}
          <dl className="mt-7 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-4">
            {[
              { icon: FolderKanban, label: 'Proyek', value: projectCount, to: '/app/projects' },
              { icon: FileText, label: 'Dokumen tersimpan', value: totalDocuments, to: '/app/documents' },
              { icon: Activity, label: 'Generate selesai', value: completedRuns.length, to: '/app/history' },
              { icon: Sparkles, label: 'Paket', value: plan, to: '/app/billing' },
            ].map(({ icon: Icon, label, value, to }) => (
              <Link key={label} to={to} className="group">
                <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </dt>
                <dd className="mt-1.5 flex items-baseline gap-1 text-2xl font-semibold tabular-nums capitalize tracking-tight">
                  {isLoading && label !== 'Paket' ? '—' : value}
                  <ArrowRight className="size-3.5 -translate-x-1 text-slate-500 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                </dd>
              </Link>
            ))}
          </dl>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Left column: pipeline health + projects ───────────────────── */}
        <div className="space-y-5">
          <section aria-labelledby="pipeline-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="pipeline-heading" className="text-lg font-semibold tracking-tight text-foreground">
                  Kesiapan dokumentasi
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Satu proyek dihitung lengkap kalau {DOC_STAGE_ORDER.length} tahap pipeline sudah terisi, dari brief
                  sampai AGENTS.md.
                </p>
              </div>
              {!isLoading && (
                <Badge tone={readyCount > 0 ? 'success' : 'neutral'}>
                  {readyCount > 0 ? `${readyCount} proyek lengkap` : 'Belum ada yang lengkap'}
                </Badge>
              )}
            </div>

            {isError ? (
              <div className="mt-4">
                <EmptyState
                  title="Gagal memuat proyek"
                  body="Server workspace tidak menjawab. Coba muat ulang halaman ini."
                  actionLabel="Coba lagi"
                  onAction={() => refetch()}
                />
              </div>
            ) : isLoading ? (
              <div className="mt-4 h-56 animate-pulse rounded-2xl border border-border bg-surface" />
            ) : projectCount === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="Belum ada proyek"
                  body="Satu proyek menampung konteks dan semua dokumennya. Mulai dari sini."
                  actionLabel="Buat proyek baru"
                  onAction={() => setFormOpen(true)}
                />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                {/* Stage coverage per project */}
                <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">Cakupan tahap per proyek</h3>
                    <span className="text-xs text-muted">{DOC_STAGE_ORDER.length} tahap</span>
                  </div>

                  {/* Column legend: tells you which stage each dot is */}
                  <div className="mt-4">
                    <div>
                      <div className="flex gap-1 pl-[100px]">
                        {DOC_STAGE_ORDER.map((type) => (
                          <span
                            key={type}
                            className="flex-1 truncate text-center font-mono text-[9px] uppercase text-slate-400"
                            title={docMeta(type).category}
                          >
                            {docMeta(type).initials}
                          </span>
                        ))}
                      </div>
                      <ul className="mt-1.5 space-y-2.5">
                        {scores.map(({ project, count, percent }) => (
                          <li key={project.id} className="flex items-center gap-2">
                            <Link
                              to={`/app/projects/${project.id}`}
                              className="w-[92px] shrink-0 truncate text-[13px] font-medium text-foreground transition hover:text-primary"
                              title={project.name}
                            >
                              {project.name}
                            </Link>
                            <span className="flex flex-1 gap-1" aria-label={`${count} dari ${DOC_STAGE_ORDER.length} tahap selesai`}>
                              {DOC_STAGE_ORDER.map((type, index) => (
                                <span
                                  key={type}
                                  title={`${docMeta(type).category}: ${index < count ? 'sudah ada' : 'belum ada'}`}
                                  className={`h-2.5 flex-1 rounded-full ${index < count ? 'bg-gradient-to-r from-primary to-accent' : 'bg-slate-100'}`}
                                />
                              ))}
                            </span>
                            <span className="w-8 shrink-0 text-right text-[12px] font-semibold tabular-nums text-muted">{percent}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* What to do next */}
                <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="size-4 text-primary" aria-hidden />
                    Langkah berikutnya
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {gaps.map(({ project, missing }) => (
                      <li key={project.id} className="flex items-start gap-3 text-[13px]">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                          <Check className="size-3" aria-hidden />
                        </span>
                        {missing > 0 ? (
                          <span className="leading-5 text-slate-600">
                            <Link to={`/app/projects/${project.id}`} className="font-semibold text-foreground transition hover:text-primary">
                              {project.name}
                            </Link>{' '}
                            kurang {missing} dokumen lagi
                          </span>
                        ) : (
                          <span className="leading-5 text-slate-600">
                            <Link to={`/app/projects/${project.id}`} className="font-semibold text-foreground transition hover:text-primary">
                              {project.name}
                            </Link>{' '}
                            sudah lengkap
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/app/tools/product"
                    className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition hover:text-primary-dark"
                  >
                    Pilih generator
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="projects-heading">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id="projects-heading" className="text-lg font-semibold tracking-tight text-foreground">
                  Proyek
                </h2>
                <p className="mt-1 text-sm text-muted">Buka proyek untuk melanjutkan dokumentasi.</p>
              </div>
              <Link to="/app/projects" className="shrink-0 text-sm font-medium text-primary transition hover:text-primary-dark">
                Lihat semua
              </Link>
            </div>
            {!isLoading && !isError && projectCount > 0 && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(projects ?? []).slice(0, 4).map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={{
                      id: String(project.id),
                      name: project.name,
                      description: project.description ?? '',
                      icon: project.icon,
                      color: project.color,
                      tags: project.tags ?? [],
                      progress: Math.min(100, Math.round(((project.documents_count ?? 0) / DOC_STAGE_ORDER.length) * 100)),
                      updated: new Date(project.updated_at).toLocaleDateString('id-ID'),
                      documents: project.documents_count ?? 0,
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Right column: activity + credits ──────────────────────────── */}
        <div className="space-y-5">
          <section aria-labelledby="activity-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between gap-3">
              <h2 id="activity-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Activity className="size-4 text-muted" aria-hidden />
                Aktivitas generate
              </h2>
              <Link to="/app/history" className="text-[12px] font-medium text-primary transition hover:text-primary-dark">
                Riwayat
              </Link>
            </div>

            {failedRuns > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-800">
                <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                {failedRuns} proses gagal. Kreditnya sudah dikembalikan, silakan coba lagi.
              </p>
            )}

            {runsLoading ? (
              <div className="mt-4 space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-50" />
                ))}
              </div>
            ) : recentRuns.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
                Belum ada proses generate. Pilih alat untuk membuat dokumen pertama.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {recentRuns.map((run) => {
                  const meta = docMeta(run.document_type)
                  return (
                    <li key={run.id}>
                      <Link
                        to={`/app/documents/${run.document_id}`}
                        className="flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition hover:border-border hover:bg-slate-50"
                      >
                        <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${meta.chip} ${meta.text}`} aria-hidden>
                          {meta.initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">{meta.category}</span>
                          <span className="block truncate text-[11px] text-muted">
                            {projectNames.get(run.project_id) ?? `Proyek #${run.project_id}`} · {relativeDate(run.created_at)}
                          </span>
                        </span>
                        {run.status === 'running' || run.status === 'pending' ? (
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-blue-700">
                            <Loader2 className="size-3 animate-spin" aria-hidden />
                            {STAGE_LABEL[run.stage] ?? 'Berjalan'}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] text-muted">{run.credits_used > 0 ? `-${run.credits_used}` : '0'} kredit</span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}

            {activeRuns.length > 0 && (
              <p className="mt-3 text-[11px] leading-5 text-muted">
                Progres diperbarui otomatis tiap 1,5 detik selama proses berjalan.
              </p>
            )}
          </section>

          <section aria-labelledby="credits-heading" className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h2 id="credits-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Coins className="size-4 text-muted" aria-hidden />
              Kredit Anda
            </h2>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {creditsLoading ? '…' : balance.toLocaleString('id-ID')}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              Total {spent.toLocaleString('id-ID')} kredit terpakai
              {completedRuns.length > 0 && ` · rata-rata ${Math.round(spent / completedRuns.length)} per dokumen`}
            </p>

            <div className="mt-4 space-y-2.5">
              {PIPELINE_TOOLS.map((tool, index) => (
                <div key={tool.name} className="flex items-center gap-3 text-[12px]">
                  <span className="w-5 shrink-0 text-right font-mono text-[10px] text-slate-400">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-600">{tool.name}</span>
                  <span className="shrink-0 font-medium tabular-nums text-foreground">
                    {toolCredits(costs, tool.documentType) ?? '—'}
                  </span>
                </div>
              ))}
            </div>

            <Link
              to="/app/billing"
              className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary transition hover:text-primary-dark"
            >
              Kelola kredit
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>
        </div>
      </div>

      <section aria-labelledby="tools-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="tools-heading" className="text-lg font-semibold tracking-tight text-foreground">
              Alat AI
            </h2>
            <p className="mt-1 text-sm text-muted">Pilih format dokumen sesuai tahap proyek Anda.</p>
          </div>
          <Badge tone="accent">
            <Sparkles size={11} aria-hidden /> Biaya tampil sebelum generate
          </Badge>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...PIPELINE_TOOLS, ...EXTRA_TOOLS].map((tool) => (
            <ToolCard key={tool.name} tool={tool} credits={toolCredits(costs, tool.documentType)} />
          ))}
        </div>
      </section>

      {/* ── New project wizard (context is captured at creation time) ──── */}
      <NewProjectWizard
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(project) => window.location.assign(`/app/projects/${project.id}`)}
      />
    </div>
  )
}

