import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ApiError, downloadCsv } from '../../lib/api'

type Kind = 'users' | 'generations' | 'payments' | 'audit-logs'

/** Nama berkas default, mengikuti tanggal unduhan. */
const FILENAMES: Record<Kind, string> = {
  users: 'pengguna',
  generations: 'generasi',
  payments: 'pembayaran',
  'audit-logs': 'jejak-audit',
}

/**
 * Ekspor CSV. Server mengirim BOM UTF-8 supaya Excel di Windows tidak
 * menampilkan karakter aneh pada nama pengguna.
 */
export function ExportButton({ kind, label = 'Ekspor CSV' }: { kind: Kind; label?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setBusy(true)
    setError('')
    try {
      await downloadCsv(`/api/admin/export/${kind}`, `${FILENAMES[kind]}-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ekspor gagal diunduh.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" onClick={run} disabled={busy}>
        <Download size={14} aria-hidden /> {busy ? 'Menyiapkan…' : label}
      </Button>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </div>
  )
}
