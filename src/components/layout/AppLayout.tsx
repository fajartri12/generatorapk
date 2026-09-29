import { useEffect, useRef, useState, type FormEvent } from 'react'
import { NavLink, Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Menu, X, LayoutDashboard, FolderKanban, FileText, LayoutTemplate, History, CreditCard, Settings, Search, LogOut, ShieldCheck, Coins, Command, User, Sparkles, ChevronRight, Banknote, Bell, CheckCheck } from 'lucide-react'
import { useCredits, useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../lib/hooks'
import type { ApiNotification } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { ADMIN_NAV, adminPath } from '../../features/admin/adminNav'

const workspace = [{ label: 'Ringkasan', to: '/app', icon: LayoutDashboard, end: true }, { label: 'Proyek', to: '/app/projects', icon: FolderKanban }, { label: 'Dokumen', to: '/app/documents', icon: FileText }, { label: 'Template', to: '/app/templates', icon: LayoutTemplate }, { label: 'Riwayat', to: '/app/history', icon: History }]
const toolGroups = [{ label: 'Produk', to: '/app/tools/product' }, { label: 'Teknis', to: '/app/tools/engineering' }, { label: 'Desain', to: '/app/tools/design' }, { label: 'Pengembangan', to: '/app/tools/development' }]

/** Breadcrumb label per top-level route segment, so the navbar can name the current page. */
const PAGE_TITLE: Record<string, string> = {
  '': 'Ringkasan',
  projects: 'Proyek',
  documents: 'Dokumen',
  templates: 'Template',
  history: 'Riwayat',
  billing: 'Tagihan',
  payments: 'Beli Kredit',
  settings: 'Pengaturan',
  manajemen: 'Manajemen',
  tools: 'Alat AI',
}

type NavItem = { label: string; to: string; icon: typeof LayoutDashboard; end?: boolean }

/** Sidebar for the administrator area: only admin sections, nothing from the user workspace. */
const adminNavLinks: NavItem[] = ADMIN_NAV.map((item) => ({ label: item.label, to: adminPath(item.id), icon: item.icon, end: item.id === 'overview' }))

function NavSection({ title, links }: { title: string; links: NavItem[] }) {
  return <div className="mt-5"><p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p><ul className="mt-1.5 space-y-0.5">{links.map(({ label, to, icon: Icon, end }) => <li key={to}><NavLink to={to} end={end} className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-blue-50 font-medium text-primary-dark' : 'text-slate-600 hover:bg-slate-100 hover:text-foreground'}`}><Icon size={17} aria-hidden />{label}</NavLink></li>)}</ul></div>
}

/** Relative time in Bahasa Indonesia, for the inbox list. */
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const items: ApiNotification[] = data?.data ?? []
  const unread = data?.unread ?? 0

  // Klik di luar atau Escape menutup inbox.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
        aria-expanded={open}
        className="relative rounded-xl border border-border bg-surface p-2 text-slate-500 transition hover:bg-slate-50 hover:text-foreground"
      >
        <Bell size={17} aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl animate-[md-pop_150ms_ease-out]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notifikasi</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:opacity-80"
              >
                <CheckCheck size={13} aria-hidden />Tandai dibaca
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Belum ada notifikasi.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((item) => {
                const content = (
                  <>
                    <p className={`text-sm leading-snug ${item.read_at ? 'text-slate-600' : 'font-semibold text-foreground'}`}>{item.data.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.data.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{timeAgo(item.created_at)}</p>
                  </>
                )
                const className = `block w-full border-b border-border/60 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50 ${item.read_at ? '' : 'bg-primary/5'}`

                return item.data.url ? (
                  <li key={item.id}>
                    <Link to={item.data.url} onClick={() => { setOpen(false); if (!item.read_at) markRead.mutate(item.id) }} className={className}>
                      {content}
                    </Link>
                  </li>
                ) : (
                  <li key={item.id}>
                    <button type="button" onClick={() => { if (!item.read_at) markRead.mutate(item.id) }} className={className}>
                      {content}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { data: credits } = useCredits()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const system = user?.role === 'admin'
    ? [{ label: 'Beli Kredit', to: '/app/payments', icon: Banknote }, { label: 'Tagihan', to: '/app/billing', icon: CreditCard }, { label: 'Pengaturan', to: '/app/settings', icon: Settings }, { label: 'Panel Admin', to: '/app/manajemen', icon: ShieldCheck }]
    : [{ label: 'Beli Kredit', to: '/app/payments', icon: Banknote }, { label: 'Tagihan', to: '/app/billing', icon: CreditCard }, { label: 'Pengaturan', to: '/app/settings', icon: Settings }]
  const [query, setQuery] = useState('')
  const [searchParams] = useSearchParams()
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  // The navbar search mirrors the Proyek page query, so it always shows what is filtered.
  useEffect(() => {
    if (pathname.startsWith('/app/projects')) setQuery(searchParams.get('q') ?? '')
  }, [pathname, searchParams])

  // Klik di luar atau Escape menutup menu akun.
  useEffect(() => {
    if (!accountOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen])

  const pageKey = pathname.replace(/^\/app\/?/, '').split('/')[0]
  const pageTitle = PAGE_TITLE[pageKey] ?? 'Ruang kerja'
  const initials = user?.name?.slice(0, 2).toUpperCase() ?? '??'
  const plan = credits?.plan ?? 'free'

  // Inside the management area an admin gets a dedicated shell: admin menu only, no workspace nav/CTAs.
  const inAdmin = user?.role === 'admin' && pageKey === 'manajemen'

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    const q = query.trim()
    if (!q) return
    navigate(`/app/projects?q=${encodeURIComponent(q)}`)
  }

  async function signOut() {
    setAccountOpen(false)
    await logout()
    navigate('/login')
  }

  const logo = <Link to={inAdmin ? '/app/manajemen' : '/'} className="flex items-center gap-2 px-3 pb-5 text-[17px] font-bold tracking-tight text-foreground"><span className="grid h-7 w-7 place-items-center rounded-lg gradient-brand text-xs font-bold text-white">{inAdmin ? 'AD' : 'MD'}</span>{inAdmin ? 'Panel Admin' : 'MDGenerator'}</Link>

  const sidebar = inAdmin
    ? <div className="flex h-full flex-col overflow-y-auto px-3 py-5">{logo}<NavSection title="Menu admin" links={adminNavLinks} /><p className="mt-4 px-3 text-[11px] leading-relaxed text-slate-400">Perubahan di sini langsung berlaku untuk semua pengguna dan tercatat di server.</p><Link to="/app" className="mt-auto flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-foreground"><LayoutDashboard size={17} aria-hidden />Buka workspace</Link><button onClick={signOut} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-slate-100 hover:text-foreground"><LogOut size={17} aria-hidden />Keluar</button></div>
    : <div className="flex h-full flex-col overflow-y-auto px-3 py-5">{logo}<NavSection title="Ruang kerja" links={workspace} /><div className="mt-5"><p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Alat AI</p><ul className="mt-1.5 space-y-0.5">{toolGroups.map((group) => <li key={group.to}><Link to={group.to} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-foreground"><span className="h-1.5 w-1.5 rounded-full gradient-brand" aria-hidden />{group.label}</Link></li>)}</ul></div><NavSection title="Sistem" links={system} /><button onClick={signOut} className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-slate-100 hover:text-foreground"><LogOut size={17} aria-hidden />Keluar</button></div>
  return <div className="min-h-screen bg-background"><a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm">Lewati ke konten</a><aside className="fixed inset-y-0 left-0 hidden w-[260px] border-r border-border bg-surface lg:block">{sidebar}</aside>{menuOpen && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} aria-hidden /><div className="absolute inset-y-0 left-0 w-[270px] bg-surface shadow-xl"><button onClick={() => setMenuOpen(false)} aria-label="Tutup navigasi" className="absolute right-3 top-4 rounded-lg p-1.5 text-muted hover:bg-slate-100"><X size={18} /></button>{sidebar}</div></div>}<div className="lg:pl-[260px]">

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 md:px-6">
          <button onClick={() => setMenuOpen(true)} aria-label="Buka navigasi" className="rounded-lg p-2 text-muted transition hover:bg-slate-100 lg:hidden"><Menu size={20} /></button>

          {/* The current page, so the bar always answers "where am I?" */}
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="hidden h-5 w-1 rounded-full gradient-brand sm:block" />
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">{pageTitle}</span>
          </div>

          <form onSubmit={submitSearch} className={`relative ml-auto max-w-sm flex-1 ${inAdmin ? 'hidden' : 'hidden md:block'}`} role="search">
            <label className="sr-only" htmlFor="global-search">Cari proyek</label>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="global-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setQuery('') }}
              placeholder="Cari proyek…"
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-14 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
            />
            <kbd aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-surface px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400 lg:flex">
              <Command size={10} />K
            </kbd>
          </form>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {/* A bell earns its place now: it shows real inbox data and marks rows read. */}
            {user && <NotificationBell />}

            {/* Credits and the generator CTA are workspace affordances; the admin shell has neither. */}
            {!inAdmin && (
              <>
                <Link
                  to="/app/billing"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-sm font-semibold text-foreground transition hover:border-warning/40 hover:bg-warning/5"
                >
                  <Coins size={15} aria-hidden className="text-warning" />
                  <span className="tabular-nums">{(credits?.balance ?? 0).toLocaleString('id-ID')}</span>
                  <span className="sr-only">kredit tersisa</span>
                  <span aria-hidden className="hidden text-xs font-medium text-muted sm:inline">kredit</span>
                </Link>

                <Link
                  to="/app/tools/product"
                  className="hidden items-center gap-1.5 rounded-xl gradient-brand px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 sm:inline-flex"
                >
                  <Sparkles size={15} aria-hidden />
                  <span className="hidden lg:inline">Buat dokumen</span>
                </Link>
              </>
            )}

            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setAccountOpen((open) => !open)
                }}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                className="flex items-center gap-2 rounded-xl border border-border bg-surface py-1 pl-1 pr-2 transition hover:bg-slate-50"
              >
                <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-[11px] font-semibold text-white">{initials}</span>
                <span className="hidden max-w-[9rem] truncate text-sm font-medium text-foreground sm:block">{user?.name ?? 'Akun'}</span>
                <ChevronRight size={14} aria-hidden className={`hidden text-slate-400 transition-transform sm:block ${accountOpen ? 'rotate-90' : ''}`} />
              </button>

              {accountOpen && (
                <div role="menu" aria-label="Menu akun" className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl animate-[md-pop_150ms_ease-out]">
                  <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
                    <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-brand text-sm font-semibold text-white">{initials}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{user?.name ?? 'Akun'}</p>
                      <p className="truncate text-xs text-muted">{user?.email ?? ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <span className="text-xs text-muted">Kredit tersisa</span>
                    <Link to="/app/billing" onClick={() => setAccountOpen(false)} className="inline-flex items-center gap-1.5 rounded-lg bg-warning/10 px-2 py-1 text-xs font-semibold text-warning transition hover:bg-warning/20">
                      <Coins size={12} aria-hidden />
                      <span className="tabular-nums">{(credits?.balance ?? 0).toLocaleString('id-ID')}</span>
                    </Link>
                  </div>
                  <p className="border-t border-border px-4 py-2 text-[11px] uppercase tracking-wide text-slate-400">{inAdmin ? 'Administrator' : `Paket ${plan}`}</p>
                  <div className="border-t border-border p-1.5">
                    {inAdmin ? (
                      <Link to="/app" role="menuitem" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-foreground">
                        <LayoutDashboard size={16} aria-hidden />Buka workspace
                      </Link>
                    ) : (
                      <>
                        <Link to="/app/settings" role="menuitem" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-foreground">
                          <User size={16} aria-hidden />Pengaturan akun
                        </Link>
                        {user?.role === 'admin' && (
                          <Link to="/app/manajemen" role="menuitem" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-foreground">
                            <ShieldCheck size={16} aria-hidden />Panel admin
                          </Link>
                        )}
                      </>
                    )}
                    <button type="button" role="menuitem" onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger transition hover:bg-danger/5">
                      <LogOut size={16} aria-hidden />Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 md:py-8"><Outlet /></main></div></div>
}
