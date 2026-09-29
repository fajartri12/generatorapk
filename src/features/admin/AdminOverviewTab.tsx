import { useMemo } from 'react'
import { Activity, AlertTriangle, CalendarClock, Coins, FolderKanban, Receipt, ShieldCheck, Users } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { useAdminGenerations, useAdminPayments, useAdminProjects, useAdminStats, useAdminUsers } from '../../lib/hooks'
import { formatDateTime, generatorName } from '../../lib/documentMeta'
import { AdminSection, Notice, Pill, StatTile, statusLabel, statusTone } from './adminUi'

export function AdminOverviewTab({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const stats = useAdminStats()
  const users = useAdminUsers()
  const projects = useAdminProjects()
  const generations = useAdminGenerations()
  const payments = useAdminPayments()

  const userRows = users.data ?? []
  const all = generations.data ?? []

  const roleCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const user of userRows) map[user.role] = (map[user.role] ?? 0) + 1
    return map
  }, [userRows])

  const planCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const user of userRows) map[user.plan] = (map[user.plan] ?? 0) + 1
    return map
  }, [userRows])

  const recent = useMemo(
    () => [...all].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6),
    [all],
  )

  const errors = [stats.isError, users.isError, projects.isError, generations.isError].filter(Boolean).length

  // Semua angka di bawah berasal dari `stats()`, tidak dihitung ulang di klien
  // supaya definisi "hari ini" dan "7 hari" tetap satu sumber.
  const credits = stats.data?.credits_used
  const failures = stats.data?.failures
  const gateway = stats.data?.payments.gateway
  const trend = stats.data?.trend ?? []
  const scheduler = payments.data?.scheduler
  const expiring = payments.data?.expiring ?? stats.data?.expiring_soon ?? 0

  const peak = Math.max(1, ...trend.map((point) => point.generations))

  return (
    <AdminSection title="Ringkasan" description="Kondisi workspace secara keseluruhan, dihitung dari data yang dikirim server.">
      {errors > 0 && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Sebagian data administrator gagal dimuat. Statistik di bawah mungkin tidak lengkap.
        </p>
      )}

      {scheduler?.stale && (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <CalendarClock size={15} aria-hidden />
          Penjadwal pembayaran belum berjalan{scheduler.last_run_at ? ` sejak ${formatDateTime(scheduler.last_run_at)}` : ' sama sekali'}.
          Pesanan gateway kedaluwarsa bisa menahan kredit. Jalankan{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">php artisan schedule:work</code>.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={<Users size={18} />} label="Total pengguna" value={stats.data?.total_users ?? userRows.length} hint={`${roleCounts.admin ?? 0} admin`} />
        <StatTile icon={<FolderKanban size={18} />} label="Total proyek" value={stats.data?.total_projects ?? 0} hint={`${projects.data?.filter((p) => p.status === 'active').length ?? 0} aktif`} />
        <StatTile icon={<Activity size={18} />} label="Total generasi" value={stats.data?.total_generations ?? 0} hint={`${all.filter((g) => g.status === 'completed').length} selesai`} />
        <StatTile icon={<Coins size={18} />} label="Kredit terpakai" value={(stats.data?.total_credits_used ?? 0).toLocaleString('id-ID')} hint="sejak awal" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Coins size={18} />}
          label="Kredit hari ini"
          value={(credits?.today ?? 0).toLocaleString('id-ID')}
          hint={`7 hari ${(credits?.['7d'] ?? 0).toLocaleString('id-ID')} · 30 hari ${(credits?.['30d'] ?? 0).toLocaleString('id-ID')}`}
        />
        <StatTile
          icon={<AlertTriangle size={18} />}
          label="Generasi gagal"
          value={failures?.last_7d ?? 0}
          hint={`${failures?.total ?? 0} sepanjang waktu`}
        />
        <StatTile
          icon={<Receipt size={18} />}
          label="Pesanan gateway"
          value={gateway?.pending ?? 0}
          hint={`${gateway?.paid ?? 0} lunas · ${gateway?.expired ?? 0} kedaluwarsa`}
        />
        <StatTile
          icon={<CalendarClock size={18} />}
          label="Menunggu kedaluwarsa"
          value={expiring}
          hint={expiring > 0 ? 'perlu ditinjau admin' : 'tidak ada tunggakan'}
        />
      </div>

      {(failures?.by_provider.length ?? 0) > 0 && (
        <Notice>
          Kegagalan 7 hari terakhir per penyedia:{' '}
          {failures?.by_provider.map((entry) => `${entry.provider} (${entry.total})`).join(', ')}.
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck size={16} aria-hidden className="text-primary" /> Distribusi role
          </h3>
          <ul className="mt-3 space-y-2">
            {['user', 'pro', 'admin'].map((role) => (
              <li key={role} className="flex items-center justify-between gap-3 text-sm">
                <Pill tone={role === 'admin' ? 'danger' : role === 'pro' ? 'primary' : 'neutral'}>{role}</Pill>
                <span className="tabular-nums text-muted">{roleCounts[role] ?? 0} pengguna</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onOpenTab('users')}
            className="mt-4 text-sm font-medium text-primary transition hover:text-primary-dark"
          >
            Kelola pengguna →
          </button>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-foreground">Distribusi paket</h3>
          <ul className="mt-3 space-y-2">
            {['free', 'pro'].map((plan) => (
              <li key={plan} className="flex items-center justify-between gap-3 text-sm">
                <Pill tone={plan === 'free' ? 'neutral' : 'success'}>
                  {plan[0].toUpperCase() + plan.slice(1)}
                </Pill>
                <span className="tabular-nums text-muted">{planCounts[plan] ?? 0} pengguna</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-400">Paket hanya bisa diubah admin, tidak ada pembelian mandiri.</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Aktivitas 14 hari</h3>
          <p className="text-xs text-muted">Batang: jumlah generasi. Angka di atas batang: kredit terpakai.</p>
        </div>
        {trend.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Belum ada data tren.</p>
        ) : (
          <div className="mt-4 flex items-end gap-1.5 overflow-x-auto" role="img" aria-label="Grafik aktivitas 14 hari terakhir">
            {trend.map((point) => {
              const height = Math.max(4, Math.round((point.generations / peak) * 96))
              return (
                <div key={point.date} className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-muted">{point.generations}</span>
                  <div
                    className={`w-full rounded-t ${point.credits > 0 ? 'bg-primary' : 'bg-slate-200'}`}
                    style={{ height }}
                    title={`${point.date}: ${point.generations} generasi, ${point.credits} kredit`}
                  />
                  <span className="text-[10px] tabular-nums text-slate-400">{point.date.slice(8)}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Generasi terbaru</h3>
          <button type="button" onClick={() => onOpenTab('generations')} className="text-sm font-medium text-primary transition hover:text-primary-dark">
            Lihat semua →
          </button>
        </div>
        <ul>
          {recent.map((generation) => (
            <li key={generation.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{generatorName(generation.document_type) ?? generation.document_type}</p>
                <p className="text-xs text-muted">{generation.user?.name ?? 'Pengguna dihapus'} · {formatDateTime(generation.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Pill tone={statusTone(generation.status)}>
                  {statusLabel[generation.status] ?? generation.status}
                </Pill>
                <span className="w-16 text-right text-xs tabular-nums text-muted">
                  {generation.status === 'completed' ? `${generation.credits_used} kredit` : '—'}
                </span>
              </div>
            </li>
          ))}
          {recent.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">Belum ada aktivitas generasi.</li>}
        </ul>
      </Card>
    </AdminSection>
  )
}
