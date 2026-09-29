import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, Sparkles } from 'lucide-react'
import { creditCosts } from '../../data/pricing'
import { DOC_STAGE_ORDER, docMeta } from '../../lib/documentMeta'

// The nine stages the product actually generates, taken from the shared
// pipeline order so these pages cannot drift from the product.
const STAGES = DOC_STAGE_ORDER.map((type) => ({ type, ...docMeta(type) }))

const BENEFITS = [
  'Sembilan tahap berurutan, dari brief sampai AGENTS.md.',
  'Setiap generator membaca konteks proyek dan dokumen sebelumnya.',
  'Semua draf bisa diedit, diberi versi, dan diunduh sebagai Markdown.',
]

const fieldClass =
  'mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10'

const labelClass = 'block text-sm font-medium text-foreground'

export const authFieldClass = fieldClass
export const authLabelClass = labelClass

/**
 * Shared frame for every logged-out page: brand, decorative wash and the card.
 *
 * Keeping one copy means the login, reset and forgot pages cannot drift apart.
 */
export function AuthShell({ children, showPipeline = true }: { children: ReactNode; showPipeline?: boolean }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      {/* Decorative wash. Kept out of the layout flow so it cannot affect the form. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <Link to="/" className="relative mb-8 inline-flex items-center gap-2.5 text-lg font-bold text-foreground">
        <span className="grid h-9 w-9 place-items-center rounded-xl gradient-brand text-xs font-bold text-white">
          MD
        </span>
        MDGenerator
      </Link>

      <section className="relative w-full max-w-md">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">{children}</div>
      </section>

      {showPipeline && (
        <section className="relative mt-10 w-full max-w-2xl text-center">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <Sparkles size={13} className="text-primary" />
            Sembilan tahap pipeline, satu konteks proyek
          </p>
          <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
            {STAGES.map((stage, index) => (
              <li
                key={stage.type}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-1.5 pr-2.5 text-[11px] text-muted"
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-background text-[9px] font-semibold text-foreground">
                  {index + 1}
                </span>
                {stage.category}
              </li>
            ))}
          </ul>
          <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {BENEFITS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-muted">
                <Check size={13} className="shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

/** The badge above the heading, e.g. "Akun baru" or "Selamat datang kembali". */
export function AuthBadge({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      {icon}
      {children}
    </span>
  )
}

/** Free-credit reminder shown on sign-up and on sign-in for new visitors. */
export function StartingCreditsNote() {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-lg bg-background px-3 py-2.5 text-xs text-muted">
      Setiap akun baru mendapat {creditCosts.freePlanCredits} kredit untuk mencoba seluruh generator dokumen.
    </p>
  )
}
