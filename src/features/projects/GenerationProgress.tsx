import { AlertTriangle, Check, Loader2, Sparkles, X } from 'lucide-react'
import type { GenerationStage } from '../../lib/api'
import { Modal } from '../../components/ui/Modal'

/**
 * Ordered stages of one generation, in the order the backend advances them.
 * The active index drives the progress bar; the label is the real server stage.
 */
const STAGES: { key: GenerationStage; label: string; hint: string }[] = [
  { key: 'queued', label: 'Menyiapkan antrean', hint: 'Memesan kredit dan mengantre pekerjaan.' },
  { key: 'context', label: 'Menyusun konteks proyek', hint: 'Menggabungkan konteks dan dokumen sebelumnya.' },
  { key: 'model', label: 'Menulis dokumen', hint: 'Model sedang menyusun draf lengkap.' },
  { key: 'saving', label: 'Menyimpan versi', hint: 'Menyimpan hasil sebagai versi baru.' },
  { key: 'done', label: 'Selesai', hint: 'Dokumen siap dibuka.' },
]

const STAGE_INDEX: Record<GenerationStage, number> = {
  queued: 0,
  context: 1,
  model: 2,
  saving: 3,
  done: 4,
  failed: 4,
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

/**
 * Live progress for an in-flight generation, shown as a blocking dialog so the
 * run cannot be scrolled past or interleaved with another one. The stage is
 * never guessed on the client — it is whatever the backend last wrote.
 *
 * `status` distinguishes an in-flight run from a finished-but-unacknowledged
 * one, which lets the dialog show a genuine success state before closing.
 */
export function GenerationProgress({
  stage,
  elapsedMs,
  onCancel,
  cancelling,
  status = 'running',
  documentTitle,
  error,
  onClose,
}: {
  stage: GenerationStage
  elapsedMs: number
  onCancel: () => void
  cancelling: boolean
  status?: 'pending' | 'running' | 'completed' | 'failed' | string
  documentTitle?: string
  error?: string | null
  onClose?: () => void
}) {
  const failed = status === 'failed'
  const completed = status === 'completed' && !failed
  const current = failed ? STAGE_INDEX[stage] : Math.max(0, STAGE_INDEX[stage] ?? 0)
  const percent = failed ? 100 : Math.round((current / (STAGES.length - 1)) * 100)

  return (
    <Modal open onClose={onClose ?? onCancel} dismissible={false} labelledBy="generation-progress-title">
      {/* Accent wash + top gradient rule give the dialog its "alive" feel. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 gradient-brand" />

      <div className="relative px-6 pb-5 pt-6">
        <div className="flex items-start gap-4">
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-lg ${
              failed ? 'bg-danger' : completed ? 'bg-success' : 'gradient-brand'
            }`}
            aria-hidden
          >
            {failed ? <AlertTriangle size={22} /> : completed ? <Check size={22} /> : <Sparkles size={22} className="animate-pulse" />}
          </span>

          <div className="min-w-0 flex-1">
            <h2 id="generation-progress-title" className="text-base font-semibold text-foreground">
              {failed ? 'Generasi gagal' : completed ? 'Dokumen selesai' : 'AI sedang bekerja'}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted">
              {documentTitle ? <span className="font-medium text-foreground">{documentTitle}</span> : STAGES[current]?.label}
            </p>
          </div>

          {!failed && !completed && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-muted">
              {formatElapsed(elapsedMs)}
            </span>
          )}
        </div>

        {/* Big headline percentage + soft gradient bar. */}
        <div className="mt-6 flex items-end justify-between gap-3">
          <span className="text-4xl font-bold tabular-nums tracking-[-0.03em] text-foreground">{percent}%</span>
          <span className="pb-1.5 text-xs font-medium text-muted">
            {failed ? 'Dihentikan' : completed ? 'Tersimpan' : STAGES[current]?.hint}
          </span>
        </div>

        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progres generasi">
          <div
            className={`relative h-full rounded-full transition-[width] duration-700 ease-out ${failed ? 'bg-danger' : completed ? 'bg-success' : 'gradient-brand'}`}
            style={{ width: `${percent}%` }}
          >
            {!failed && !completed && <span aria-hidden className="absolute inset-0 animate-shimmer" />}
          </div>
        </div>

        {/* Vertical timeline of the real server stages. */}
        <ol className="mt-6 space-y-0.5">
          {STAGES.map((item, index) => {
            const reached = index <= current
            const isCurrent = index === current && !completed && !failed
            const isDone = reached && !isCurrent
            return (
              <li key={item.key} className={`flex gap-3 rounded-lg px-2 py-2 ${isCurrent ? 'bg-primary/5' : ''}`}>
                <span className="relative flex flex-col items-center" aria-hidden>
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                      isDone ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isDone ? <Check size={13} /> : index + 1}
                  </span>
                  {index < STAGES.length - 1 && <span className={`mt-0.5 w-px flex-1 ${isDone ? 'bg-emerald-200' : 'bg-slate-200'}`} />}
                </span>
                <span className="min-w-0 pb-1.5">
                  <span className={`block text-sm ${isCurrent ? 'font-medium text-primary-dark' : reached ? 'text-foreground' : 'text-muted'}`}>
                    {item.label}
                    {isCurrent && <Loader2 size={12} className="ml-1.5 inline animate-spin align-[-1px]" aria-hidden />}
                  </span>
                  {(isCurrent || isDone) && <span className="mt-0.5 block text-xs text-muted">{item.hint}</span>}
                </span>
              </li>
            )
          })}
        </ol>

        {failed && error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted">
            {failed
              ? 'Kredit otomatis dikembalikan.'
              : completed
                ? 'Dokumen baru sudah masuk ke proyek.'
                : 'Kredit dikembalikan otomatis jika dibatalkan atau gagal.'}
          </p>

          {failed || completed ? (
            <button
              type="button"
              onClick={onClose ?? onCancel}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-white transition hover:bg-primary-dark"
            >
              {failed ? 'Tutup' : 'Lihat dokumen'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-medium text-foreground transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
            >
              <X size={13} aria-hidden />
              {cancelling ? 'Membatalkan…' : 'Batalkan'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
