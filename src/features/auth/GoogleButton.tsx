import { useEffect, useState } from 'react'
import { API_BASE, googleStatus } from '../../lib/api'

/**
 * Google's four-colour "G" as inline SVG — no icon package needed, and the
 * mark must be exact for Google's branding rules anyway.
 */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86a5.4 5.4 0 0 1-5.06-3.7H.94v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.94 10.72a5.41 5.41 0 0 1 0-3.44V4.94H.94a9 9 0 0 0 0 8.12l3-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .94 4.94l3 2.34A5.4 5.4 0 0 1 9 3.58Z"
      />
    </svg>
  )
}

type Props = { label: string }

/**
 * "Masuk dengan Google". Renders nothing at all until the backend reports the
 * OAuth client as configured, so a deployment without credentials never shows
 * a button that leads to a 404.
 */
export function GoogleButton({ label }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    googleStatus()
      .then((res) => { if (alive) setEnabled(res.enabled) })
      .catch(() => { if (alive) setEnabled(false) })
    return () => { alive = false }
  }, [])

  if (enabled === null || enabled === false) return null

  return (
    <>
      <a
        href={`${API_BASE}/auth/google/redirect`}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-slate-50"
      >
        <GoogleMark />
        {label}
      </a>
      <p className="flex items-center gap-3 text-xs text-muted">
        <span aria-hidden className="h-px flex-1 bg-border" />
        atau
        <span aria-hidden className="h-px flex-1 bg-border" />
      </p>
    </>
  )
}
