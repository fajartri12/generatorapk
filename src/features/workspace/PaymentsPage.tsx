import { useRef, useState } from 'react'
import { AlertTriangle, Banknote, Check, Clock, Copy, CreditCard, ExternalLink, FlaskConical, Loader2, Paperclip, Receipt, RefreshCw, Upload, X } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProofPreview } from '../../components/domain/ProofPreview'
import type { ApiPayment, ApiPaymentPackage } from '../../lib/api'
import { useCancelPayment, useCheckoutPakasir, useCreatePayment, usePayments, useSimulatePayment, useSubmitPayment, useSyncPayment, useUploadPaymentProof } from '../../lib/hooks'
import { formatDateTime } from '../../lib/documentMeta'

const rupiah = (value: number) => `Rp${value.toLocaleString('id-ID')}`

const STATUS: Record<ApiPayment['status'], { label: string; cls: string }> = {
  pending: { label: 'Menunggu pembayaran', cls: 'bg-amber-50 text-amber-700' },
  paid: { label: 'Disetujui', cls: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Ditolak', cls: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-slate-100 text-slate-600' },
  expired: { label: 'Kedaluwarsa', cls: 'bg-slate-100 text-slate-500' },
}

/** A gateway order is never "waiting for admin"; it settles by itself. */
const statusView = (order: ApiPayment) =>
  order.status === 'pending' && order.gateway === 'pakasir'
    ? { label: 'Menunggu pembayaran', cls: 'bg-amber-50 text-amber-700' }
    : STATUS[order.status]

const sizeLabel = (bytes: number | null) =>
  bytes ? `${Math.max(1, Math.round(bytes / 1024))} KB` : ''

