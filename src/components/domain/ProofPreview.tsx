import { useEffect, useState } from 'react'
import { FileText, Loader2, Paperclip } from 'lucide-react'
import { fetchPaymentProofUrl, type ApiPayment } from '../../lib/api'
/**
 * Shows the uploaded receipt. The file sits behind an authorised endpoint, so it
 * is fetched as a blob and displayed from an object URL — which this component
 * revokes on unmount so a long session does not leak memory.
 *
 * `admin` switches to the review route, which serves any order to an admin.
 */
export function ProofPreview({
  payment,
  admin = false,
  className = '',
}: {
  payment: ApiPayment
  admin?: boolean
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let revoked = false
    let objectUrl: string | null = null

    setLoading(true)
    setError(null)

    fetchPaymentProofUrl(payment.id, admin)
      .then((next) => {
        objectUrl = next
        // The preview may have unmounted while the request was in flight.
        if (revoked) URL.revokeObjectURL(next)
        else setUrl(next)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))

    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [payment.id, admin])

  if (loading) {
    return (
      <p className={`flex items-center gap-2 text-xs text-muted ${className}`}>
        <Loader2 size={13} className="animate-spin" /> Memuat bukti…
      </p>
    )
  }

  if (error || !url) {
    return (
      <p className={`flex items-center gap-2 text-xs text-muted ${className}`}>
        <Paperclip size={13} /> Bukti tidak dapat ditampilkan.
      </p>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <img
        src={url}
        alt={`Bukti transfer ${payment.code}`}
        className="max-h-64 w-full rounded-lg border border-border bg-background object-contain"
      />
      <a
        href={url}
        download={`bukti-${payment.code}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <FileText size={13} aria-hidden /> Unduh bukti
      </a>
    </div>
  )
}
