import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Sparkles, Wand2, X } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { useCreateProject } from '../../lib/hooks'
import { ApiError, type ApiContext, type ApiProject } from '../../lib/api'

/**
 * Wizard "Proyek baru": nama proyek dulu, lalu konteks yang dipakai ulang
 * oleh semua generator.
 *
 * Konteks dikirim bersama payload create, bukan lewat request kedua, supaya
 * proyek tidak pernah setengah jadi (nama ada, konteks gagal tersimpan).
 *
 * Urutan langkahnya mengikuti ContextBuilder/PromptTemplate: makin lengkap
 * jawabannya, makin kecil kemungkinan generator menebak-nebak.
 */

type Draft = {
  name: string
  description: string
  categories: string
  summary: string
  audience: string
  problem: string
  features: string
  business_goal: string
  tech_stack: string
}

const EMPTY: Draft = {
  name: '',
  description: '',
  categories: '',
  summary: '',
  audience: '',
  problem: '',
  features: '',
  business_goal: '',
  tech_stack: '',
}

/** Panjang minimum yang dianggap benar-benar informatif, bukan "asdf". */
const MIN_ANSWER = 12

const STEPS = [
  {
    id: 'identity',
    eyebrow: 'Langkah 1 dari 3',
    title: 'Proyek ini tentang apa?',
    hint: 'Nama yang jelas membuat proyek mudah ditemukan lagi nanti.',
  },
  {
    id: 'problem',
    eyebrow: 'Langkah 2 dari 3',
    title: 'Untuk siapa, dan masalah apa?',
    hint: 'Bagian ini paling menentukan isi dokumen. Jawab dengan kalimat Anda sendiri.',
  },
  {
    id: 'scope',
    eyebrow: 'Langkah 3 dari 3',
    title: 'Fitur, tujuan, dan teknologi',
    hint: 'Boleh dikosongkan. Generator akan menandai bagian ini sebagai asumsi.',
  },
] as const

const TECH_SUGGESTIONS = ['Laravel', 'React', 'Node.js', 'MySQL', 'PostgreSQL', 'Tailwind', 'Next.js', 'Docker']

/**
 * Kategori proyek: label bebas yang disimpan di kolom `tags` yang sudah ada,
 * jadi tidak perlu kolom atau endpoint baru. Saran di bawah hanya pintasan;
 * daftar tertutup akan cepat basi begitu ada jenis proyek yang belum terpikir.
 */
const CATEGORY_SUGGESTIONS = [
  'Web App',
  'Mobile App',
  'Dashboard',
  'Landing Page',
  'E-commerce',
  'API / Backend',
  'Internal Tool',
]

const inputClass =
  'mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15'

