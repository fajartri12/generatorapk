import { Activity, CreditCard, FolderKanban, LayoutDashboard, Landmark, ScrollText, SlidersHorizontal, Users, Wallet } from 'lucide-react'
import type { AdminTab } from './adminTabs'

export type AdminNavItem = {
  id: AdminTab
  label: string
  desc: string
  icon: typeof LayoutDashboard
  /** `full` fills the content column; `wide` keeps it readable for text-heavy tables. */
  width: 'full' | 'wide'
}

/** Single source of truth for the admin sections: sidebar links and the content switch. */
export const ADMIN_NAV: AdminNavItem[] = [
  {
    id: 'overview',
    label: 'Ringkasan',
    desc: 'Kondisi workspace secara keseluruhan.',
    icon: LayoutDashboard,
    width: 'full',
  },
  {
    id: 'users',
    label: 'Pengguna',
    desc: 'Ubah role, paket, dan saldo kredit setiap pengguna.',
    icon: Users,
    width: 'full',
  },
  {
    id: 'projects',
    label: 'Proyek',
    desc: 'Tinjau dan hapus proyek beserta dokumen serta riwayat generasinya.',
    icon: FolderKanban,
    width: 'full',
  },
  {
    id: 'generations',
    label: 'Generasi',
    desc: 'Riwayat setiap proses generate beserta kredit yang terpakai.',
    icon: Activity,
    width: 'full',
  },
  {
    id: 'payments',
    label: 'Pembayaran',
    desc: 'Verifikasi transfer manual sebelum kredit ditambahkan ke pengguna.',
    icon: CreditCard,
    width: 'full',
  },
  {
    id: 'gateway',
    label: 'Pesanan Gateway',
    desc: 'Pesanan Pakasir yang tidak masuk antrean verifikasi manual.',
    icon: Wallet,
    width: 'full',
  },
  {
    id: 'costs',
    label: 'Biaya Kredit',
    desc: 'Nilai ini dipakai server saat menghitung biaya generasi.',
    icon: SlidersHorizontal,
    width: 'wide',
  },
  {
    id: 'bank',
    label: 'Rekening',
    desc: 'Rekening tujuan transfer manual yang dilihat pengguna saat membeli kredit.',
    icon: Landmark,
    width: 'wide',
  },
  {
    id: 'audit',
    label: 'Jejak Audit',
    desc: 'Siapa mengubah apa, kapan, dan dari nilai berapa. Catatan ini tidak dapat diubah.',
    icon: ScrollText,
    width: 'full',
  },
]

/** Route path for a management section, relative to the `/app` shell. */
export function adminPath(tab: AdminTab) {
  return tab === 'overview' ? '/app/manajemen' : `/app/manajemen/${tab}`
}

export const DEFAULT_ADMIN_TAB: AdminTab = 'overview'
