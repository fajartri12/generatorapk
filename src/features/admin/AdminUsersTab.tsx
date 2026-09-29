import { useMemo, useState, type FormEvent } from 'react'
import { Coins, Search, ShieldCheck, SlidersHorizontal, UserPlus, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { ApiError } from '../../lib/api'
import * as api from '../../lib/api'
import type { ApiAdminUser } from '../../lib/api'
import { useAdminBulkCredits, useAdminUsers } from '../../lib/hooks'
import { formatDate } from '../../lib/documentMeta'
import { ExportButton } from './ExportButton'
import { AdminSection, NoRows, Notice, Pill, SearchField, TableShell, Td, Th } from './adminUi'

const ROLES = ['user', 'pro', 'admin'] as const
const PLANS = ['free', 'pro'] as const

const ROLE_TONE: Record<string, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  user: 'neutral',
  pro: 'primary',
  admin: 'danger',
}

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10'

export function AdminUsersTab() {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | (typeof ROLES)[number]>('all')
  const [planFilter, setPlanFilter] = useState<'all' | (typeof PLANS)[number]>('all')
  // Akun terdaftar tanpa proyek adalah populasi yang paling sering dicari.
  const [inactive, setInactive] = useState(false)
  const users = useAdminUsers(inactive)
  const bulk = useAdminBulkCredits()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [granting, setGranting] = useState<ApiAdminUser | null>(null)
  const [adjusting, setAdjusting] = useState<ApiAdminUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (users.data ?? []).filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) return false
      if (planFilter !== 'all' && user.plan !== planFilter) return false
      if (!needle) return true
      return user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)
    })
  }, [users.data, query, roleFilter, planFilter])

  const filtered = Boolean(query.trim()) || roleFilter !== 'all' || planFilter !== 'all' || inactive

  async function run(userId: number, action: () => Promise<unknown>) {
    setBusyId(userId)
    setError('')
    try {
      await action()
      await users.refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Aksi gagal dijalankan.')
    } finally {
      setBusyId(null)
    }
  }

  function toggle(userId: number) {
    setSelected((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    )
  }

  function toggleAll() {
    const visible = rows.map((user) => user.id)
    const allVisible = visible.every((id) => selected.includes(id))
    setSelected(allVisible ? selected.filter((id) => !visible.includes(id)) : [...new Set([...selected, ...visible])])
  }

  async function submitGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!granting) return
    const data = Object.fromEntries(new FormData(event.currentTarget)) as { amount: string; description: string }
    const user = granting
    setGranting(null)
    setNotice('')
    await run(user.id, () =>
      api.adminGrantCredits(user.id, {
        amount: Number(data.amount),
        description: data.description || undefined,
      }),
    )
  }

  // Koreksi saldo memakai endpoint yang sama dengan massal, tapi terpisah
  // supaya batasnya jelas: satu akun, satu keterangan wajib.
  async function submitAdjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!adjusting) return
    const data = Object.fromEntries(new FormData(event.currentTarget)) as { amount: string; description: string }
    const user = adjusting
    setAdjusting(null)
    setNotice('')
    await run(user.id, () =>
      api.adminAdjustCredits(user.id, { amount: Number(data.amount), description: data.description }),
    )
  }

  async function submitBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget)) as { amount: string; description: string }
    setError('')
    try {
      const res = await bulk.mutateAsync({ user_ids: selected, amount: Number(data.amount), description: data.description })
      setNotice(res.message)
      setSelected([])
      setBulkOpen(false)
      await users.refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Aksi massal gagal dijalankan.')
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form)) as { name: string; email: string; password: string; role: string }
    setCreating(true)
    setError('')
    try {
      await api.adminCreateUser(data)
      form.reset()
      await users.refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat pengguna.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <AdminSection
      title="Pengguna"
      description={`${users.data?.length ?? 0} akun ${inactive ? 'terdaftar tanpa proyek' : 'terdaftar'}. Ubah role, paket, dan saldo kredit setiap pengguna.`}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full sm:w-56">
            <SearchField value={query} onChange={setQuery} label="Cari pengguna" placeholder="Cari nama atau email…" />
          </div>
          <label>
            <span className="sr-only">Filter role</span>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
              <option value="all">Semua role</option>
              {ROLES.map((role) => <option key={role} value={role}>{role === 'admin' ? 'Admin' : role === 'pro' ? 'Pro' : 'User'}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter paket</span>
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
              <option value="all">Semua paket</option>
              {PLANS.map((plan) => <option key={plan} value={plan}>{plan[0].toUpperCase() + plan.slice(1)}</option>)}
            </select>
          </label>
          <button
            type="button"
            aria-pressed={inactive}
            onClick={() => setInactive(!inactive)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              inactive ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-border bg-background text-muted hover:text-foreground'
            }`}
          >
            Tanpa proyek
          </button>
          <ExportButton kind="users" />
        </div>
      }
    >
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <Notice>{notice}</Notice>}

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-blue-50 px-3 py-2">
          <p className="text-sm text-foreground">{selected.length} pengguna dipilih.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Bersihkan</Button>
            <Button size="sm" onClick={() => setBulkOpen(true)}>
              <SlidersHorizontal size={14} aria-hidden /> Ubah kredit massal
            </Button>
          </div>
        </div>
      )}

      <Card className="max-w-3xl">
        <h3 className="flex items-center gap-2 font-semibold text-foreground"><UserPlus size={16} aria-hidden /> Buat pengguna baru</h3>
        <p className="mt-1 text-sm text-muted">Akun langsung aktif dan mendapat saldo awal sesuai konfigurasi server.</p>
        <form onSubmit={submitCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-medium text-foreground">Nama</span>
            <input name="name" required className={inputClass} />
          </label>
          <label>
            <span className="text-sm font-medium text-foreground">Email</span>
            <input name="email" type="email" required className={inputClass} />
          </label>
          <label>
            <span className="text-sm font-medium text-foreground">Password</span>
            <input name="password" type="password" required minLength={8} className={inputClass} />
            <span className="mt-1 block text-[11px] text-slate-400">Minimal 8 karakter.</span>
          </label>
          <label>
            <span className="text-sm font-medium text-foreground">Role</span>
            <select name="role" defaultValue="user" className={inputClass}>
              {ROLES.map((role) => <option key={role} value={role}>{role === 'admin' ? 'Admin' : role === 'pro' ? 'Pro' : 'User'}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating}>{creating ? 'Membuat…' : 'Buat pengguna'}</Button>
          </div>
        </form>
      </Card>

      <TableShell minWidth="min-w-[960px]">
        <thead className="border-b border-border bg-background">
          <tr>
            <Th className="w-8">
              <input
                type="checkbox"
                aria-label="Pilih semua pengguna yang tampil"
                checked={rows.length > 0 && rows.every((user) => selected.includes(user.id))}
                onChange={toggleAll}
                className="h-3.5 w-3.5 rounded border-border"
              />
            </Th>
            <Th>Pengguna</Th>
            <Th>Role</Th>
            <Th>Paket</Th>
            <Th className="text-right">Kredit</Th>
            <Th className="text-right">Proyek</Th>
            <Th>Terdaftar</Th>
            <Th>Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((user) => (
            <tr key={user.id} className={`transition hover:bg-slate-50 ${busyId === user.id ? 'opacity-60' : ''}`}>
              <Td>
                <input
                  type="checkbox"
                  aria-label={`Pilih ${user.name}`}
                  checked={selected.includes(user.id)}
                  onChange={() => toggle(user.id)}
                  className="h-3.5 w-3.5 rounded border-border"
                />
              </Td>
              <Td>
                <p className="font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted">{user.email}</p>
              </Td>
              <Td>
                <label className="inline-flex items-center gap-2">
                  <span className="sr-only">{`Role ${user.name}`}</span>
                  <Pill tone={ROLE_TONE[user.role] ?? 'neutral'}>
                    <ShieldCheck size={11} aria-hidden className="mr-1" />
                    {user.role}
                  </Pill>
                  <select
                    value={user.role}
                    disabled={busyId === user.id}
                    onChange={(e) => run(user.id, () => api.adminUpdateRole(user.id, e.target.value))}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                  >
                    {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
              </Td>
              <Td>
                <label>
                  <span className="sr-only">{`Paket ${user.name}`}</span>
                  <select
                    value={user.plan}
                    disabled={busyId === user.id}
                    onChange={(e) => run(user.id, () => api.adminUpdatePlan(user.id, e.target.value))}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                  >
                    {PLANS.map((plan) => <option key={plan} value={plan}>{plan[0].toUpperCase() + plan.slice(1)}</option>)}
                  </select>
                </label>
              </Td>
              <Td className="text-right font-semibold tabular-nums">{user.balance.toLocaleString('id-ID')}</Td>
              <Td className="text-right tabular-nums text-muted">{user.projects_count}</Td>
              <Td className="whitespace-nowrap text-xs text-muted">{formatDate(user.created_at)}</Td>
              <Td>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" disabled={busyId === user.id} onClick={() => setGranting(user)}>
                    <Coins size={14} aria-hidden /> Tambah
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busyId === user.id} onClick={() => setAdjusting(user)}>
                    Koreksi
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <NoRows
              colSpan={8}
              label={filtered ? 'Tidak ada pengguna yang cocok dengan filter ini.' : 'Belum ada pengguna terdaftar.'}
            />
          )}
        </tbody>
      </TableShell>

      {!filtered && (users.data?.length ?? 0) > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Users size={13} aria-hidden /> Menampilkan seluruh {users.data?.length} akun.
        </p>
      )}

      {rows.length === 0 && filtered && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Search size={13} aria-hidden /> Kosongkan pencarian atau ubah filter untuk melihat akun lain.
        </p>
      )}

      <Modal open={granting !== null} onClose={() => setGranting(null)} labelledBy="grant-title">
        <form onSubmit={submitGrant} className="p-6">
          <h3 id="grant-title" className="font-semibold text-foreground">Tambah kredit</h3>
          <p className="mt-1 text-sm text-muted">
            Kredit ditambahkan ke <span className="font-medium text-foreground">{granting?.name}</span>. Saldo saat ini{' '}
            <span className="font-semibold tabular-nums text-foreground">{granting?.balance.toLocaleString('id-ID')}</span>.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-foreground">Jumlah</span>
              <input name="amount" type="number" min={1} max={100000} defaultValue={100} required data-autofocus className={inputClass} />
              <span className="mt-1 block text-[11px] text-slate-400">Antara 1 dan 100.000.</span>
            </label>
            <label>
              <span className="text-sm font-medium text-foreground">Keterangan</span>
              <input name="description" maxLength={255} placeholder="Grant admin" className={inputClass} />
              <span className="mt-1 block text-[11px] text-slate-400">Tersimpan di riwayat kredit pengguna.</span>
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setGranting(null)}>Batal</Button>
            <Button type="submit">Tambah kredit</Button>
          </div>
        </form>
      </Modal>

      {/* Koreksi saldo: amount boleh negatif, keterangan wajib. */}
      <Modal open={adjusting !== null} onClose={() => setAdjusting(null)} labelledBy="adjust-title">
        <form onSubmit={submitAdjust} className="p-6">
          <h3 id="adjust-title" className="font-semibold text-foreground">Koreksi saldo</h3>
          <p className="mt-1 text-sm text-muted">
            Menyesuaikan saldo <span className="font-medium text-foreground">{adjusting?.name}</span>. Saldo saat ini{' '}
            <span className="font-semibold tabular-nums text-foreground">{adjusting?.balance.toLocaleString('id-ID')}</span>.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-foreground">Perubahan</span>
              <input name="amount" type="number" min={-100000} max={100000} defaultValue={-10} required data-autofocus className={inputClass} />
              <span className="mt-1 block text-[11px] text-slate-400">Negatif mengurangi, positif menambah. Tidak boleh 0.</span>
            </label>
            <label>
              <span className="text-sm font-medium text-foreground">Alasan</span>
              <input name="description" required maxLength={255} placeholder="Mis. koreksi grant ganda" className={inputClass} />
              <span className="mt-1 block text-[11px] text-slate-400">Wajib, tersimpan di ledger dan jejak audit.</span>
            </label>
          </div>
          <Notice>Saldo tidak akan pernah menjadi negatif. Bila pengurangan melebihi saldo, permintaan ditolak.</Notice>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdjusting(null)}>Batal</Button>
            <Button type="submit">Simpan koreksi</Button>
          </div>
        </form>
      </Modal>

      {/* Aksi massal: satu nominal untuk pengguna terpilih. */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} labelledBy="bulk-title">
        <form onSubmit={submitBulk} className="p-6">
          <h3 id="bulk-title" className="font-semibold text-foreground">Ubah kredit massal</h3>
          <p className="mt-1 text-sm text-muted">
            Satu nominal diterapkan ke <span className="font-medium text-foreground">{selected.length} pengguna</span> terpilih.
            Setiap perubahan tetap tercatat satu per satu di jejak audit.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-foreground">Perubahan</span>
              <input name="amount" type="number" min={-100000} max={100000} defaultValue={100} required data-autofocus className={inputClass} />
              <span className="mt-1 block text-[11px] text-slate-400">Negatif mengurangi. Pengguna dengan saldo kurang akan dilewati.</span>
            </label>
            <label>
              <span className="text-sm font-medium text-foreground">Keterangan</span>
              <input name="description" required maxLength={255} placeholder="Mis. bonus bulanan" className={inputClass} />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setBulkOpen(false)} disabled={bulk.isPending}>Batal</Button>
            <Button type="submit" disabled={bulk.isPending}>
              {bulk.isPending ? 'Memproses…' : `Terapkan ke ${selected.length} pengguna`}
            </Button>
          </div>
        </form>
      </Modal>
    </AdminSection>
  )
}
