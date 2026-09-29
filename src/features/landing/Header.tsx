import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

// Every entry maps to a real anchor on this page (R-24). No placeholder routes.
const nav = [
  { label: 'Cara kerja', href: '#cara-kerja' },
  { label: 'Alur dokumen', href: '#tools' },
  { label: 'Paket', href: '#pricing' },
]

export function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
        scrolled ? 'border-border bg-background/90 backdrop-blur' : 'border-transparent bg-background'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground">
          <span className="grid h-7 w-7 place-items-center rounded-lg gradient-brand text-xs font-bold text-white">MD</span>
          MDGenerator
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-muted md:flex">
          {nav.map((item) => (
            <a key={item.label} href={item.href} className="transition hover:text-foreground">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/login" className="hidden text-sm font-medium text-muted transition hover:text-foreground sm:block">
            Masuk
          </Link>
          <Link
            to="/register"
            className="rounded-lg gradient-brand px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Coba gratis
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="rounded-lg p-2 text-muted hover:bg-slate-100 md:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-border bg-surface px-4 py-3 md:hidden">
          <ul className="space-y-1">
            {nav.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-sm text-muted transition hover:bg-slate-100 hover:text-foreground"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-3 text-sm font-medium text-primary transition hover:bg-slate-100"
              >
                Masuk ke workspace
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}