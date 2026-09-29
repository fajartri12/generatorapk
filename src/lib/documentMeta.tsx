import type { ApiDocument } from './api'
import { TOOL_CATALOG } from './tools'

/**
 * Presentation metadata for each document type: how to label it, which colours
 * to use, and where it sits in the delivery pipeline. Shared by the documents
 * list and the single-document view so both stay visually consistent.
 */
export type DocMeta = {
  initials: string
  chip: string
  text: string
  category: string
  description: string
  accent: string
}

const documentMeta: Record<string, DocMeta> = {
  brief: { initials: 'BR', chip: 'bg-blue-50', text: 'text-blue-700', category: 'Business', description: 'Ringkasan proyek, tujuan, dan ruang lingkup.', accent: 'from-blue-500/70 to-blue-400/0' },
  prd: { initials: 'PR', chip: 'bg-sky-50', text: 'text-sky-700', category: 'Product', description: 'Kebutuhan produk dan fitur utama.', accent: 'from-sky-500/70 to-sky-400/0' },
  srs: { initials: 'SR', chip: 'bg-indigo-50', text: 'text-indigo-700', category: 'Engineering', description: 'Spesifikasi kebutuhan sistem.', accent: 'from-indigo-500/70 to-indigo-400/0' },
  sdd: { initials: 'SD', chip: 'bg-cyan-50', text: 'text-cyan-700', category: 'Engineering', description: 'Desain arsitektur dan teknis sistem.', accent: 'from-cyan-500/70 to-cyan-400/0' },
  database: { initials: 'DB', chip: 'bg-emerald-50', text: 'text-emerald-700', category: 'Database', description: 'Desain struktur database dan ERD.', accent: 'from-emerald-500/70 to-emerald-400/0' },
  api: { initials: 'AP', chip: 'bg-teal-50', text: 'text-teal-700', category: 'Development', description: 'Dokumentasi endpoint dan integrasi.', accent: 'from-teal-500/70 to-teal-400/0' },
  ui_ux: { initials: 'UI', chip: 'bg-pink-50', text: 'text-pink-700', category: 'Design', description: 'Desain antarmuka dan pengalaman pengguna.', accent: 'from-pink-500/70 to-pink-400/0' },
  wbs: { initials: 'WB', chip: 'bg-amber-50', text: 'text-amber-700', category: 'Planning', description: 'Pembagian task dan timeline proyek.', accent: 'from-amber-500/70 to-amber-400/0' },
  agents_md: { initials: 'AG', chip: 'bg-orange-50', text: 'text-orange-700', category: 'Development', description: 'Instruksi pengembangan untuk AI coding agent.', accent: 'from-orange-500/70 to-orange-400/0' },
  user_stories: { initials: 'US', chip: 'bg-violet-50', text: 'text-violet-700', category: 'Product', description: 'Cerita pengguna beserta kriteria penerimaan.', accent: 'from-violet-500/70 to-violet-400/0' },
  tasks_md: { initials: 'TS', chip: 'bg-lime-50', text: 'text-lime-700', category: 'Development', description: 'Daftar tugas berurutan yang siap dikerjakan.', accent: 'from-lime-500/70 to-lime-400/0' },
  readme_md: { initials: 'RD', chip: 'bg-slate-100', text: 'text-slate-700', category: 'Development', description: 'Panduan setup, skrip, dan konvensi proyek.', accent: 'from-slate-500/70 to-slate-400/0' },
  tech_stack: { initials: 'TK', chip: 'bg-rose-50', text: 'text-rose-700', category: 'Engineering', description: 'Rekomendasi teknologi beserta alasan dan risikonya.', accent: 'from-rose-500/70 to-rose-400/0' },
  user_flow: { initials: 'UF', chip: 'bg-fuchsia-50', text: 'text-fuchsia-700', category: 'Design', description: 'Alur pengguna, percabangan, dan penanganan kesalahan.', accent: 'from-fuchsia-500/70 to-fuchsia-400/0' },
  design_system: { initials: 'DS', chip: 'bg-purple-50', text: 'text-purple-700', category: 'Design', description: 'Token desain dan katalog komponen.', accent: 'from-purple-500/70 to-purple-400/0' },
  figma_prompt: { initials: 'FP', chip: 'bg-pink-50', text: 'text-pink-700', category: 'Design', description: 'Brief kerja untuk desainer Figma.', accent: 'from-pink-500/70 to-pink-400/0' },
  dev_prompt: { initials: 'DP', chip: 'bg-cyan-50', text: 'text-cyan-700', category: 'Development', description: 'Prompt pembuka untuk memulai implementasi.', accent: 'from-cyan-500/70 to-cyan-400/0' },
  personas: { initials: 'PS', chip: 'bg-yellow-50', text: 'text-yellow-700', category: 'Product', description: 'Profil pengguna, tujuan, dan frustrasinya.', accent: 'from-yellow-500/70 to-yellow-400/0' },
  test_plan: { initials: 'TP', chip: 'bg-green-50', text: 'text-green-700', category: 'Engineering', description: 'Strategi pengujian, kasus uji, dan kriterianya.', accent: 'from-green-500/70 to-green-400/0' },
  security_review: { initials: 'SC', chip: 'bg-red-50', text: 'text-red-700', category: 'Engineering', description: 'Risiko keamanan, kontrol akses, dan kepatuhan.', accent: 'from-red-500/70 to-red-400/0' },
  microcopy: { initials: 'MC', chip: 'bg-stone-100', text: 'text-stone-700', category: 'Design', description: 'Suara, nada, dan teks antarmuka per keadaan.', accent: 'from-stone-500/70 to-stone-400/0' },
}