export function NewProjectWizard({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (project: ApiProject) => void
}) {
  const createProject = useCreateProject()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState('')

  const techStack = useMemo(
    () =>
      draft.tech_stack
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [draft.tech_stack],
  )

  const categories = useMemo(
    () =>
      draft.categories
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [draft.categories],
  )

  /** Klik saran = tambah/hapus, jadi satu daftar menangani pilih-satu maupun pilih-banyak. */
  function toggleCategory(value: string) {
    set('categories', (categories.includes(value) ? categories.filter((item) => item !== value) : [...categories, value]).join(', '))
  }

  /** Field konteks yang sudah cukup panjang untuk dipakai generator. */
  const filledContext = useMemo(
    () =>
      ([
        ['summary', draft.summary],
        ['audience', draft.audience],
        ['problem', draft.problem],
        ['features', draft.features],
        ['business_goal', draft.business_goal],
      ] as const).filter(([, value]) => value.trim().length >= MIN_ANSWER).length,
    [draft],
  )

  const completeness = Math.round((filledContext / 5) * 100)

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  function reset() {
    setDraft(EMPTY)
    setStep(0)
    setError('')
  }

  function close() {
    if (createProject.isPending) return
    reset()
    onClose()
  }

  /** Langkah 2 wajib: tanpa ini semua generator bekerja dengan tebakan. */
  function canLeaveProblemStep() {
    return draft.audience.trim().length >= MIN_ANSWER && draft.problem.trim().length >= MIN_ANSWER
  }

  function next() {
    if (step === 0) {
      if (draft.name.trim().length < 3) {
        setError('Nama proyek minimal 3 karakter.')
        return
      }
    }
    if (step === 1 && !canLeaveProblemStep()) {
      setError('Isi target pengguna dan masalahnya dulu, masing-masing minimal satu kalimat.')
      return
    }
    setStep((value) => Math.min(value + 1, STEPS.length - 1))
  }

  async function submit() {
    const context: Partial<ApiContext> = {
      summary: draft.summary.trim() || null,
      audience: draft.audience.trim() || null,
      problem: draft.problem.trim() || null,
      features: draft.features.trim() || null,
      business_goal: draft.business_goal.trim() || null,
      tech_stack: techStack.length > 0 ? techStack : null,
    }

    try {
      const { data } = await createProject.mutateAsync({
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        tags: categories.length > 0 ? categories : undefined,
        context,
      })
      reset()
      onCreated(data)
    } catch (err) {
      // Pesan validasi backend lebih tepat daripada tebakan di sini.
      const body = err instanceof ApiError ? (err.body as { errors?: Record<string, string[]> }) : null
      const first = body?.errors ? Object.values(body.errors)[0]?.[0] : null
      setError(first ?? 'Proyek belum dibuat. Periksa koneksi lalu coba lagi.')
      // Kesalahan nama selalu berasal dari langkah 1.
      if (body?.errors?.name) setStep(0)
    }
  }

  const current = STEPS[step]

  return (
    <Modal open={open} onClose={close} labelledBy="wizard-title" dismissible={!createProject.isPending} className="max-w-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg gradient-brand text-white">
            <Wand2 size={17} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{current.eyebrow}</p>
            <h2 id="wizard-title" className="mt-0.5 text-base font-semibold text-foreground">
              {current.title}
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-muted">{current.hint}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          disabled={createProject.isPending}
          aria-label="Tutup wizard"
          className="rounded-lg p-1.5 text-muted transition hover:bg-slate-100 hover:text-foreground disabled:opacity-40"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Stepper: nomor jadi centang setelah dilewati, jadi progres terbaca tanpa hitung manual. */}
      <ol className="flex items-center gap-2 border-b border-border px-5 py-3" aria-label="Tahapan wizard">
        {STEPS.map((item, index) => {
          const done = index < step
          const active = index === step
          return (
            <li key={item.id} className="flex flex-1 items-center gap-2">
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'gradient-brand text-white'
                      : 'border border-border bg-surface text-muted'
                }`}
              >
                {done ? <Check size={12} /> : index + 1}
              </span>
              <span className={`truncate text-[12px] font-medium ${active ? 'text-foreground' : 'text-muted'}`}>
                {item.id === 'identity' ? 'Identitas' : item.id === 'problem' ? 'Pengguna & masalah' : 'Ruang lingkup'}
              </span>
              {index < STEPS.length - 1 && <span aria-hidden className="h-px flex-1 bg-border" />}
            </li>
          )
        })}
      </ol>

      <div className="max-h-[52vh] overflow-y-auto px-5 py-5">
        {step === 0 && (
          <div className="space-y-4">
            <label htmlFor="wizard-name" className="block text-[12px] font-medium text-foreground">
              Nama proyek <span className="text-danger">*</span>
            </label>
            <div className="-mt-2.5">
              <input
                id="wizard-name"
                data-autofocus
                value={draft.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="mis. Aplikasi Kasir Toko Kelontong"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="wizard-description" className="block text-[12px] font-medium text-foreground">
                Deskripsi singkat <span className="font-normal text-muted">(opsional)</span>
              </label>
              <input
                id="wizard-description"
                value={draft.description}
                onChange={(event) => set('description', event.target.value)}
                placeholder="Satu baris tentang proyek ini"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="wizard-category" className="block text-[12px] font-medium text-foreground">
                Kategori <span className="font-normal text-muted">(opsional)</span>
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Saran kategori">
                {CATEGORY_SUGGESTIONS.map((item) => {
                  const active = categories.includes(item)
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleCategory(item)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] transition ${
                        active
                          ? 'border-primary bg-primary/10 font-medium text-primary'
                          : 'border-border bg-surface text-muted hover:border-primary hover:text-primary'
                      }`}
                    >
                      {active && <Check size={11} aria-hidden />}
                      {item}
                    </button>
                  )
                })}
              </div>
              <input
                id="wizard-category"
                value={draft.categories}
                onChange={(event) => set('categories', event.target.value)}
                placeholder="atau tulis sendiri, pisahkan dengan koma"
                className={inputClass}
              />
              <p className="mt-1.5 text-[11px] leading-5 text-muted">
                Kategori tampil sebagai label di kartu proyek, jadi proyek sejenis mudah ditemukan lagi.
              </p>
            </div>
            <div>
              <label htmlFor="wizard-summary" className="block text-[12px] font-medium text-foreground">
                Ringkasan <span className="font-normal text-muted">(opsional)</span>
              </label>
              <textarea
                id="wizard-summary"
                rows={3}
                value={draft.summary}
                onChange={(event) => set('summary', event.target.value)}
                placeholder="Satu paragraf: produk ini apa dan untuk siapa"
                className={inputClass}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="wizard-audience" className="block text-[12px] font-medium text-foreground">
                Siapa yang akan memakai? <span className="text-danger">*</span>
              </label>
              <textarea
                id="wizard-audience"
                data-autofocus
                rows={3}
                value={draft.audience}
                onChange={(event) => set('audience', event.target.value)}
                placeholder="mis. Pemilik toko kelontong yang belum punya sistem pencatatan"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="wizard-problem" className="block text-[12px] font-medium text-foreground">
                Masalah apa yang dipecahkan? <span className="text-danger">*</span>
              </label>
              <textarea
                id="wizard-problem"
                rows={3}
                value={draft.problem}
                onChange={(event) => set('problem', event.target.value)}
                placeholder="mis. Stok dan utang pelanggan dicatat di buku, sering selisih"
                className={inputClass}
              />
            </div>
            <p className="rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-[12px] leading-6 text-muted">
              Konteks ini dipakai ulang oleh semua generator, jadi makin spesifik jawabannya, makin sedikit generator
              menebak.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="wizard-features" className="block text-[12px] font-medium text-foreground">
                Fitur utama <span className="font-normal text-muted">(opsional, satu per baris)</span>
              </label>
              <textarea
                id="wizard-features"
                data-autofocus
                rows={4}
                value={draft.features}
                onChange={(event) => set('features', event.target.value)}
                placeholder={'Kasir dan struk\nStok otomatis berkurang\nCatatan utang pelanggan'}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="wizard-goal" className="block text-[12px] font-medium text-foreground">
                Tujuan bisnis <span className="font-normal text-muted">(opsional)</span>
              </label>
              <textarea
                id="wizard-goal"
                rows={2}
                value={draft.business_goal}
                onChange={(event) => set('business_goal', event.target.value)}
                placeholder="mis. Mengurangi selisih stok supaya pemilik tahu untung sebenarnya"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="wizard-tech" className="block text-[12px] font-medium text-foreground">
                Teknologi <span className="font-normal text-muted">(opsional, pisahkan dengan koma)</span>
              </label>
              <input
                id="wizard-tech"
                value={draft.tech_stack}
                onChange={(event) => set('tech_stack', event.target.value)}
                placeholder="Laravel, React, MySQL"
                className={inputClass}
              />
              {techStack.length === 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TECH_SUGGESTIONS.map((tech) => (
                    <button
                      key={tech}
                      type="button"
                      onClick={() => set('tech_stack', draft.tech_stack ? `${draft.tech_stack}, ${tech}` : tech)}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] text-muted transition hover:border-primary hover:text-primary"
                    >
                      + {tech}
                    </button>
                  ))}
                </div>
              )}
              {techStack.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {techStack.map((tech) => (
                    <span key={tech} className="rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-medium text-primary">
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-slate-50 p-3.5">
              <p className="text-[12px] font-medium text-foreground">Kesiapan konteks</p>
              <ProgressBar className="mt-2" value={completeness} label="Kesiapan konteks proyek" tone="auto" size="sm" />
              <p className="mt-2 text-[12px] leading-6 text-muted">
                {filledContext === 5
                  ? 'Konteks sudah lengkap. Semua generator bisa langsung bekerja.'
                  : `${filledContext} dari 5 bagian inti terisi. Sisanya boleh dilengkapi kapan saja dari tab Konteks.`}
              </p>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] font-medium leading-6 text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
        <div className="flex items-center gap-1.5 text-[12px] text-muted">
          <Sparkles size={13} aria-hidden className="text-primary" />
          Konteks bisa diubah kapan saja
        </div>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep((value) => value - 1)} disabled={createProject.isPending}>
              <ArrowLeft size={14} aria-hidden /> Kembali
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" size="sm" onClick={next}>
              Lanjut <ArrowRight size={14} aria-hidden />
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={submit} disabled={createProject.isPending}>
              {createProject.isPending ? (
                <>
                  <Loader2 size={14} aria-hidden className="animate-spin" /> Membuat…
                </>
              ) : (
                <>
                  <FileText size={14} aria-hidden /> Buat proyek
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
