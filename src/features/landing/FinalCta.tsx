import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Reveal } from '../../components/ui/Reveal'

export function FinalCta() {
  return (
    <section className="bg-slate-900 py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <div className="grid gap-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 md:grid-cols-[1.2fr_1fr] md:items-center md:p-12">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Mulai dari satu deskripsi ide
              </h2>
              <p className="mt-3 max-w-xl text-slate-400">
                Hasilnya dokumen Markdown yang bisa dibaca tim Anda atau diserahkan ke coding agent.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="rounded-lg gradient-brand px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Buat proyek gratis
                </Link>
                <a
                  href="#pricing"
                  className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  Lihat paket
                </a>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              {['Kredit gratis untuk mulai', 'Tanpa kartu kredit', 'Akses ke generator inti', 'Langsung bisa dipakai'].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check size={15} aria-hidden className="shrink-0 text-success" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}