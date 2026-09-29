import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, FileText, Layers, Sparkles } from 'lucide-react'
import { ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { creditCosts } from '../../data/pricing'
import { Button } from '../../components/ui/Button'
import { GoogleButton } from './GoogleButton'
import { DOC_STAGE_ORDER, docMeta } from '../../lib/documentMeta'

// The nine stages the product actually generates, taken from the shared
// pipeline order so this page cannot drift from the product.
const STAGES = DOC_STAGE_ORDER.map((type) => ({ type, ...docMeta(type) }))

const BENEFITS = [
  'Sembilan tahap berurutan, dari brief sampai AGENTS.md.',
  'Setiap generator membaca konteks proyek dan dokumen sebelumnya.',
  'Semua draf bisa diedit, diberi versi, dan diunduh sebagai Markdown.',
]

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // The OAuth callback redirects here with ?google=<reason> when it fails, and
  // the reset page redirects here with ?reset=ok when it succeeds.
  useEffect(() => {
    const reason = searchParams.get('google')
    const reset = searchParams.get('reset')
    if (!reason && !reset) return

    if (reset === 'ok') {
      setEmail('')
      setPassword('')
      setNotice('Password Anda sudah diganti. Silakan masuk dengan password baru.')
    }

    if (reason) {
      setError(
        reason === 'no-email'
          ? 'Akun Google itu tidak membagikan alamat email. Pakai pendaftaran biasa.'
          : 'Gagal masuk dengan Google. Coba lagi atau pakai email dan password.',
      )
    }

    const next = new URLSearchParams(searchParams)
    next.delete('google')
    next.delete('reset')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      if (isRegister) await register({ name, email, password, password_confirmation: password })
      else await login(email, password)
      navigate((location.state as { from?: string } | null)?.from ?? '/app', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak dapat terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  const fieldClass =
    'mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10'
  const labelClass = 'block text-sm font-medium text-foreground'

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      {/* Decorative wash. Kept out of the layout flow so it cannot affect the form. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <Link to="/" className="relative mb-8 inline-flex items-center gap-2.5 text-lg font-bold text-foreground">
        <span className="grid h-9 w-9 place-items-center rounded-xl gradient-brand text-xs font-bold text-white">
          MD
        </span>
        MDGenerator
      </Link>

      <section className="relative w-full max-w-md">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <FileText size={13} />
            {isRegister ? 'Akun baru' : 'Selamat datang kembali'}
          </span>
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            {isRegister ? 'Buat akun Anda' : 'Masuk ke workspace'}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {isRegister
              ? `Gratis untuk mulai. Anda langsung mendapat ${creditCosts.freePlanCredits} kredit untuk mencoba semua generator.`
              : 'Lanjutkan pekerjaan dokumentasi proyek Anda.'}
          </p>

          <div className="mt-6 space-y-4">
            <GoogleButton label={isRegister ? 'Daftar dengan Google' : 'Masuk dengan Google'} />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {isRegister && (
              <label className={labelClass}>
                Nama
                <input
                  required
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama lengkap Anda"
                  className={fieldClass}
                />
              </label>
            )}

            <label className={labelClass}>
              Email
              <input
                required
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com"
                className={fieldClass}
              />
            </label>

            <div>
              <label className={labelClass} htmlFor="password">
                Password
              </label>
              <span className="relative mt-1.5 block">
                <input
                  required
                  minLength={8}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? 'Minimal 8 karakter' : 'Password Anda'}
                  className={`${fieldClass} mt-0 pr-11`}
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

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            {notice && (
              <p role="status" className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
                <Check size={16} className="mt-0.5 shrink-0" />
                <span>{notice}</span>
              </p>
            )}

            {!isRegister && (
              <p className="text-right">
                <Link className="text-sm font-medium text-primary hover:text-primary-dark" to="/forgot-password">
                  Lupa password?
                </Link>
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Memproses…' : isRegister ? 'Buat akun' : 'Masuk'}
              {!submitting && <ArrowRight size={16} />}
            </Button>
          </form>

          {isRegister && (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-background px-3 py-2.5 text-xs text-muted">
              <Layers size={14} className="mt-0.5 shrink-0 text-primary" />
              Setiap akun baru mendapat {creditCosts.freePlanCredits} kredit untuk mencoba seluruh generator dokumen.
            </p>
          )}

          <p className="mt-6 text-center text-sm text-muted">
            {isRegister ? 'Sudah punya akun? ' : 'Belum punya akun? '}
            <Link className="font-medium text-primary hover:text-primary-dark" to={isRegister ? '/login' : '/register'}>
              {isRegister ? 'Masuk' : 'Daftar gratis'}
            </Link>
          </p>
        </div>
      </section>

      {/* The pipeline strip that used to fill the split-screen panel, kept as a
          single wrapping row so the promise stays visible without a second column. */}
      <section className="relative mt-10 w-full max-w-2xl text-center">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
          <Sparkles size={13} className="text-primary" />
          Sembilan tahap pipeline, satu konteks proyek
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
          {STAGES.map((stage, index) => (
            <li
              key={stage.type}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-1.5 pr-2.5 text-[11px] text-muted"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-background text-[9px] font-semibold text-foreground">
                {index + 1}
              </span>
              {stage.category}
            </li>
          ))}
        </ul>
        <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {BENEFITS.map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-muted">
              <Check size={13} className="shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

