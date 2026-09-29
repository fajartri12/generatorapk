import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, CheckCircle2, MailQuestion } from 'lucide-react'
import { forgotPassword, ApiError } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { AuthBadge, AuthShell, authFieldClass, authLabelClass } from './AuthShell'

/** Asks for the address, then always shows the same neutral confirmation. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await forgotPassword({ email })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak dapat terhubung ke server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <AuthBadge icon={<MailQuestion size={13} />}>Lupa password</AuthBadge>

      {sent ? (
        <>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Periksa email Anda</h1>
          <p className="mt-1.5 text-sm text-muted">
            Kalau <span className="font-medium text-foreground">{email}</span> terdaftar, kami sudah mengirim tautan
            untuk mengatur ulang password. Tautan berlaku 60 menit.
          </p>
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-background px-3 py-2.5 text-xs text-muted">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary" />
            Tidak menerima email? Periksa folder spam, atau kirim ulang tautannya.
          </p>
          <Button variant="secondary" className="mt-4 w-full" onClick={() => setSent(false)}>
            Kirim ulang tautan
          </Button>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Atur ulang password</h1>
          <p className="mt-1.5 text-sm text-muted">
            Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat password baru.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className={authLabelClass}>
              Email
              <input
                required
                type="email"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com"
                className={authFieldClass}
              />
            </label>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Mengirim…' : 'Kirim tautan'}
              {!submitting && <ArrowRight size={16} />}
            </Button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Ingat password Anda?{' '}
        <Link className="font-medium text-primary hover:text-primary-dark" to="/login">
          Kembali masuk
        </Link>
      </p>
    </AuthShell>
  )
}
