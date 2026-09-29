import { FolderTree, LayoutTemplate, ListChecks, Terminal } from 'lucide-react'
import { Reveal } from '../../components/ui/Reveal'

const features = [
  {
    title: 'Satu proyek, semua dokumen',
    body: 'Semua hasil di satu proyek, saling terhubung. Konteks ditulis sekali dan dipakai generator berikutnya.',
    icon: FolderTree,
  },
  {
    title: 'Format berulang, isi berbeda',
    body: 'Setiap dokumen memakai kerangka yang sama, jadi Anda tidak menebak-nebak bagian mana yang harus ada.',
    icon: LayoutTemplate,
  },
  {
    title: 'Sembilan tahap berurutan',
    body: 'Pipeline menetapkan urutannya. Dokumen berikutnya membaca semua dokumen sebelumnya.',
    icon: ListChecks,
  },
  {
    title: 'Bisa diserahkan ke coding agent',
    body: 'AGENTS.md, TASKS.md, dan spesifikasi teknis ditulis untuk dibaca agent, bukan hanya manusia.',
    icon: Terminal,
  },
]

/**
 * Composition: the flagship value (project-centric workflow) gets a full-width
 * panel, the three supporting ones sit below in a row. This breaks the
 * copy-paste card grid (R-14) and matches RHYTHM 3.
 */
export function FeatureGrid() {
  const [flagship, ...rest] = features

  return (
    <section className="mx-auto max-w-6xl px-4 py-24 md:px-6">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Sekali tulis konteks, dipakai semua dokumen
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          Isi konteks proyek sekali, lalu jalankan generator mana pun. Setiap hasil membaca brief, PRD, dan dokumen
          yang sudah Anda buat sebelumnya.
        </p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-10 flex flex-col gap-6 rounded-2xl border border-border bg-surface p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-primary-dark">
              <flagship.icon size={20} aria-hidden />
            </span>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-foreground">{flagship.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{flagship.body}</p>
          </div>
          <div className="flex flex-wrap gap-2 md:max-w-xs md:justify-end">
            {['Brief', 'PRD', 'SRS', 'SDD', 'Database', 'API', 'UI/UX', 'WBS', 'AGENTS.md'].map((tag) => (
              <span key={tag} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-primary-dark">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {rest.map((f, i) => (
          <Reveal key={f.title} delay={120 + i * 80}>
            <div className="h-full rounded-xl border border-border bg-surface p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-blue-900/5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-primary-dark">
                <f.icon size={19} aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}