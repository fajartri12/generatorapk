/**
 * Tool catalogue. Credits are intentionally absent — they come from the
 * backend cost table so the UI can never drift from config (AGENTS.md §27).
 * `documentType: null` means the tool has no generator yet.
 */
export type ToolCategory = 'Product' | 'Engineering' | 'Design' | 'Development'

export type ToolDefinition = {
  name: string
  description: string
  category: ToolCategory
  icon: string
  documentType: string | null
}

export const TOOL_CATALOG: ToolDefinition[] = [
  { name: 'Project Brief', description: 'Ringkas ide menjadi satu halaman yang bisa dipakai semua generator.', category: 'Product', icon: '✦', documentType: 'brief' },
  { name: 'User Persona', description: 'Kenali siapa yang Anda bangun, beserta tujuan dan frustrasinya.', category: 'Product', icon: '☺', documentType: 'personas' },
  { name: 'PRD Generator', description: 'Ubah ide produk menjadi dokumen kebutuhan produk yang jelas.', category: 'Product', icon: '✦', documentType: 'prd' },
  { name: 'SRS Generator', description: 'Tetapkan kebutuhan fungsional dan perilaku sistem.', category: 'Product', icon: '☷', documentType: 'srs' },
  { name: 'User Story Generator', description: 'Pecah fitur menjadi cerita yang bisa diestimasi tim Anda.', category: 'Product', icon: '◻', documentType: 'user_stories' },
  { name: 'WBS Generator', description: 'Susun pekerjaan menjadi fase, tugas, dan keluaran.', category: 'Product', icon: '▦', documentType: 'wbs' },

  { name: 'SDD Architect', description: 'Petakan arsitektur teknis yang andal untuk produk Anda.', category: 'Engineering', icon: '⌘', documentType: 'sdd' },
  { name: 'Database Architect', description: 'Rancang entitas, relasi, dan aturan data yang skalabel.', category: 'Engineering', icon: '▤', documentType: 'database' },
  { name: 'API Architect', description: 'Tetapkan endpoint, payload, dan konvensi error.', category: 'Engineering', icon: '⇄', documentType: 'api' },
  { name: 'Tech Stack Architect', description: 'Pilih teknologi yang cocok dengan produk, tim, dan anggaran Anda.', category: 'Engineering', icon: '⚙', documentType: 'tech_stack' },
  { name: 'Test Plan', description: 'Rencanakan pengujian sebelum menulis kode, bukan sesudahnya.', category: 'Engineering', icon: '⚑', documentType: 'test_plan' },
  { name: 'Security Review', description: 'Temukan risiko akses, data sensitif, dan kepatuhan lebih awal.', category: 'Engineering', icon: '⚿', documentType: 'security_review' },

  { name: 'UI/UX Generator', description: 'Buat spesifikasi antarmuka dan pengalaman yang bisa langsung dikerjakan.', category: 'Design', icon: '◈', documentType: 'ui_ux' },
  { name: 'User Flow', description: 'Petakan setiap jalur yang dilalui pengguna di produk Anda.', category: 'Design', icon: '⇢', documentType: 'user_flow' },
  { name: 'Design System', description: 'Tetapkan token, komponen, dan aturan penggunaannya.', category: 'Design', icon: '◍', documentType: 'design_system' },
  { name: 'Figma Prompt', description: 'Beri desainer sebuah brief yang bisa langsung dijadikan layar.', category: 'Design', icon: '✎', documentType: 'figma_prompt' },
  { name: 'UX Writing', description: 'Tetapkan suara, nada, dan teks untuk setiap keadaan antarmuka.', category: 'Design', icon: '❝', documentType: 'microcopy' },

  { name: 'AGENTS.md', description: 'Beri coding agent Anda konteks yang dibutuhkan untuk membangun.', category: 'Development', icon: '↗', documentType: 'agents_md' },
  { name: 'TASKS.md', description: 'Ubah rencana menjadi tugas berurutan yang siap dikerjakan.', category: 'Development', icon: '☑', documentType: 'tasks_md' },
  { name: 'README.md', description: 'Dokumentasikan setup, skrip, dan konvensi proyek.', category: 'Development', icon: '❐', documentType: 'readme_md' },
  { name: 'Development Prompt', description: 'Mulai implementasi dengan prompt pembuka yang presisi.', category: 'Development', icon: '⌨', documentType: 'dev_prompt' },
]

export const TOOL_CATEGORIES: ToolCategory[] = ['Product', 'Engineering', 'Design', 'Development']

export function toolCredits(costs: Record<string, number> | undefined, documentType: string | null) {
  if (!documentType) return null
  return costs?.[documentType] ?? null
}
