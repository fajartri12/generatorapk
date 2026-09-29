import { useEffect, useState } from 'react'
import { Landmark, Save } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ApiError } from '../../lib/api'
import { useAdminBankSettings, useAdminUpdateBankSettings } from '../../lib/hooks'
import { AdminSection, Notice } from './adminUi'

/**
 * Rekening tujuan transfer manual. Nilai di sini dibaca langsung oleh halaman
 * pembayaran pengguna, jadi perubahan berlaku seketika tanpa deploy.
 */
export function AdminBankTab() {
  const bank = useAdminBankSettings()
  const save = useAdminUpdateBankSettings()

  const [form, setForm] = useState({ bank: '', account_number: '', account_name: '', instructions: '' })
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Isi form sekali saat data pertama masuk, lalu biarkan admin mengedit.
  useEffect(() => {
    const data = bank.data
    if (!data || loaded) return
    setForm({
      bank: data.bank ?? '',
      account_number: data.account_number ?? '',
      account_name: data.account_name ?? '',
      instructions: data.instructions ?? '',
    })
    setLoaded(true)
  }, [bank.data, loaded])

  const set = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const dirty =
    bank.data !== undefined &&
    (form.bank !== (bank.data.bank ?? '') ||
      form.account_number !== (bank.data.account_number ?? '') ||
      form.account_name !== (bank.data.account_name ?? '') ||
      form.instructions !== (bank.data.instructions ?? ''))

  const valid = form.bank.trim() !== '' && form.account_number.trim() !== '' && form.account_name.trim() !== ''

  async function submit() {
    setError('')
    try {
      await save.mutateAsync({
        bank: form.bank.trim(),
        account_number: form.account_number.trim(),
        account_name: form.account_name.trim(),
        instructions: form.instructions.trim() || null,
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan rekening.')
    }
  }

  if (bank.isError) {
    return (
      <AdminSection title="Rekening" description="Rekening tujuan transfer manual.">
        <Card><p className="text-sm text-danger">Tidak dapat memuat rekening.</p></Card>
      </AdminSection>
    )
  }

  if (bank.isLoading || !loaded) return <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />

  return (
    <AdminSection
      title="Rekening"
      description="Rekening yang dilihat pengguna saat membeli kredit lewat transfer manual. Perubahan langsung tampil di halaman pembayaran."
      actions={
        <Button onClick={submit} disabled={!dirty || !valid || save.isPending}>
          <Save size={14} aria-hidden /> {save.isPending ? 'Menyimpan…' : 'Simpan rekening'}
        </Button>
      }
    >
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Rekening tersimpan dan langsung dipakai halaman pembayaran.</p>}
      {dirty && <Notice>Ada perubahan yang belum disimpan.</Notice>}
      {!valid && <Notice>Nama bank, nomor rekening, dan atas nama wajib diisi.</Notice>}

      <Card>
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-primary-dark">
            <Landmark size={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Rekening tujuan</h3>
            <p className="mt-0.5 text-xs text-muted">Tampil di header halaman pembayaran dan di popup konfirmasi transfer.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted">Nama bank</span>
            <input
              value={form.bank}
              onChange={(e) => set('bank', e.target.value)}
              maxLength={60}
              placeholder="Mis. BCA"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">Nomor rekening</span>
            <input
              value={form.account_number}
              onChange={(e) => set('account_number', e.target.value)}
              maxLength={40}
              inputMode="numeric"
              placeholder="Mis. 1234567890"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-muted">Atas nama</span>
            <input
              value={form.account_name}
              onChange={(e) => set('account_name', e.target.value)}
              maxLength={120}
              placeholder="Mis. PT MD Generator"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-muted">Instruksi transfer (opsional)</span>
            <textarea
              value={form.instructions}
              onChange={(e) => set('instructions', e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Mis. Transfer sesuai nominal tepat sampai 3 digit terakhir."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
            />
          </label>
        </div>
      </Card>
    </AdminSection>
  )
}
