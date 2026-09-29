export const ADMIN_TABS = [
  { id: 'overview', label: 'Ringkasan' },
  { id: 'users', label: 'Pengguna' },
  { id: 'projects', label: 'Proyek' },
  { id: 'generations', label: 'Generasi' },
  { id: 'payments', label: 'Pembayaran' },
  { id: 'gateway', label: 'Pesanan Gateway' },
  { id: 'costs', label: 'Biaya Kredit' },
  { id: 'bank', label: 'Rekening' },
  { id: 'audit', label: 'Jejak Audit' },
] as const

export type AdminTab = (typeof ADMIN_TABS)[number]['id']
