import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Reveal } from '../../components/ui/Reveal'
import { estimateDocuments, formatRupiah, plans } from '../../data/pricing'

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-20 border-y border-border bg-surface py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Mulai gratis, upgrade kalau perlu</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Dua paket saja. Free untuk mencoba seluruh generator, Pro sekali bayar untuk kredit yang tidak pernah hangus.
            Tidak ada langganan bulanan dan tidak ada biaya tersembunyi.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {plans.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 100}>
              <div
                className={`flex h-full flex-col rounded-xl border bg-surface p-6 transition hover:-translate-y-1 ${
                  plan.featured ? 'border-primary shadow-lg shadow-blue-900/10' : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{plan.label}</h3>
                  {plan.featured && (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-primary-dark">
                      Sekali bayar
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
                <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">
                  {plan.amount === null ? 'Rp0' : formatRupiah(plan.amount)}
                  {plan.amount !== null && <span className="text-base font-medium text-muted"> sekali</span>}
                </p>
                <p className="mt-1 text-sm font-medium text-primary">
                  {plan.credits.toLocaleString('id-ID')} kredit
                  <span className="font-normal text-muted">
                    {plan.amount === null ? ' saat mendaftar' : ` · sekitar ${estimateDocuments(plan.credits)} dokumen`}
                  </span>
                </p>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted">
                      <Check size={15} aria-hidden className="mt-0.5 shrink-0 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.amount !== null && (
                  <p className="mt-5 text-xs leading-5 text-muted">
                    Dibayar lewat transfer bank atau Pakasir. Pesanan Anda aktif setelah pembayaran terverifikasi.
                  </p>
                )}
                <Link
                  to={plan.packageKey ? '/app/payments' : '/register'}
                  className={`mt-auto pt-6 ${
                    plan.featured
                      ? 'gradient-brand flex justify-center rounded-lg py-2.5 text-sm font-medium text-white transition hover:opacity-90'
                      : 'flex justify-center rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary'
                  }`}
                >
                  {plan.packageKey ? `Upgrade ke ${plan.label}` : `Mulai dengan ${plan.label}`}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}