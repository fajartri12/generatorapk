import { useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ApiError } from '../../lib/api'
import * as api from '../../lib/api'
import { useCreditCostConfig, useCreditCosts } from '../../lib/hooks'
import { TOOL_CATALOG } from '../../lib/tools'
import { AdminSection, Notice } from './adminUi'

export function AdminCostsTab() {
  const costs = useCreditCosts()
  const config = useCreditCostConfig()
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  /** Changing a value invalidates the previous "tersimpan" confirmation. */
  function edit(key: string, value: number) {
    setEdits((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  if (costs.isError) {
    return (
      <AdminSection title="Biaya kredit" description="Tabel biaya per tool.">
        <Card><p className="text-sm text-danger">Tidak dapat memuat tabel biaya.</p></Card>
      </AdminSection>
    )
  }

  if (costs.isLoading) return <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />

  const base = costs.data ?? {}
  const current = { ...base, ...edits }
  const dirty = Object.keys(edits).length > 0
  const changed = Object.keys(edits).filter((key) => edits[key] !== base[key])

  async function save() {
    setSaving(true)
    setError('')
    try {
      await api.adminUpdateCosts(current)
      await costs.refetch()
      setEdits({})
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan biaya.')
    } finally {
      setSaving(false)
    }
  }

  const documented = TOOL_CATALOG.filter((tool) => tool.documentType)

  return (
    <AdminSection
      title="Biaya kredit"
      description="Nilai ini dipakai server saat menghitung biaya generasi. Tersimpan permanen dan langsung berlaku untuk semua pengguna."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={!dirty || saving} onClick={() => setEdits({})}>
            <RotateCcw size={14} aria-hidden /> Batalkan
          </Button>
          <Button onClick={save} disabled={!dirty || saving}>
            <Save size={14} aria-hidden /> {saving ? 'Menyimpan…' : 'Simpan biaya'}
          </Button>
        </div>
      }
    >
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Tabel biaya tersimpan dan langsung berlaku.</p>}
      {dirty && <Notice>{changed.length} nilai diubah dan belum disimpan.</Notice>}

      <div className="grid gap-4 lg:grid-cols-3">
        {documented.map((tool) => {
          const key = tool.documentType as string
          const value = current[key]
          const isDirty = edits[key] !== undefined && edits[key] !== base[key]
          return (
            <Card key={key} className={isDirty ? 'border-primary/50 ring-2 ring-primary/10' : undefined}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">{tool.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{key}</p>
                </div>
                <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-sm text-primary-dark">{tool.icon}</span>
              </div>
              <label className="mt-3 block">
                <span className="sr-only">{`Biaya kredit ${tool.name}`}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={value ?? 0}
                  onChange={(event) => edit(key, Number(event.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums text-foreground outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
                />
              </label>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Tersimpan: <span className="tabular-nums">{base[key] ?? 0}</span> kredit
                {isDirty && <span className="ml-1 font-medium text-primary">→ {value} (belum disimpan)</span>}
              </p>
            </Card>
          )
        })}
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-foreground">Saldo awal pengguna baru</h3>
        <p className="mt-1 text-sm text-muted">
          Setiap akun baru menerima{' '}
          <span className="font-semibold tabular-nums text-foreground">{config.data?.starting_balance ?? '—'}</span> kredit
          saat mendaftar. Nilai ini diatur lewat konfigurasi server (<code className="rounded bg-slate-100 px-1 text-[12px]">MD_CREDITS_STARTING_BALANCE</code>),
          bukan dari halaman ini.
        </p>
      </Card>
    </AdminSection>
  )
}
