import { useState } from 'react'
import { Check, Clock, Paperclip, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ProofPreview } from '../../components/domain/ProofPreview'
import type { ApiPayment } from '../../lib/api'
import { useAdminDecidePayment, useAdminPayments } from '../../lib/hooks'
import { formatDateTime } from '../../lib/documentMeta'
import { AdminSection, NoRows, Pill, TableShell, Td, Th, Notice } from './adminUi'

const STATUS_FILTERS = [
  { id: undefined, label: 'Menunggu' },
  { id: 'paid', label: 'Disetujui' },
  { id: 'rejected', label: 'Ditolak' },
  { id: 'cancelled', label: 'Dibatalkan' },
  { id: 'expired', label: 'Kedaluwarsa' },
  { id: 'all', label: 'Semua' },
] as const

function statusPill(status: ApiPayment['status']) {
  if (status === 'paid') return <Pill tone="success">Disetujui</Pill>
  if (status === 'rejected') return <Pill tone="danger">Ditolak</Pill>
  if (status === 'expired') return <Pill tone="neutral">Kedaluwarsa</Pill>
  if (status === 'cancelled') return <Pill tone="neutral">Dibatalkan</Pill>
  return <Pill tone="warning">Menunggu verifikasi</Pill>
}

const rupiah = (value: number) => `Rp${value.toLocaleString('id-ID')}`

const sizeLabel = (bytes: number | null) => (bytes ? `${Math.max(1, Math.round(bytes / 1024))} KB` : '')