const fallbackMeta: DocMeta = { initials: 'DO', chip: 'bg-slate-100', text: 'text-slate-700', category: 'Dokumen', description: 'Dokumentasi proyek.', accent: 'from-slate-500/60 to-slate-400/0' }

export function docMeta(type: string): DocMeta {
  return documentMeta[type] ?? { ...fallbackMeta, initials: type.slice(0, 2).toUpperCase() }
}

export function docMetaFor(doc: ApiDocument): DocMeta {
  return docMeta(doc.type)
}

/** The pipeline stage a document type occupies, used for "langkah n dari 9". */
export const DOC_STAGE_ORDER = ['brief', 'prd', 'srs', 'sdd', 'database', 'api', 'ui_ux', 'wbs', 'agents_md'] as const

/** Display name of the generator that produced a document type. */
export function generatorName(type: string): string | null {
  return TOOL_CATALOG.find((tool) => tool.documentType === type)?.name ?? null
}

export type StatusKey = 'ready' | 'generating' | 'failed' | 'archived' | 'draft'

const KNOWN_STATUS = ['ready', 'generating', 'failed', 'archived'] as const

export function statusKey(status: string): StatusKey {
  return (KNOWN_STATUS as readonly string[]).includes(status) ? (status as StatusKey) : 'draft'
}

export const STATUS_LABEL: Record<StatusKey, string> = {
  ready: 'Siap',
  generating: 'Diproses',
  failed: 'Gagal',
  archived: 'Diarsipkan',
  draft: 'Draf',
}

export const STATUS_CLASS: Record<StatusKey, string> = {
  ready: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  generating: 'bg-blue-50 text-blue-700 ring-blue-100',
  failed: 'bg-red-50 text-red-700 ring-red-100',
  archived: 'bg-slate-100 text-slate-500 ring-slate-200',
  draft: 'bg-amber-50 text-amber-700 ring-amber-100',
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function relativeDate(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const day = 86_400_000
  if (diff < day) return 'hari ini'
  if (diff < 2 * day) return 'kemarin'
  if (diff < 30 * day) return `${Math.floor(diff / day)} hari lalu`
  return formatDate(value)
}

export function StatusPill({ status }: { status: string }) {
  const key = statusKey(status)
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_CLASS[key]}`}>
      {key === 'generating' && <span className="size-1.5 animate-pulse rounded-full bg-blue-500" aria-hidden />}
      {STATUS_LABEL[key]}
    </span>
  )
}
