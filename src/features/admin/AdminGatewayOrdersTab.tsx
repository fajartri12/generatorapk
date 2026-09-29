import { useState } from 'react'
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { ApiPayment } from '../../lib/api'
import { useAdminGatewayOrders, useAdminSyncGatewayOrder } from '../../lib/hooks'
import { formatDateTime } from '../../lib/documentMeta'
import { AdminSection, NoRows, Notice, Pill, TableShell, Td, Th } from './adminUi'

/**
 * Pesanan Pakasir. Antrean verifikasi manual sengaja tidak memuatnya karena
 * tidak ada bukti transfer yang perlu diperiksa manusia. Akibatnya pesanan ini
 * dulu tak terlihat sama sekali padahal uangnya bisa saja sudah masuk.
 */
const STATUS_FILTERS = [
  { id: undefined, label: 'Menunggu' },
  { id: 'paid', label: 'Lunas' },
  { id: 'expired', label: 'Kedaluwarsa' },
  { id: 'cancelled', label: 'Dibatalkan' },
  { id: 'all', label: 'Semua' },
] as const

function statusPill(status: ApiPayment['status']) {
  if (status === 'paid') return <Pill tone="success">Lunas</Pill>
  if (status === 'expired') return <Pill tone="neutral">Kedaluwarsa</Pill>
  if (status === 'cancelled') return <Pill tone="neutral">Dibatalkan</Pill>
  if (status === 'rejected') return <Pill tone="danger">Ditolak</Pill>
  return <Pill tone="warning">Menunggu bayar</Pill>
}

const rupiah = (value: number) => `Rp${value.toLocaleString('id-ID')}`

export function AdminGatewayOrdersTab() {
  const [filter, setFilter] = useState<string | undefined>(undefined)
  const orders = useAdminGatewayOrders(filter === 'all' ? undefined : filter)
  const sync = useAdminSyncGatewayOrder()
  const [busyId, setBusyId] = useState<number | null>(null)

  const rows = orders.data?.data ?? []
  const counts = orders.data?.counts ?? {}
  const pending = counts.pending ?? 0

  function runSync(id: number) {
    setBusyId(id)
    sync.mutate(id, { onSettled: () => setBusyId(null) })
  }

  return (
    <AdminSection
      title="Pesanan gateway"
      description={
        pending > 0
          ? `${pending} pesanan Pakasir menunggu pembayaran. Status pesanan ini diperbarui otomatis lewat webhook atau pemeriksaan berkala.`
          : 'Tidak ada pesanan Pakasir yang menunggu. Pesanan lunas tercatat di sini sebagai rujukan bila pengguna melapor kreditnya tidak masuk.'
      }
      actions={
        <div role="group" aria-label="Filter status pesanan gateway" className="flex max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-lg border border-border bg-background p-0.5">
          {STATUS_FILTERS.map(({ id, label }) => {
            const active = filter === id
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(id)}
                className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  active ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
                }`}
              >
                {label}
                {id === undefined && pending > 0 && <span className="ml-1 tabular-nums text-amber-600">{pending}</span>}
              </button>
            )
          })}
        </div>
      }
    >
      {sync.isError && <Notice>{(sync.error as Error)?.message ?? 'Gagal memeriksa status pesanan.'}</Notice>}

      <TableShell minWidth="min-w-[1000px]">
        <thead className="border-b border-border bg-background">
          <tr>
            <Th>Invoice</Th>
            <Th>Pengguna</Th>
            <Th>Paket</Th>
            <Th className="text-right">Nominal</Th>
            <Th className="text-right">Kredit</Th>
            <Th>Metode</Th>
            <Th>ID transaksi</Th>
            <Th>Status</Th>
            <Th>Dibuat</Th>
            <Th className="text-right">Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {orders.isLoading ? (
            <NoRows colSpan={10} label="Memuat pesanan gateway…" />
          ) : rows.length === 0 ? (
            <NoRows colSpan={10} label="Belum ada pesanan gateway pada filter ini." />
          ) : (
            rows.map((order) => (
              <tr key={order.id} className="transition hover:bg-slate-50">
                <Td>
                  <span className="font-mono text-xs text-foreground">{order.code}</span>
                  {order.gateway_is_sandbox && (
                    <span className="ml-1.5 align-middle text-[10px] font-medium text-amber-700">sandbox</span>
                  )}
                </Td>
                <Td>
                  <p className="text-sm text-foreground">{order.user?.name ?? '—'}</p>
                  <p className="text-xs text-muted">{order.user?.email ?? ''}</p>
                </Td>
                <Td><span className="text-sm text-foreground">{order.package_label}</span></Td>
                <Td className="text-right tabular-nums">{rupiah(order.amount)}</Td>
                <Td className="text-right tabular-nums">{order.credits.toLocaleString('id-ID')}</Td>
                <Td>
                  <span className="text-xs text-muted">{order.gateway_method ?? order.gateway}</span>
                </Td>
                <Td>
                  {order.gateway_txn_id ? (
                    <span className="font-mono text-xs text-foreground">{order.gateway_txn_id}</span>
                  ) : (
                    <span className="text-xs text-muted">Belum ada</span>
                  )}
                </Td>
                <Td>{statusPill(order.status)}</Td>
                <Td>
                  <span className="whitespace-nowrap text-xs text-muted">{formatDateTime(order.created_at)}</span>
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => runSync(order.id)} disabled={busyId === order.id}>
                      <RefreshCw size={14} className={busyId === order.id ? 'animate-spin' : undefined} />
                      {busyId === order.id ? 'Memeriksa…' : 'Periksa ulang'}
                    </Button>
                    {order.payment_url && order.status === 'pending' && (
                      <a
                        href={order.payment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground transition hover:bg-background"
                      >
                        <ExternalLink size={13} aria-hidden /> Link
                      </a>
                    )}
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <p className="flex items-start gap-1.5 text-xs text-slate-400">
        <AlertTriangle size={13} aria-hidden className="mt-0.5 shrink-0" />
        Tombol periksa ulang menanyakan status terbaru ke Pakasir. Kredit hanya ditambahkan oleh satu jalur
        penyelesaian di server, jadi menekannya berkali-kali tidak akan menggandakan saldo.
      </p>
    </AdminSection>
  )
}
