/*
 * Credit costs and the two plans.
 *
 * The cost table mirrors `config/md-generator.php`, which is the source of
 * truth. There is no subscription: Pro is bought once and its credits never
 * expire. The buy button posts `plan.packageKey` to /api/payments.
 */

export const creditCosts = {
  freePlanCredits: 50,
  /** Cheapest and most expensive entry in config('md-generator.costs'). */
  minPerDocument: 3,
  maxPerDocument: 6,
}

/**
 * Mirrors config('md-generator.limits'). The generation ceiling is the one
 * capability the plan column actually unlocks, so it must be shown honestly.
 */
export const generationLimits = {
  freePerMinute: 3,
  proPerMinute: 10,
} as const

export type Plan = {
  id: string
  label: string
  /** Price in IDR. `null` for the free plan, which is never bought. */
  amount: number | null
  credits: number
  tagline: string
  features: string[]
  /** Key in config('md-generator.packages'). Absent on plans that cannot be bought. */
  packageKey?: string
  featured?: boolean
}

export const plans: Plan[] = [
  {
    id: 'free',
    label: 'Free',
    amount: null,
    credits: creditCosts.freePlanCredits,
    tagline: 'Untuk mencoba seluruh generator tanpa membayar.',
    features: [
      `${creditCosts.freePlanCredits} kredit saat mendaftar`,
      'Semua 21 generator terbuka',
      'Kredit hanya terpotong kalau generasinya berhasil',
      `Maksimal ${generationLimits.freePerMinute} generate per menit`,
    ],
  },
  {
    id: 'pro',
    label: 'Pro',
    amount: 40000,
    credits: 100,
    tagline: 'Untuk mengerjakan proyek sungguhan dari brief sampai AGENTS.md.',
    features: [
      '100 kredit, tidak hangus',
      'Semua 21 generator terbuka',
      'Kredit kembali kalau generasi gagal',
      `Generate sampai ${generationLimits.proPerMinute} per menit`,
      'Paket akun naik ke Pro otomatis',
    ],
    packageKey: 'pro',
    featured: true,
  },
]

export function formatRupiah(amount: number) {
  return `Rp${amount.toLocaleString('id-ID')}`
}

/** Rough document count at the average credit cost (5 of the 3-6 range). */
export function estimateDocuments(credits: number) {
  return Math.floor(credits / 5)
}
