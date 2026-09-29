import { Link } from 'react-router-dom'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { TOOL_CATALOG } from '../../lib/tools'
import { creditCosts } from '../../data/pricing'
import { DOC_STAGE_ORDER, docMeta } from '../../lib/documentMeta'

const READY_GENERATORS = TOOL_CATALOG.filter((tool) => tool.documentType).length

// The preview walks the real pipeline order, so the visual can never promise a
// stage the product does not generate.
const stages = DOC_STAGE_ORDER.map((type, index) => ({
  key: type,
  name: docMeta(type).category,
  state: index < 3 ? 'done' : index === 3 ? 'active' : 'queued',
}))

/**
 * Hero visual: a live snapshot of the document pipeline instead of a grey
 * skeleton (R-05 bans skeleton-as-product-shot). Each stage shows its real
 * state, so the list reads as workflow progress, not decoration.
 */
function PipelinePreview() {
  return (
    <div className="animate-float">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-xl shadow-blue-900/5">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Sistem Manajemen Rental</p>
            <p className="text-[11px] text-muted">Konteks proyek dimuat · 9 tahap</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-md bg-sky-50 px-2 py-1 text-[11px] font-medium text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-ring" aria-hidden />
            Menulis SDD
          </span>
        </div>

        <ol className="mt-4 space-y-2">
          {stages.map((stage) => (
            <li key={stage.key} className="flex items-center gap-3">
              <span
                aria-hidden
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  stage.state === 'done'
                    ? 'bg-primary text-white'
                    : stage.state === 'active'
                      ? 'border-2 border-accent text-accent'
                      : 'border border-border text-slate-300'
                }`}
              >
                {stage.state === 'done' ? <Check size={11} /> : ''}
              </span>
              <span
                className={`min-w-0 truncate text-[13px] ${
                  stage.state === 'done'
                    ? 'text-foreground'
                    : stage.state === 'active'
                      ? 'font-medium text-primary-dark'
                      : 'text-muted'
                }`}
              >
                {stage.name}
              </span>
              {stage.state === 'active' && (
                <span className="ml-auto shrink-0 text-[10px] font-medium uppercase tracking-wide text-accent">
                  Menulis
                </span>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>Konteks dipakai ulang dari 3 dokumen</span>
            <span className="font-medium text-foreground">Langkah 4 dari 9</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-4/9 rounded-full gradient-brand" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Single accent glow behind the preview anchors the fold; it is the only
          glow on the page (R-13 dose cap: 1). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-10 h-80 w-80 rounded-full bg-sky-100/60 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 md:px-6 md:pt-24 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-primary">
            <Sparkles size={13} aria-hidden />
            {READY_GENERATORS} generator, satu konteks proyek
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.06] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Dari Ide Menjadi <span className="gradient-text">Siap Bangun</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">
            Tulis konteks proyek Anda sekali. Generator berikutnya membaca konteks itu, jadi Anda tidak mengulang
            penjelasan yang sama di setiap dokumen.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-lg gradient-brand px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline-offset-4"
            >
              Buat proyek gratis
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
            >
              Masuk ke workspace
            </Link>
          </div>
          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-6">
            {[
              { term: String(READY_GENERATORS), detail: 'generator siap pakai' },
              { term: String(creditCosts.freePlanCredits), detail: 'kredit gratis untuk mulai' },
              {
                term: `${creditCosts.minPerDocument}-${creditCosts.maxPerDocument}`,
                detail: 'kredit per dokumen',
              },
            ].map((item) => (
              <div key={item.detail}>
                <dt className="text-lg font-bold tracking-tight text-foreground">{item.term}</dt>
                <dd className="text-xs text-muted">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
        <PipelinePreview />
      </div>
    </section>
  )
}