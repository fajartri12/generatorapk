import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Coins,
  CreditCard,
  FileText,
  FolderKanban,
  History,
  LayoutDashboard,
  Lock,
  Server,
  Sparkles,
  User as UserIcon,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../lib/auth'
import { useAllDocuments, useCreditCosts, useCredits, useGenerations, useProjects } from '../../lib/hooks'
import { ApiError } from '../../lib/api'
import { docMeta, generatorName, relativeDate } from '../../lib/documentMeta'
import { TOOL_CATALOG } from '../../lib/tools'

const TABS = [
  { id: 'profil', label: 'Profil', icon: UserIcon },
  { id: 'kredit', label: 'Kredit & paket', icon: Coins },
  { id: 'sistem', label: 'Sistem', icon: Server },
] as const

type TabId = (typeof TABS)[number]['id']

export function SettingsPage() {
  const { user, updateProfile } = useAuth()
  const { data: costs } = useCreditCosts()
  const { data: credits } = useCredits()
  const { data: projects } = useProjects()
  const { data: documents } = useAllDocuments()
  const { data: generations } = useGenerations()
  const [tab, setTab] = useState<TabId>('profil')

  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The auth user can arrive after first paint, so sync the field once it does.
  useEffect(() => {
    setName(user?.name ?? '')
  }, [user?.name])

  const trimmed = name.trim()
  const dirty = trimmed.length > 0 && trimmed !== user?.name
  const initials = user?.name?.slice(0, 2).toUpperCase() ?? '??'
  const plan = credits?.plan ?? 'free'
  const balance = credits?.balance ?? 0

  /** Document types that actually have a working generator behind them. */
  const availableTypes = useMemo(
    () => new Set(TOOL_CATALOG.filter((tool) => tool.documentType !== null).map((tool) => tool.documentType as string)),
    [],
  )

  /** How many documents of each stage exist across all projects. */
  const generatedByType = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const document of documents ?? []) {
      counts[document.type] = (counts[document.type] ?? 0) + 1
    }
    return counts
  }, [documents])

  const totalDocuments = (documents ?? []).length
  const lastRun = useMemo(() => {
    const runs = [...(generations ?? [])].sort((a, b) => b.id - a.id)
    return runs[0]
  }, [generations])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!dirty) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateProfile({ name: name.trim() })
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const costEntries = Object.entries(costs ?? {}).sort(([, a], [, b]) => a - b)

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 gradient-brand" />
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-brand text-lg font-bold text-white shadow-lg shadow-primary/20">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">{user?.name ?? 'Pengaturan'}</h1>
            <p className="mt-0.5 truncate text-sm text-muted">{user?.email ?? ''}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold capitalize text-foreground">Paket {plan}</span>
            <Link to="/app/billing" className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning transition hover:bg-warning/20">
              <Coins size={12} aria-hidden />
              <span className="tabular-nums">{balance.toLocaleString('id-ID')}</span>
              <span className="sr-only">kredit tersisa</span>
            </Link>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-px border-t border-border bg-border">
          {[
            { icon: FolderKanban, label: 'Proyek', value: (projects ?? []).length, to: '/app/projects' },
            { icon: FileText, label: 'Dokumen', value: totalDocuments, to: '/app/documents' },
            { icon: History, label: 'Generate', value: (generations ?? []).length, to: '/app/history' },
          ].map(({ icon: Icon, label, value, to }) => (
            <Link key={label} to={to} className="flex items-center gap-2.5 bg-surface px-4 py-3 transition hover:bg-slate-50">
              <Icon size={16} aria-hidden className="shrink-0 text-muted" />
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wide text-muted">{label}</span>
                <span className="block text-sm font-semibold tabular-nums text-foreground">{value}</span>
              </span>
            </Link>
          ))}
        </dl>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div role="tablist" aria-label="Bagian pengaturan" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
        {TABS.map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={(event) => {
              // Left/Right moves between tabs, matching the ARIA tabs pattern.
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              const next = (index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length
              setTab(TABS[next].id)
              document.getElementById(`tab-${TABS[next].id}`)?.focus()
            }}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              tab === id ? 'gradient-brand text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-foreground'
            }`}
          >
            <Icon size={16} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* ── Profil ──────────────────────────────────────────────────────── */}
      {tab === 'profil' && (
        <section role="tabpanel" id="panel-profil" aria-labelledby="tab-profil" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="p-0">
            <form onSubmit={save}>
              <div className="flex items-start gap-3 border-b border-border p-5">
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-primary"><UserIcon size={17} /></span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Profil akun</h2>
                  <p className="mt-0.5 text-sm text-muted">Nama ini tampil di navbar dan pada setiap dokumen yang Anda buat.</p>
                </div>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Nama</span>
                  <input
                    value={name}
                    onChange={(e) => { setName(e.target.value); setSaved(false) }}
                    maxLength={120}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
                  />
                  <span className="mt-1 block text-[11px] text-muted">Maksimal 120 karakter · {trimmed.length}/120</span>
                </label>
                <label className="block">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    Email
                    <Lock size={11} aria-hidden className="text-slate-400" />
                  </span>
                  <input
                    readOnly
                    value={user?.email ?? ''}
                    className="mt-1 w-full cursor-not-allowed rounded-lg border border-border bg-slate-100 px-3 py-2 text-sm text-muted outline-none"
                  />
                  <span className="mt-1 block text-[11px] text-muted">Tidak dapat diubah tanpa alur verifikasi.</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-border bg-background px-5 py-4">
                <Button type="submit" disabled={saving || !dirty}>{saving ? 'Menyimpan…' : 'Simpan perubahan'}</Button>
                {saved && !dirty && (
                  <span role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
                    <Check size={14} aria-hidden />Tersimpan
                  </span>
                )}
                {dirty && !saving && <span className="text-sm text-muted">Ada perubahan belum disimpan.</span>}
                {error && (
                  <span role="alert" className="flex items-center gap-1.5 text-sm text-danger">
                    <AlertCircle size={14} aria-hidden />{error}
                  </span>
                )}
              </div>
            </form>
          </Card>

          <Card className="h-fit">
            <h2 className="text-sm font-semibold text-foreground">Aktivitas akun</h2>
            <dl className="mt-3 space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-muted">Peran</dt>
                <dd className="text-sm font-semibold capitalize text-foreground">{user?.role ?? '—'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-muted">Paket</dt>
                <dd className="text-sm font-semibold capitalize text-foreground">{plan}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-muted">Kredit tersisa</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">{balance.toLocaleString('id-ID')}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-muted">Generate terakhir</dt>
                <dd className="text-sm font-medium text-foreground">{lastRun ? relativeDate(lastRun.created_at) : 'Belum ada'}</dd>
              </div>
            </dl>
            <Link to="/app/billing" className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5">
              Lihat riwayat kredit
              <ArrowUpRight size={15} aria-hidden className="text-muted" />
            </Link>
          </Card>
        </section>
      )}

      {/* ── Kredit & paket ──────────────────────────────────────────────── */}
      {tab === 'kredit' && (
        <section role="tabpanel" id="panel-kredit" aria-labelledby="tab-kredit" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="p-0">
            <div className="flex items-start gap-3 border-b border-border p-5">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-warning"><Coins size={17} /></span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Biaya per tahap</h2>
                <p className="mt-0.5 text-sm text-muted">Dibaca langsung dari konfigurasi server. UI tidak menyimpan nilainya sendiri.</p>
              </div>
            </div>
            <ul>
              {costEntries.map(([type, amount]) => {
                const meta = docMeta(type)
                const available = availableTypes.has(type)
                const made = generatedByType[type] ?? 0
                return (
                  <li key={type} className="flex items-center gap-3 px-5 py-3">
                    <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold ${meta.chip}`}>{meta.initials}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{generatorName(type) ?? meta.category}</p>
                      <p className="truncate text-xs text-muted">{made > 0 ? `${made} dokumen dibuat` : 'Belum dibuat'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {available ? 'aktif' : 'belum ada'}
                    </span>
                    <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                      {amount}
                      <span className="ml-1 text-[11px] font-normal text-muted">kr</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card className="h-fit">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CreditCard size={16} aria-hidden className="text-muted" />
              Paket Anda
            </h2>
            <p className="mt-3 text-3xl font-bold capitalize gradient-text">{plan}</p>
            <p className="mt-1 text-sm text-muted">
              Saldo <span className="font-semibold tabular-nums text-foreground">{balance.toLocaleString('id-ID')}</span> kredit.
            </p>
            <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-primary-dark">
              Perubahan paket dilakukan oleh admin lewat panel admin. Hubungi admin workspace Anda untuk upgrade.
            </p>
            <Link to="/app/billing" className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5">
              Buka halaman tagihan
              <ArrowUpRight size={15} aria-hidden className="text-muted" />
            </Link>
          </Card>
        </section>
      )}

      {/* ── Sistem ──────────────────────────────────────────────────────── */}
      {tab === 'sistem' && (
        <section role="tabpanel" id="panel-sistem" aria-labelledby="tab-sistem" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="p-0">
            <div className="flex items-start gap-3 border-b border-border p-5">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Server size={17} /></span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">AI Provider</h2>
                <p className="mt-0.5 text-sm text-muted">Provider dipilih di sisi server supaya API key tidak pernah sampai ke browser.</p>
              </div>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-4">
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-white"><Sparkles size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Provider aktif: mock</p>
                  <p className="text-xs text-muted">Menghasilkan dokumen contoh tanpa memanggil model eksternal.</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">berjalan</span>
              </div>
              <p className="mt-4 text-sm text-muted">
                Untuk memakai model sungguhan, ubah <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px] text-foreground">AI_DEFAULT_PROVIDER</code> pada berkas{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px] text-foreground">.env</code> lalu jalankan ulang queue worker.
              </p>
            </div>
          </Card>

          <Card className="h-fit">
            <h2 className="text-sm font-semibold text-foreground">Pintasan</h2>
            <p className="mt-1 text-sm text-muted">Bagian aplikasi yang sering dipakai.</p>
            <ul className="mt-3 space-y-1">
              {[
                { to: '/app', label: 'Ringkasan', icon: LayoutDashboard },
                { to: '/app/projects', label: 'Proyek', icon: FolderKanban },
                { to: '/app/tools/product', label: 'Katalog alat', icon: Sparkles },
              ].map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link to={to} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-foreground">
                    <Icon size={16} aria-hidden />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  )
}