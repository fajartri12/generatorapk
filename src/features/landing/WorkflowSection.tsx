import { Reveal } from '../../components/ui/Reveal'

const steps = [
  { title: 'Tulis konteks proyek', body: 'Ringkasan, target pengguna, masalah, dan fitur utama. Lima kolom, sekali isi.' },
  { title: 'Jalankan generator', body: 'Setiap dokumen dibuat dari konteks itu dan semua dokumen sebelumnya.' },
  { title: 'Edit dan simpan versi', body: 'Ubah draf mana pun. Versi lama tetap tersimpan dan bisa dibandingkan.' },
  { title: 'Serahkan ke tim atau agent', body: 'Unduh Markdown-nya, atau pakai AGENTS.md sebagai titik awal coding agent.' },
]

export function WorkflowSection() {
  return (
    <section id="cara-kerja" className="scroll-mt-20 border-y border-border bg-surface py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Dari ide sampai siap dibangun</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Anda tidak mulai dari halaman kosong. Konteks proyek ditulis sekali, lalu dipakai ulang oleh setiap generator
            berikutnya.
          </p>
        </Reveal>

        <ol className="relative mt-12 grid gap-10 md:grid-cols-4 md:gap-6">
          {/* Connector line only on desktop, where the steps sit in a row. */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-4 hidden h-px bg-border md:block"
          />
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 110}>
              <li className="relative">
                <span className="relative z-10 grid h-8 w-8 place-items-center rounded-lg gradient-brand text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}