import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

/**
 * The dashboard is a user-workspace page. An administrator has no workspace of their own
 * here, so `/app` sends them straight to the management panel. The `to` prop can override
 * the target for a child route that wants the same guard.
 */
export function RequireUser({ children, to = '/app/manajemen' }: { children: ReactNode; to?: string }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted">Memuat…</div>
  if (user?.role === 'admin') return <Navigate to={to} replace />
  return <>{children}</>
}
