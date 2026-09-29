import { useLocation, useNavigate } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'

export function PlaceholderPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const label = pathname.replace('/app/', '').replace(/[-/]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{label || 'Workspace'}</h1>
        <p className="mt-1 text-muted">Halaman ini belum dibangun.</p>
      </div>
      <EmptyState
        title="Belum ada di sini"
        body={`Halaman "${label}" memang belum dibuat. Yang sudah bisa dipakai: ringkasan, proyek, dokumen, template, dan riwayat.`}
        actionLabel="Buka ringkasan"
        onAction={() => navigate('/app')}
      />
      <p className="flex items-center gap-2 text-xs text-muted">
        <Construction size={13} aria-hidden />
        Rute yang diminta: <code className="rounded bg-slate-100 px-1.5 py-0.5">{pathname}</code>
      </p>
    </div>
  )
}
