import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Search, Sparkles, X } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { Reveal } from '../../components/ui/Reveal'
import { docMeta } from '../../lib/documentMeta'
import { useAllDocuments, useCreditCosts, useProjects } from '../../lib/hooks'
import { TOOL_CATALOG, TOOL_CATEGORIES, toolCredits, type ToolDefinition } from '../../lib/tools'

/** Per-category identity, so a tool card can be recognised by colour alone. */
const CATEGORY_THEME: Record<string, { chip: string; text: string; ring: string; hint: string }> = {
  Product: { chip: 'bg-blue-50', text: 'text-blue-700', ring: 'hover:border-blue-200 hover:shadow-blue-900/[0.07]', hint: 'Rencana dan kebutuhan' },
  Engineering: { chip: 'bg-teal-50', text: 'text-teal-700', ring: 'hover:border-teal-200 hover:shadow-teal-900/[0.07]', hint: 'Arsitektur dan risiko' },
  Design: { chip: 'bg-pink-50', text: 'text-pink-700', ring: 'hover:border-pink-200 hover:shadow-pink-900/[0.07]', hint: 'Antarmuka dan pengalaman' },
  Development: { chip: 'bg-cyan-50', text: 'text-cyan-700', ring: 'hover:border-cyan-200 hover:shadow-cyan-900/[0.07]', hint: 'Implementasi dan serah terima' },
}

export function ToolsPage() {
  const { category } = useParams()
  const navigate = useNavigate()
  const { data: costs, isLoading: costsLoading } = useCreditCosts()
  const { data: projects } = useProjects()
  const { data: documents } = useAllDocuments()
  const [query, setQuery] = useState('')

  const active = TOOL_CATEGORIES.find((item) => item.toLowerCase() === category?.toLowerCase()) ?? null
  const firstProject = projects?.[0]

  /** How many times a generator already produced a document, per type. */
  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const doc of documents ?? []) counts.set(doc.type, (counts.get(doc.type) ?? 0) + 1)
    return counts
  }, [documents])

  const trimmed = query.trim().toLowerCase()
  const visible = TOOL_CATALOG.filter((tool) => {
    if (active && tool.category !== active) return false
    if (!trimmed) return true
    return `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(trimmed)
  })

  const readyCount = TOOL_CATALOG.filter((tool) => tool.documentType).length
  const usedCount = TOOL_CATALOG.filter((tool) => tool.documentType && usage.has(tool.documentType)).length
  const costRange = TOOL_CATALOG.map((tool) => toolCredits(costs, tool.documentType)).filter((value): value is number => value != null)

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <span>Workspace</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">Template</span>
      </div>

      {/* Panel pembuka: satu-satunya glow di halaman, supaya mata mendarat di sini dulu. */}
      <Reveal>
        <header className="relative overflow-hidden rounded-2xl border border-border bg-surface px-6 py-7 md:px-8 md:py-9">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-100/70 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-blue-50/80 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium text-primary">
                <Sparkles size={13} aria-hidden />
                {readyCount} generator siap pakai
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-[-0.035em] text-foreground md:text-[34px]">
                Template <span className="gradient-text">kerja</span> untuk setiap tahap
              </h1>
              <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted">
                Setiap template membaca konteks proyek Anda, mulai dari brief dan PRD sampai dokumen yang sudah ada,
                jadi penjelasan tidak perlu diulang.
              </p>
            </div>

            <dl className="grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
              <Stat label="Siap" value={String(readyCount)} />
              <Stat label="Sudah dipakai" value={String(usedCount)} />
              <Stat label="Biaya" value={costRange.length ? `${Math.min(...costRange)}-${Math.max(...costRange)}` : '-'} suffix="kr" />
            </dl>
          </div>
        </header>
      </Reveal>

      {/* Filter dalam satu baris: pencarian + kategori terbaca sebagai satu kontrol. */}
      <Reveal delay={60}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0" aria-label="Kategori alat">
            <CategoryTab label="Semua" count={TOOL_CATALOG.length} to="/app/templates" active={!active} />
            {TOOL_CATEGORIES.map((item) => (
              <CategoryTab
                key={item}
                label={item}
                count={TOOL_CATALOG.filter((tool) => tool.category === item).length}
                to={`/app/templates/${item.toLowerCase()}`}
                active={active === item}
              />
            ))}
          </nav>

          <div className="relative lg:w-72">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari template…"
              aria-label="Cari template"
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-9 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-foreground"
              >
                <X size={13} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </Reveal>

      {visible.length === 0 ? (
        <EmptyState
          title={trimmed ? 'Tidak ada template yang cocok' : 'Kategori kosong'}
          body={trimmed ? `Tidak ada template dengan kata kunci "${query.trim()}".` : 'Belum ada alat pada kategori ini.'}
          actionLabel={trimmed ? 'Hapus pencarian' : undefined}
          onAction={trimmed ? () => setQuery('') : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((tool, index) => (
            <Reveal key={tool.name} delay={Math.min(index, 11) * 30} from="up" className="h-full">
              <ToolCard
                tool={tool}
                credits={toolCredits(costs, tool.documentType)}
                costsLoading={costsLoading}
                used={tool.documentType ? usage.get(tool.documentType) ?? 0 : 0}
                firstProjectId={firstProject?.id}
                onRun={() => firstProject && navigate(`/app/projects/${firstProject.id}?tool=${tool.documentType}`)}
              />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums tracking-tight text-foreground">
        {value}
        {suffix && <span className="ml-0.5 text-[11px] font-medium text-muted">{suffix}</span>}
      </dd>
    </div>
  )
}

function ToolCard({
  tool,
  credits,
  costsLoading,
  used,
  firstProjectId,
  onRun,
}: {
  tool: ToolDefinition
  credits: number | null
  costsLoading: boolean
  used: number
  firstProjectId?: number
  onRun: () => void
}) {
  const theme = CATEGORY_THEME[tool.category]
  const meta = tool.documentType ? docMeta(tool.documentType) : null
  const runnable = tool.documentType !== null

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-12px_rgba(15,23,42,0.18)] ${theme.ring}`}
    >
      {/* Garis aksen warna kategori, sama seperti kartu dokumen. */}
      <span aria-hidden className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${meta?.accent ?? 'from-slate-400/70 to-slate-300/0'}`} />

      <div className="flex items-start justify-between gap-2">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-base ${theme.chip} ${theme.text}`} aria-hidden>
          {tool.icon}
        </span>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${runnable ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
          {runnable ? (costsLoading ? '…' : credits != null ? `${credits} kredit` : '-') : 'Segera'}
        </span>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-foreground">{tool.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{tool.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${theme.chip} ${theme.text}`}>{tool.category}</span>
        {used > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
            <CheckCircle2 size={10} aria-hidden />
            {used} dokumen
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        {!runnable ? (
          <span className="text-xs text-muted">Belum tersedia</span>
        ) : firstProjectId ? (
          <>
            <span className="hidden text-[11px] text-slate-400 sm:block">{theme.hint}</span>
            <button
              type="button"
              onClick={onRun}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition group-hover:bg-primary group-hover:text-white"
            >
              Jalankan <ArrowRight size={13} aria-hidden className="transition group-hover:translate-x-0.5" />
            </button>
          </>
        ) : (
          <span className="text-xs text-muted">
            <Link to="/app/projects" className="font-semibold text-primary underline">
              Buat proyek
            </Link>{' '}
            dulu.
          </span>
        )}
      </div>
    </article>
  )
}

function CategoryTab({ label, count, to, active }: { label: string; count: number; to: string; active: boolean }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
    </Link>
  )
}