export function AdminPaymentsTab() {
  const [filter, setFilter] = useState<string | undefined>(undefined)
  const payments = useAdminPayments(filter === 'all' ? undefined : filter)
  const decide = useAdminDecidePayment()

  const [review, setReview] = useState<{ payment: ApiPayment; action: 'approve' | 'reject' } | null>(null)
  const [note, setNote] = useState('')
  const [proof, setProof] = useState<ApiPayment | null>(null)

  const rows = payments.data?.data ?? []
  const counts = payments.data?.counts ?? {}
  const expiring = payments.data?.expiring ?? 0
  const scheduler = payments.data?.scheduler

  const close = () => {
    setReview(null)
    setNote('')
  }

  const confirm = () => {
    if (!review) return
    decide.mutate(
      { id: review.payment.id, action: review.action, note: note.trim() || undefined },
      { onSuccess: close },
    )
  }

  // Only a transfer the user says they made is worth reviewing, so "Menunggu"
  // is the default filter rather than the full history.
  const pendingCount = counts.pending ?? 0

  return (
    <AdminSection
      title="Verifikasi pembayaran"
      description={
        pendingCount > 0
          ? `${pendingCount} pesanan menunggu verifikasi. Kredit baru ditambahkan setelah Anda menyetujui.`
          : 'Tidak ada pesanan yang menunggu. Kredit hanya bertambah setelah Anda menyetujui transfer.'
      }
      actions={
        <div role="group" aria-label="Filter status pembayaran" className="flex max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-lg border border-border bg-background p-0.5">
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
                {id === undefined && pendingCount > 0 && <span className="ml-1 tabular-nums text-amber-600">{pendingCount}</span>}
              </button>
            )
          })}
        </div>
      }
    >
      {decide.isError && (
        <Notice>{(decide.error as Error)?.message ?? 'Gagal memproses pesanan.'}</Notice>
      )}

      {scheduler?.stale && (
        <Notice>
          Pembersih pesanan kedaluwarsa belum berjalan lebih dari 6 jam. Pastikan <code>php artisan schedule:work</code>
          {' '}atau cron <code>schedule:run</code> aktif, kalau tidak pesanan kedaluwarsa akan menumpuk tanpa pernah ditandai.
        </Notice>
      )}

      {expiring > 0 && !scheduler?.stale && (
        <Notice>
          {expiring} pesanan sudah melewati batas bayar dan menunggu dibersihkan pada siklus pembersihan berikutnya.
        </Notice>
      )}

      <TableShell minWidth="min-w-[1100px]">
        <thead className="border-b border-border bg-background">
          <tr>
            <Th>Invoice</Th>
            <Th>Pengguna</Th>
            <Th>Paket</Th>
            <Th className="text-right">Nominal</Th>
            <Th className="text-right">Kredit</Th>
            <Th>Referensi transfer</Th>
            <Th>Bukti</Th>
            <Th>Batas bayar</Th>
            <Th>Status</Th>
            <Th>Waktu</Th>
            <Th className="text-right">Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {payments.isLoading ? (
            <NoRows colSpan={11} label="Memuat pesanan…" />
          ) : rows.length === 0 ? (
            <NoRows colSpan={11} label="Tidak ada pesanan pada filter ini." />
          ) : (
            rows.map((payment) => (
              <tr key={payment.id} className="transition hover:bg-slate-50">
                <Td>
                  <span className="font-mono text-xs text-foreground">{payment.code}</span>
                </Td>
                <Td>
                  <p className="text-sm text-foreground">{payment.user?.name ?? '—'}</p>
                  <p className="text-xs text-muted">{payment.user?.email ?? ''}</p>
                </Td>
                <Td>
                  <span className="text-sm text-foreground">{payment.package_label}</span>
                </Td>
                <Td className="text-right tabular-nums">{rupiah(payment.amount)}</Td>
                <Td className="text-right tabular-nums">{payment.credits.toLocaleString('id-ID')}</Td>
                <Td>
                  {payment.transfer_reference ? (
                    <span className="font-mono text-xs text-foreground">{payment.transfer_reference}</span>
                  ) : (
                    <span className="text-xs text-muted">Belum diisi</span>
                  )}
                </Td>
                <Td>
                  {payment.proof ? (
                    <button
                      type="button"
                      onClick={() => setProof(payment)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground transition hover:bg-background"
                    >
                      <Paperclip size={13} aria-hidden /> Lihat
                    </button>
                  ) : (
                    <span className="text-xs text-muted">Tidak ada</span>
                  )}
                </Td>
                <Td>
                  {payment.expires_at && payment.status === 'pending' ? (
                    <span
                      className={`whitespace-nowrap text-xs ${
                        (payment.hours_remaining ?? 99) <= 3 ? 'font-medium text-amber-700' : 'text-muted'
                      }`}
                    >
                      <Clock size={12} className="mr-1 -mt-0.5 inline" aria-hidden />
                      {formatDateTime(payment.expires_at)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </Td>
                <Td>
                  {statusPill(payment.status)}
                  {payment.status === 'rejected' && payment.admin_note && (
                    <p className="mt-1 text-xs text-muted">{payment.admin_note}</p>
                  )}
                </Td>
                <Td>
                  <span className="whitespace-nowrap text-xs text-muted">{formatDateTime(payment.created_at)}</span>
                </Td>
                <Td className="text-right">
                  {payment.status === 'pending' ? (
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" onClick={() => setReview({ payment, action: 'approve' })}>
                        <Check size={14} /> Setujui
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setReview({ payment, action: 'reject' })}>
                        <X size={14} /> Tolak
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">Selesai</span>
                  )}
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <Modal open={review !== null} onClose={close} labelledBy="payment-review-title">
        {review && (
          <div className="space-y-4">
            <div>
              <h3 id="payment-review-title" className="text-base font-semibold text-foreground">
                {review.action === 'approve' ? 'Setujui pesanan?' : 'Tolak pesanan?'}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {review.payment.code} · {review.payment.package_label} · {rupiah(review.payment.amount)}
              </p>
            </div>

            {review.action === 'approve' ? (
              <p className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground">
                <strong>{review.payment.credits.toLocaleString('id-ID')} kredit</strong> akan ditambahkan ke{' '}
                {review.payment.user?.name ?? 'pengguna'}. Pastikan transfer benar-benar sudah masuk.
              </p>
            ) : (
              <Notice>Kredit tidak akan ditambahkan dan pesanan dianggap selesai.</Notice>
            )}

            {review.payment.proof ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">
                  Bukti transfer{review.payment.proof_size ? ` · ${sizeLabel(review.payment.proof_size)}` : ''}
                  {review.payment.proof_uploaded_at ? ` · diunggah ${formatDateTime(review.payment.proof_uploaded_at)}` : ''}
                </p>
                <ProofPreview payment={review.payment} admin />
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-amber-700">
                <Paperclip size={13} aria-hidden /> Pengguna belum mengunggah bukti transfer.
              </p>
            )}

            <label className="block">
              <span className="text-xs font-medium text-muted">
                {review.action === 'approve' ? 'Catatan (opsional)' : 'Alasan penolakan (opsional)'}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={review.action === 'approve' ? 'Mis. transfer diterima 27 Sep' : 'Mis. nominal tidak sesuai'}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close} disabled={decide.isPending}>
                Batal
              </Button>
              <Button
                variant={review.action === 'approve' ? 'primary' : 'danger'}
                onClick={confirm}
                disabled={decide.isPending}
              >
                {decide.isPending ? 'Memproses…' : review.action === 'approve' ? 'Setujui & tambah kredit' : 'Tolak pesanan'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Lihat bukti transfer ────────────────────────────────────────── */}
      <Modal open={proof !== null} onClose={() => setProof(null)} labelledBy="payment-proof-title">
        {proof && (
          <div className="space-y-4">
            <div>
              <h3 id="payment-proof-title" className="text-base font-semibold text-foreground">Bukti transfer</h3>
              <p className="mt-1 text-sm text-muted">
                <span className="font-mono text-xs">{proof.code}</span> · {proof.user?.name ?? '—'}
                {proof.proof_uploaded_at ? ` · diunggah ${formatDateTime(proof.proof_uploaded_at)}` : ''}
                {proof.proof_size ? ` · ${sizeLabel(proof.proof_size)}` : ''}
              </p>
            </div>
            <ProofPreview payment={proof} admin />
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setProof(null)}>Tutup</Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminSection>
  )
}
