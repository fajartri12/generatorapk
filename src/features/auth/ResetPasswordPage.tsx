import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react'
import { resetPassword, ApiError } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { AuthBadge, AuthShell, authFieldClass, authLabelClass } from './AuthShell'

/**
 * Tautan email dari backend menunjuk ke /reset-password/{token}?email=… pada
 * origin yang sama, dan shell SPA dilayani rute fallback Laravel. Token dibaca
 * dari URL, bukan dari hidden input Blade.
 */
export function ResetPasswordPage() {
  const { token: routeToken } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const token = routeToken ?? ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // The reset link carries ?email=..., which saves retyping it.
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('email')
    if (fromLink) setEmail(fromLink)
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (password !== confirmation) {
      setError('Konfirmasi password tidak sama.')
      return
    }

    setSubmitting(true)
    try {
      await resetPassword({ token, email, password, password_confirmation: confirmation })
      navigate('/login?reset=ok', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak dapat terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  const missingToken = !token

  return (
    <AuthShell showPipeline={false}>
      <AuthBadge icon={<KeyRound size={13} />}>Password baru</AuthBadge>

      <h1 className="mt-4 text-2xl font-bold text-foreground">Buat password baru</h1>
      <p className="mt-1.5 text-sm text-muted">
        Setelah tersimpan, semua sesi lama akan keluar dan Anda bisa masuk dengan password baru.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className={authLabelClass}>
          Email
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@perusahaan.com"
            className={authFieldClass}
          />
        </label>

        <div>
          <label className={authLabelClass} htmlFor="new-password">
            Password baru
          </label>
          <span className="relative mt-1.5 block">
            <input
              required
              minLength={8}
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className={`${authFieldClass} mt-0 pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted transition hover:bg-slate-100 hover:text-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </div>

        <label className={authLabelClass}>
          Ulangi password baru
          <input
            required
            minLength={8}
            type={showPassword ? 'text' : 'password'}
            name="password_confirmation"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="Ketik ulang password baru"
            className={authFieldClass}
          />
        </label>

        {(error || missingToken) && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>
              {error || 'Tautan ini tidak lengkap. Minta tautan baru dari halaman lupa password.'}
            </span>
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting || missingToken}>
          {submitting ? 'Menyimpan…' : 'Simpan password baru'}
          {!submitting && <ArrowRight size={16} />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link className="font-medium text-primary hover:text-primary-dark" to="/forgot-password">
          Minta tautan baru
        </Link>
      </p>
    </AuthShell>
  )
}