/** Copy-to-clipboard with a brief tick, since the account number is long. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      window.setTimeout(() => setDone(false), 1500)
    } catch {
      // Clipboard can be blocked; the value is on screen anyway.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground transition hover:bg-background"
    >
      {done ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
      {done ? 'Tersalin' : 'Salin'}
    </button>
  )
}

export function PaymentsPage() {
  const { data, isLoading, isError, refetch } = usePayments()
  const createOrder = useCreatePayment()
  const checkout = useCheckoutPakasir()
  const submit = useSubmitPayment()
  const cancel = useCancelPayment()
  const uploadProof = useUploadPaymentProof()
  const sync = useSyncPayment()
  const simulate = useSimulatePayment()

  const [confirming, setConfirming] = useState<ApiPayment | null>(null)
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  if (isError) return <EmptyState title="Gagal memuat pembayaran" body="Tidak dapat menghubungi API." actionLabel="Coba lagi" onAction={() => refetch()} />
  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />
      </div>
    )
  }

  const orders = data.data ?? []
  const packages = data.packages ?? []
  const bank = data.bank
  const maxKb = data.proof_max_kb ?? 2048
  const pakasir = data.pakasir
  const openOrders = orders.filter((order) => order.status === 'pending')

  /** Kembalikan pembeli ke halaman ini, bukan ke nota Pakasir. */
  const redirectUrl = () => `${window.location.origin}/app/payments`

  /**
   * Dua rail bisa dimulai dari satu tombol. Manual membuat pesanan lalu user
   * mengonfirmasi transfer sendiri, Pakasir langsung membuka link bayarnya.
   */
  const startOrder = async (pkg: ApiPaymentPackage, gateway: 'manual' | 'pakasir') => {
    setActionError(null)

    try {
      if (gateway === 'manual') {
        const res = await createOrder.mutateAsync(pkg.key)
        openConfirm(res.data)
        return
      }

      const res = await checkout.mutateAsync({ packageKey: pkg.key, redirectUrl: redirectUrl() })
      // Tab baru bisa diblokir kalau dibuka setelah await, jadi beri tombol
      // cadangan di daftar pesanan alih-alih mengandalkan window.open.
      window.open(res.payment_url, '_blank', 'noopener')
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  const close = () => {
    setConfirming(null)
    setReference('')
    setNote('')
    setFile(null)
    setActionError(null)
  }

  const openConfirm = (order: ApiPayment) => {
    setConfirming(order)
    setReference(order.transfer_reference ?? '')
    setNote(order.note ?? '')
    setFile(null)
    setActionError(null)
  }

  /** Upload the receipt first, so a failed submit never throws the file away. */
  const confirmTransfer = async () => {
    if (!confirming) return
    setActionError(null)

    try {
      if (file) await uploadProof.mutateAsync({ id: confirming.id, file })
      await submit.mutateAsync({
        id: confirming.id,
        data: { transfer_reference: reference.trim(), note: note.trim() || undefined },
      })
      close()
    } catch (e) {
      setActionError((e as Error).message)
    }
  }

  const busy = uploadProof.isPending || submit.isPending

  /** Expiry is enforced server-side; this only tells the user when it lands. */
  const expiryNote = (order: ApiPayment) => {
    if (order.status !== 'pending' || !order.expires_at) return null

    const soon = (order.hours_remaining ?? 99) <= 3

    return (
      <span className={soon ? 'text-amber-700' : undefined}>
        <Clock size={12} className="mr-1 -mt-0.5 inline" aria-hidden />
        Berlaku sampai {formatDateTime(order.expires_at)}
      </span>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Cara bayar ──────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="absolute inset-x-0 top-0 h-1 gradient-brand" aria-hidden />
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl gradient-brand text-white shadow-sm">
            <Banknote size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Beli kredit lewat transfer bank</h1>
            <p className="mt-1 text-sm text-muted">
              Pilih paket, transfer ke rekening di bawah, lalu isi nomor referensi. Kredit ditambahkan setelah admin memverifikasi.
            </p>
          </div>
        </div>

        <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
          <div className="bg-surface px-4 py-3.5">
            <dt className="text-xs text-muted">Bank</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">{bank?.bank ?? '—'}</dd>
          </div>
          <div className="bg-surface px-4 py-3.5">
            <dt className="text-xs text-muted">Nomor rekening</dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-foreground">{bank?.account_number ?? '—'}</span>
              {bank?.account_number && <CopyButton value={bank.account_number} label="Salin nomor rekening" />}
            </dd>
          </div>
          <div className="bg-surface px-4 py-3.5">
            <dt className="text-xs text-muted">Atas nama</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">{bank?.account_name ?? '—'}</dd>
          </div>
        </dl>

        {bank?.instructions && (
          <p className="border-t border-border bg-background px-5 py-3 text-xs text-muted">{bank.instructions}</p>
        )}
      </header>

      {/* ── Paket ───────────────────────────────────────────────────────── */}
      <section aria-labelledby="paket-title" className="space-y-3">
        <div>
          <h2 id="paket-title" className="font-semibold text-foreground">Pilih paket</h2>
          <p className="mt-0.5 text-xs text-muted">Satu pesanan bisa dibatalkan selama belum diverifikasi admin.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {packages.map((pkg: ApiPaymentPackage) => {
            const existing = openOrders.find((order) => order.package === pkg.key)
            const busy = (createOrder.isPending && createOrder.variables === pkg.key) || (checkout.isPending && checkout.variables?.packageKey === pkg.key)

            return (
              <Card key={pkg.key} className="flex flex-col gap-3 p-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">{pkg.label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{rupiah(pkg.amount)}</p>
                  <p className="mt-1 text-xs text-muted">{pkg.credits.toLocaleString('id-ID')} kredit</p>
                </div>

                {existing ? (
                  <div className="mt-auto space-y-2">
                    <p className="text-xs text-amber-700">Pesanan {existing.code} belum selesai.</p>
                    {existing.gateway === 'pakasir' ? (
                      <p className="text-xs text-muted">Selesaikan lewat link Pakasir di daftar pesanan di bawah.</p>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={() => openConfirm(existing)}
                      >
                        <Receipt size={14} /> Konfirmasi transfer
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="mt-auto space-y-2">
                    {pakasir?.enabled ? (
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={busy}
                        onClick={() => startOrder(pkg, 'pakasir')}
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                        Bayar otomatis
                      </Button>
                    ) : null}

                    <Button
                      size="sm"
                      variant={pakasir?.enabled ? 'secondary' : 'primary'}
                      className="w-full"
                      disabled={busy}
                      onClick={() => startOrder(pkg, 'manual')}
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                      {pakasir?.enabled ? 'Transfer bank' : 'Beli paket ini'}
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        {actionError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{actionError}</p>
        )}
      </section>

      {/* ── Pesanan ─────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-foreground">Pesanan Anda</h2>
          <p className="mt-0.5 text-xs text-muted">
            Transfer hanya sah jika nomor referensi sudah diisi. Kredit masuk setelah admin menyetujui.
          </p>
        </div>

        {orders.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Belum ada pesanan. Pilih paket di atas untuk mulai.</p>
        ) : (
          <ul>
            {orders.map((order) => {
              const status = statusView(order)
              const isPakasir = order.gateway === 'pakasir'

              return (
                <li key={order.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${status.cls}`}>
                    {isPakasir ? <CreditCard size={16} /> : <Receipt size={16} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      {order.package_label} · <span className="font-mono text-xs">{order.code}</span>
                      {isPakasir && order.gateway_is_sandbox ? (
                        <span className="ml-2 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          Sandbox
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {rupiah(order.amount)} · {order.credits.toLocaleString('id-ID')} kredit
                      {order.transfer_reference ? ` · ref ${order.transfer_reference}` : ''}
                      {` · ${formatDateTime(order.created_at)}`}
                    </p>
                    {order.status === 'expired' && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <AlertTriangle size={12} aria-hidden /> Batas waktu terlampaui. Beli ulang paket ini untuk melanjutkan.
                      </p>
                    )}
                    {order.status === 'rejected' && order.admin_note && (
                      <p className="mt-0.5 text-xs text-red-600">{order.admin_note}</p>
                    )}
                    {!isPakasir && order.proof && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700">
                        <Paperclip size={12} aria-hidden /> Bukti transfer terkirim
                        {order.proof_size ? ` · ${sizeLabel(order.proof_size)}` : ''}
                      </p>
                    )}
                  </div>

                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${status.cls}`}>{status.label}</span>

                  {isPakasir && order.status === 'pending' && (
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        disabled={!order.payment_url}
                        onClick={() => order.payment_url && window.open(order.payment_url, '_blank', 'noopener')}
                      >
                        <ExternalLink size={14} /> Buka link bayar
                      </Button>
                      <Button size="sm" variant="secondary" disabled={sync.isPending} onClick={() => sync.mutate(order.id)}>
                        {sync.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Periksa status
                      </Button>
                      {order.gateway_is_sandbox && (
                        <Button size="sm" variant="ghost" disabled={simulate.isPending} onClick={() => simulate.mutate(order.id)}>
                          {simulate.isPending ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} Simulasikan
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(order.id)}
                      >
                        <X size={14} /> Batalkan
                      </Button>
                      <span className="hidden text-xs text-muted sm:inline">{expiryNote(order)}</span>
                    </div>
                  )}

                  {!isPakasir && order.status === 'pending' && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openConfirm(order)}>
                        <Upload size={14} /> {order.proof ? 'Ganti bukti' : 'Unggah bukti'}
                      </Button>
                      {!order.transfer_reference && (
                        <Button size="sm" onClick={() => openConfirm(order)}>
                          Isi referensi
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(order.id)}
                      >
                        <X size={14} /> Batalkan
                      </Button>
                      <span className="hidden text-xs text-muted sm:inline">{expiryNote(order)}</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* ── Konfirmasi transfer ─────────────────────────────────────────── */}
      <Modal open={confirming !== null} onClose={close} labelledBy="confirm-transfer-title">
        {confirming && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                  <Receipt size={18} />
                </span>
                <div>
                  <h2 id="confirm-transfer-title" className="text-base font-semibold text-foreground">Konfirmasi transfer</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    Pesanan <span className="font-mono text-xs">{confirming.code}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                aria-label="Tutup"
                className="shrink-0 rounded-md p-1 text-muted transition hover:bg-background hover:text-foreground disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-xl border border-border bg-background p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted">Jumlah transfer</span>
                <span className="text-lg font-bold tabular-nums text-foreground">{rupiah(confirming.amount)}</span>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-dashed border-border pt-2.5">
                <span className="text-xs text-muted">Ke rekening</span>
                <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground">
                  {bank?.account_number ?? '—'}
                  {bank?.account_number && <CopyButton value={bank.account_number} label="Salin nomor rekening" />}
                </span>
              </div>
              {(bank?.bank || bank?.account_name) && (
                <p className="mt-1 text-right text-xs text-muted">
                  {[bank?.bank, bank?.account_name].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            <label className="block">
              <span className="text-xs font-medium text-muted">Nomor referensi / berita transfer</span>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={120}
                placeholder="Mis. TRF-882910"
                data-autofocus
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-muted">Catatan (opsional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Mis. transfer dari rekening a.n. Budi"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
              />
            </label>

            {/* ── Bukti transfer ─────────────────────────────────────── */}
            <div>
              <span className="text-xs font-medium text-muted">Bukti transfer (opsional)</span>
              <p className="mt-0.5 text-xs text-muted">
                Screenshot atau PDF struk transfer, maksimal {maxKb} KB. Mempercepat verifikasi admin.
              </p>

              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setActionError(null)
                }}
              />

              {file ? (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-xs text-foreground">
                    <Paperclip size={13} aria-hidden />
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-muted">{sizeLabel(file.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null)
                      if (fileInput.current) fileInput.current.value = ''
                    }}
                    className="shrink-0 text-muted transition hover:text-foreground"
                    aria-label="Hapus file yang dipilih"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : confirming.proof ? (
                <div className="mt-2 space-y-2">
                  <ProofPreview payment={confirming} />
                  <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                    <Upload size={14} /> Ganti bukti
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => fileInput.current?.click()}>
                  <Upload size={14} /> Pilih file
                </Button>
              )}
            </div>

            {actionError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{actionError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close} disabled={busy}>Batal</Button>
              <Button
                onClick={confirmTransfer}
                disabled={busy || reference.trim().length === 0}
              >
                {busy ? 'Mengirim…' : 'Kirim konfirmasi'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
