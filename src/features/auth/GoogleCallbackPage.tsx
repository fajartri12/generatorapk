import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '../../lib/auth'

/**
 * Landing page for the OAuth callback. The backend hands over a one-time code
 * in the query string; we trade it for a bearer token and continue to the app.
 * Lives at a path distinct from /auth/google/callback so the PHP route that
 * starts the Google handshake never intercepts it.
 */
export function GoogleCallbackPage() {
  const { completeGoogleLogin } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const started = useRef(false)

  useEffect(() => {
    // React 18 StrictMode runs effects twice in dev; the code is single-use.
    if (started.current) return
    started.current = true

    if (!code) {
      navigate('/login?google=error', { replace: true })
      return
    }

    completeGoogleLogin(code)
      .then(() => navigate('/app', { replace: true }))
      .catch(() => navigate('/login?google=error', { replace: true }))
  }, [code, completeGoogleLogin, navigate])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
      <AlertCircle className="h-6 w-6 animate-pulse text-muted" aria-hidden />
      <p className="text-sm text-muted">Menyelesaikan masuk dengan Google…</p>
    </main>
  )
}
