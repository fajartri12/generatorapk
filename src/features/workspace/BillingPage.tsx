import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Coins, RotateCcw, Banknote } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useCreditCosts, useCredits } from '../../lib/hooks'
import { docMeta, formatDateTime, generatorName } from '../../lib/documentMeta'
import type { ApiCreditTransaction } from '../../lib/api'

/** Visual treatment for each ledger entry type. */
const KINDS = {
  debit: { label: 'Keluar', sign: '-', tone: 'text-red-600', bubble: 'bg-red-50 text-red-600', Icon: ArrowDown },
  refund: { label: 'Refund', sign: '+', tone: 'text-emerald-600', bubble: 'bg-emerald-50 text-emerald-600', Icon: RotateCcw },
  grant: { label: 'Masuk', sign: '+', tone: 'text-emerald-600', bubble: 'bg-emerald-50 text-emerald-600', Icon: ArrowUp },
} as const

const FALLBACK_KIND = { label: 'Penyesuaian', sign: '', tone: 'text-slate-600', bubble: 'bg-slate-100 text-slate-600', Icon: Coins }

function kindOf(type: string) {
  return KINDS[type as keyof typeof KINDS] ?? FALLBACK_KIND
}

/**
 * Credit descriptions embed the raw document type ("Generasi brief",
 * "Refund generasi ui_ux gagal"). Match it against the server cost table so the
 * ledger can show the same chip the documents list uses — no local type list.
 */
function typeOf(description: string | null, knownTypes: string[]) {
  if (!description) return null
  return knownTypes.find((type) => description.includes(type)) ?? null
}

const FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'out', label: 'Keluar' },
  { id: 'in', label: 'Masuk' },
] as const

type FilterId = (typeof FILTERS)[number]['id']

const isOut = (tx: ApiCreditTransaction) => tx.type === 'debit'

export function BillingPage() {
  const { data: credits, isLoading, isError, refetch } = useCredits()
  const { data: costs } = useCreditCosts()
  const [filter, setFilter] = useState<FilterId>('all')

  if (isError) return <EmptyState title="Gagal memuat kredit" body="Tidak dapat menghubungi API." actionLabel="Coba lagi" onAction={() => refetch()} />
  if (isLoading || !credits) {
    return (
      <div className="space-y-5">
        <div className="h-48 animate-pulse rounded-2xl border border-border bg-surface" />
        <div className="h-72 animate-pulse rounded-xl border border-border bg-surface" />
      </div>
    )
  }

  const transactions = credits.transactions ?? []
  const knownTypes = Object.keys(costs ?? {})
  const amounts = knownTypes.map((type) => costs?.[type] ?? 0)
  const cheapest = amounts.length > 0 ? Math.min(...amounts) : 0
  const priciest = amounts.length > 0 ? Math.max(...amounts) : 0

  const spent = transactions.filter(isOut).reduce((sum, tx) => sum + tx.amount, 0)
  const gained = transactions.filter((tx) => !isOut(tx)).reduce((sum, tx) => sum + tx.amount, 0)
  const outCount = transactions.filter(isOut).length
  const inCount = transactions.length - outCount

  const countFor: Record<FilterId, number> = { all: transactions.length, out: outCount, in: inCount }
  const visible = transactions.filter((tx) => filter === 'all' || (filter === 'out' ? isOut(tx) : !isOut(tx)))

  return (
    <div className="space-y-5">
      {/* ── Saldo ───────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="absolute inset-x-0 top-0 h-1 gradient-brand" aria-hidden />
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl gradient-brand text-white shadow-sm">
            <Coins size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Saldo kredit</p>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="text-4xl leading-none font-bold tabular-nums gradient-text">{credits.balance.toLocaleString('id-ID')}</span>
              <span className="text-sm text-muted">kredit</span>
            </p>
            {knownTypes.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                Satu dokumen memakai {cheapest} sampai {priciest} kredit, tergantung jenisnya.
              </p>
            )}
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Paket <span className="capitalize">{credits.plan}</span>
            </span>
            <Link
              to="/app/payments"
              className="inline-flex items-center gap-1.5 rounded-lg gradient-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              <Banknote size={14} aria-hidden /> Beli kredit
            </Link>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-px border-t border-border bg-border">
          <div className="bg-surface px-3 py-3.5 sm:px-4">
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <ArrowDown size={13} aria-hidden className="shrink-0 text-red-500" />
              Kredit terpakai
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{spent.toLocaleString('id-ID')}</dd>
          </div>
          <div className="bg-surface px-3 py-3.5 sm:px-4">
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <ArrowUp size={13} aria-hidden className="shrink-0 text-emerald-500" />
              Kredit masuk
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{gained.toLocaleString('id-ID')}</dd>
          </div>
          <div className="bg-surface px-3 py-3.5 sm:px-4">
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <Coins size={13} aria-hidden className="shrink-0 text-warning" />
              Transaksi
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{transactions.length.toLocaleString('id-ID')}</dd>
          </div>
        </dl>
      </header>

      {/* ── Ledger ──────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">Riwayat transaksi</h2>
            <p className="mt-0.5 text-xs text-muted">Setiap perubahan saldo tercatat satu baris, tidak pernah ditimpa.</p>
          </div>
          <div role="group" aria-label="Filter transaksi" className="flex max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-lg border border-border bg-background p-0.5">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  filter === id ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
                }`}
              >
                {label}
                <span className="ml-1 tabular-nums text-muted">{countFor[id]}</span>
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            {transactions.length === 0 ? 'Belum ada transaksi. Saldo awal Anda akan tercatat di sini.' : 'Tidak ada transaksi untuk filter ini.'}
          </p>
        ) : (
          <ul>
            {visible.map((tx) => {
              const kind = kindOf(tx.type)
              const type = typeOf(tx.description, knownTypes)
              const meta = type ? docMeta(type) : null
              const tool = type ? generatorName(type) : null

              return (
                <li key={tx.id} className="flex items-center gap-3 px-5 py-3.5">
                  {meta ? (
                    <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold ${meta.chip} ${meta.text}`}>
                      {meta.initials}
                    </span>
                  ) : (
                    <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${kind.bubble}`}>
                      <kind.Icon size={16} />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{tx.description ?? kind.label}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {tool ? `${tool} · ` : ''}
                      {formatDateTime(tx.created_at)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-semibold tabular-nums ${kind.tone}`}>
                      {kind.sign}
                      {tx.amount.toLocaleString('id-ID')}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-muted">saldo {tx.balance_after.toLocaleString('id-ID')}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {transactions.length >= 50 && (
          <p className="border-t border-border px-5 py-3 text-xs text-muted">Menampilkan 50 transaksi terbaru.</p>
        )}
      </Card>
    </div>
  )
}
