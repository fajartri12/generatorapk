import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg gradient-brand text-xs font-bold text-white">MD</span>
          <span className="font-semibold text-foreground">MDGenerator</span>
        </div>
        <p className="text-sm text-muted">Dari ide menjadi siap bangun.</p>
        <nav aria-label="Footer" className="flex gap-5 text-sm text-muted">
          <a href="#cara-kerja" className="transition hover:text-foreground">Cara kerja</a>
          <a href="#tools" className="transition hover:text-foreground">Alur dokumen</a>
          <a href="#pricing" className="transition hover:text-foreground">Paket</a>
          <Link to="/login" className="transition hover:text-foreground">Masuk</Link>
        </nav>
      </div>
    </footer>
  )
}