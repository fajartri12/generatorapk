// Satu origin: SPA dan API sama-sama dilayani Laravel, jadi path relatif sudah
// benar tanpa konfigurasi apa pun. Di dev, Vite mem-proxy /api dan /auth ke
// `php artisan serve` (lihat vite.config.ts), sehingga tetap same-origin.
// VITE_API_URL hanya perlu diisi kalau API sengaja ditempatkan di host lain.
export const API_BASE: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export type AuthUser = { id: number; name: string; email: string; role: 'user' | 'pro' | 'admin' }

/** Mirrors the stage constants on App\Models\Generation. */
export type GenerationStage = 'queued' | 'context' | 'model' | 'saving' | 'done' | 'failed'

let token: string | null = localStorage.getItem('md_token')

export function setToken(t: string | null) {
  token = t
  if (t) localStorage.setItem('md_token', t)
  else localStorage.removeItem('md_token')
}

export function getToken() {
  return token
}

/**
 * Dipanggil sekali saat server menjawab 401: token sudah tidak berlaku, jadi
 * sesi lokal harus dibuang dan pengguna dikembalikan ke halaman masuk.
 * AuthProvider mendaftarkan handler-nya di sini supaya kebijakan sesi hanya
 * hidup di satu tempat, bukan di setiap komponen.
 */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

/**
 * Satu-satunya tempat yang tahu cara mengubah respons gagal menjadi ApiError.
 * 401 ditangani terpusat di sini; 403 sengaja dibiarkan naik agar pemanggil
 * bisa menampilkan pesan "akses ditolak" di halaman yang bersangkutan.
 */
function throwApiError(status: number, body: Record<string, unknown>, fallback: string): never {
  if (status === 401) onUnauthorized?.()

  throw new ApiError(status, (body.message as string) ?? fallback, body)
}

/**
 * Membaca isi JSON tanpa meledak saat server membalas HTML (mis. 419 atau
 * halaman error 500), supaya pesan aslinya tetap sampai ke pengguna.
 */
async function readErrorBody(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  }

  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })

  if (!res.ok) {
    throwApiError(res.status, await readErrorBody(res), res.statusText)
  }

  return res.json() as Promise<T>
}

export class ApiError extends Error {
  status: number
  body: Record<string, unknown>

  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.body = body
  }
}

/**
 * Excel membaca CSV sebagai ANSI kecuali ada BOM, dan SharePoint/Mac juga
 * tersandung tanda titik dua pada nama berkas.
 */
const CSV_FILENAME_SAFE = /[^a-zA-Z0-9._-]/g

/**
 * Unduh CSV dengan header Authorization. Link biasa dipakai lewat fungsi ini
 * karena token bearer tidak ikut terkirim pada navigasi browser.
 *
 * Accept menetapkan JSON walau isi suksesnya CSV: tanpa itu Laravel mengira
 * ini kunjungan browser, lalu mengalihkan tamu ke "/" (302) alih-alih
 * membalas 401. Redirect itu juga mematikan CORS, jadi pesannya jadi
 * "net::ERR_FAILED" yang tak bisa ditangani kode.
 */
export async function downloadCsv(path: string, filename: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) {
    throwApiError(res.status, await readErrorBody(res), 'Ekspor gagal diunduh.')
  }

  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename.replace(CSV_FILENAME_SAFE, '-')
  link.click()
  URL.revokeObjectURL(url)
}

// ── Auth ──────────────────────────────────────────────────────────────────

export function register(data: { name: string; email: string; password: string; password_confirmation: string }) {
  return request<{ user: AuthUser; token: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) })
}

export function login(data: { email: string; password: string }) {
  return request<{ user: AuthUser; token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) })
}

export function me() {
  return request<{ user: AuthUser; credits: { balance: number; plan: string } }>('/api/auth/me')
}

export function updateProfile(data: { name: string }) {
  return request<{ user: AuthUser }>('/api/auth/profile', { method: 'PUT', body: JSON.stringify(data) })
}

export function logout() {
  return request<{ message: string }>('/api/auth/logout', { method: 'POST' })
}

export function forgotPassword(data: { email: string }) {
  return request<{ message: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) })
}

export function resetPassword(data: { token: string; email: string; password: string; password_confirmation: string }) {
  return request<{ message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(data) })
}

export function googleStatus() {
  return request<{ enabled: boolean }>('/api/auth/google/status')
}

/** Trades the one-time code from the OAuth callback for a bearer token. */
export function googleExchange(code: string) {
  return request<{ user: AuthUser; token: string }>('/api/auth/google/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}
// ── Projects ───────────────────────────────────────────────────────────────

export function getProjects() {
  return request<{ data: ApiProject[] }>('/api/projects')
}

export function getProject(id: number) {
  return request<{ data: ApiProject & { context: ApiContext | null; documents: ApiDocument[] } }>(`/api/projects/${id}`)
}

export function createProject(data: { name: string; description?: string; icon?: string; color?: string; tags?: string[]; context?: Partial<ApiContext> }) {
  return request<{ data: ApiProject }>('/api/projects', { method: 'POST', body: JSON.stringify(data) })
}

export function updateProject(id: number, data: Partial<{ name: string; description: string; icon: string; color: string; tags: string[]; status: string }>) {
  return request<{ data: ApiProject }>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }) // PATCH also works
}

export function updateProjectContext(id: number, data: Partial<ApiContext>) {
  return request<{ data: ApiContext }>(`/api/projects/${id}/context`, { method: 'PUT', body: JSON.stringify(data) })
}

// ── Documents ──────────────────────────────────────────────────────────────

export function getProjectDocuments(projectId: number) {
  return request<{ data: ApiDocument[] }>(`/api/projects/${projectId}/documents`)
}

export function getDocument(id: number) {
  return request<{ data: ApiDocument & { versions: ApiDocumentVersion[] } }>(`/api/documents/${id}`)
}

export function getDocumentVersions(id: number) {
  return request<{ data: ApiDocumentVersion[] }>(`/api/documents/${id}/versions`)
}

export function updateDocument(id: number, data: { content: string; change_note?: string }) {
  return request<{ data: ApiDocumentVersion }>(`/api/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteDocument(id: number) {
  return request<{ message: string }>(`/api/documents/${id}`, { method: 'DELETE' })
}

export function deleteProject(id: number) {
  return request<{ message: string }>(`/api/projects/${id}`, { method: 'DELETE' })
}

// ── Admin ──────────────────────────────────────────────────────────────────

export function adminStats() {
  return request<{
    total_users: number
    total_projects: number
    total_generations: number
    total_credits_used: number
    credits_used: { today: number; '7d': number; '30d': number }
    failures: { total: number; last_7d: number; by_provider: { provider: string; total: number }[] }
    payments: { pending: number; paid: number; rejected: number; cancelled: number; gateway: { pending: number; paid: number; cancelled: number; expired: number } }
    expiring_soon: number
    trend: { date: string; generations: number; credits: number }[]
  }>('/api/admin/stats')
}

export function adminUsers(inactive = false) {
  return request<{ data: ApiAdminUser[] }>(`/api/admin/users${inactive ? '?inactive=1' : ''}`)
}

export function adminCreateUser(data: { name: string; email: string; password: string; role?: string }) {
  return request<{ data: ApiAdminUser }>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) })
}

export function adminUpdateRole(userId: number, role: string) {
  return request<{ data: { id: number; role: string } }>(`/api/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) })
}

export function adminUpdatePlan(userId: number, plan: string) {
  return request<{ message: string }>(`/api/admin/users/${userId}/plan`, { method: 'PUT', body: JSON.stringify({ plan }) })
}

export function adminGrantCredits(userId: number, data: { amount: number; description?: string }) {
  return request<{ message: string; balance: number }>(`/api/admin/users/${userId}/credits`, { method: 'POST', body: JSON.stringify(data) })
}

/** Koreksi saldo: amount negatif mengurangi. Deskripsi wajib. */
export function adminAdjustCredits(userId: number, data: { amount: number; description: string }) {
  return request<{ message: string; balance: number }>(`/api/admin/users/${userId}/credits/adjust`, { method: 'POST', body: JSON.stringify(data) })
}

/** Satu nominal untuk banyak pengguna. amount negatif mengurangi. */
export function adminBulkCredits(data: { user_ids: number[]; amount: number; description: string }) {
  return request<{ message: string; updated: number[]; skipped: number[] }>('/api/admin/credits/bulk', { method: 'POST', body: JSON.stringify(data) })
}

export function adminProjects() {
  return request<{ data: ApiAdminProject[] }>('/api/admin/projects')
}

export function adminDeleteProject(id: number) {
  return request<{ message: string }>(`/api/admin/projects/${id}`, { method: 'DELETE' })
}

export function adminGenerations(status?: string) {
  return request<{ data: ApiAdminGeneration[] }>(`/api/admin/generations${status ? `?status=${status}` : ''}`)
}

/** Unduh CSV. Link biasa dipakai agar token tetap dikirim sebagai header. */
export function adminExportUrl(kind: 'users' | 'generations' | 'payments' | 'audit-logs') {
  return `/api/admin/export/${kind}`
}

export function adminUpdateCosts(costs: Record<string, number>) {
  return request<{ message: string; costs: Record<string, number> }>('/api/admin/costs', { method: 'PUT', body: JSON.stringify({ costs }) })
}

/** Rekening tujuan transfer manual. Dibaca dan diubah dari panel admin. */
export function adminBankSettings() {
  return request<{ data: ApiBankSettings }>('/api/admin/bank')
}

export function adminUpdateBankSettings(data: ApiBankSettings) {
  return request<{ message: string; data: ApiBankSettings }>('/api/admin/bank', { method: 'PUT', body: JSON.stringify(data) })
}

type ApiBankSettings = { bank: string; account_number: string; account_name: string; instructions: string | null }

export type ApiAdminUser = {
  id: number
  name: string
  email: string
  role: 'user' | 'pro' | 'admin'
  plan: string
  balance: number
  projects_count: number
  created_at: string
}

export type ApiAdminProject = {
  id: number
  name: string
  slug: string
  status: string
  icon: string
  color: string
  documents_count: number
  user: { id: number; name: string; email: string }
  created_at: string
}

export type ApiAdminGeneration = {
  id: number
  document_type: string
  status: string
  stage: string | null
  error: string | null
  credits_used: number
  provider: string
  model: string
  duration_ms: number | null
  project_id: number | null
  document_id: number | null
  user: { id: number; name: string; email: string } | null
  created_at: string
}

// ── Generations ────────────────────────────────────────────────────────────

export function createGeneration(data: { project_id: number; document_type: string; input?: Record<string, unknown> }) {
  return request<{ data: ApiGeneration; credits: { balance: number; plan: string } }>('/api/generations', { method: 'POST', body: JSON.stringify(data) })
}

export function getGenerations() {
  return request<{ data: ApiGeneration[] }>('/api/generations')
}

export function getGeneration(id: number) {
  return request<{ data: ApiGeneration }>(`/api/generations/${id}`)
}

export function cancelGeneration(id: number) {
  return request<{ data: ApiGeneration; credits: { balance: number; plan: string } }>(`/api/generations/${id}/cancel`, { method: 'POST' })
}

// ── Credits ────────────────────────────────────────────────────────────────

export function getCredits() {
  return request<{ data: { balance: number; plan: string; transactions: ApiCreditTransaction[] } }>('/api/credits')
}

export function getCreditCosts() {
  return request<{ data: Record<string, number>; starting_balance: number }>('/api/credits/costs')
}

// ── Payments (manual bank transfer) ────────────────────────────────────────

export function getPayments(page = 1) {
  return request<{
    data: ApiPayment[]
    meta: { current_page: number; last_page: number; total: number }
    packages: ApiPaymentPackage[]
    bank: ApiBankDetails
    expiry_hours: number
    proof_max_kb: number
    pakasir: { enabled: boolean; sandbox: boolean }
  }>(`/api/payments?page=${page}`)
}

export function createPayment(packageKey: string) {
  return request<{ data: ApiPayment }>('/api/payments', { method: 'POST', body: JSON.stringify({ package: packageKey }) })
}

/**
 * Pakasir rail. `redirect_url` is where Pakasir sends the buyer afterwards, so
 * it points back at the payments page instead of Pakasir's own receipt.
 */
export function checkoutPakasir(packageKey: string, redirectUrl?: string) {
  return request<{
    payment_url: string
    qr_string: string | null
    va_number: string | null
    total_payment: number | null
    fee: number | null
    expires_at: string | null
    is_sandbox: boolean
    data: ApiPayment
  }>('/api/payments/pakasir/checkout', {
    method: 'POST',
    body: JSON.stringify({ package: packageKey, redirect_url: redirectUrl }),
  })
}

/** Ask Pakasir whether an order is paid yet. The recovery path when a webhook is missed. */
export function syncPayment(id: number) {
  return request<{ data: ApiPayment }>(`/api/payments/${id}/sync`, { method: 'POST' })
}

/** Sandbox only: make Pakasir fire the paid webhook without real money. */
export function simulatePayment(id: number) {
  return request<{ message: string; data: ApiPayment }>(`/api/payments/${id}/simulate`, { method: 'POST' })
}

export function submitPayment(id: number, data: { transfer_reference: string; note?: string }) {
  return request<{ message: string; data: ApiPayment }>(`/api/payments/${id}/submit`, { method: 'POST', body: JSON.stringify(data) })
}

export function cancelPayment(id: number) {
  return request<{ message: string; data: ApiPayment }>(`/api/payments/${id}/cancel`, { method: 'POST' })
}

/**
 * Receipt upload needs multipart, not the JSON body `request()` builds, so this
 * goes through fetch directly. The file field must be named `proof`.
 */
export async function uploadPaymentProof(id: number, file: File) {
  const body = new FormData()
  body.append('proof', file)

  const res = await fetch(`${API_BASE}/api/payments/${id}/proof`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
  })

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

  if (!res.ok) {
    throwApiError(res.status, json, res.statusText)
  }

  return json as { message: string; data: ApiPayment }
}

/**
 * Receipts live behind an authorised endpoint, so a plain `<img src>` cannot
 * reach them — Sanctum reads the token from the header, not the query string.
 * Fetch the bytes with the header, then hand back an object URL for preview.
 * The caller owns the URL and must revoke it when the preview unmounts.
 */
export async function fetchPaymentProofUrl(id: number, admin = false) {
  const path = admin ? `/api/admin/payments/${id}/proof` : `/api/payments/${id}/proof`

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })

  if (!res.ok) {
    throwApiError(res.status, await readErrorBody(res), 'Bukti transfer tidak dapat dimuat.')
  }

  return URL.createObjectURL(await res.blob())
}

// ── Admin: payment review ──────────────────────────────────────────────────

export function adminPayments(status?: string) {
  return request<{
    data: ApiPayment[]
    meta: { current_page: number; last_page: number; total: number }
    counts: Record<string, number>
    expiring: number
    scheduler: { last_run_at: string | null; last_run_count: number | null; stale: boolean }
  }>(`/api/admin/payments${status ? `?status=${status}` : ''}`)
}

/** Pesanan gateway: tidak masuk antrean verifikasi, jadi tampil terpisah. */
export function adminGatewayOrders(status?: string) {
  return request<{ data: ApiPayment[]; meta: { current_page: number; last_page: number; total: number }; counts: Record<string, number> }>(
    `/api/admin/gateway-orders${status ? `?status=${status}` : ''}`,
  )
}

/** Minta server memeriksa ulang status pesanan ke provider. */
export function adminSyncGatewayOrder(id: number) {
  return request<{ message: string; data: ApiPayment }>(`/api/admin/gateway-orders/${id}/sync`, { method: 'POST' })
}

export function adminApprovePayment(id: number, note?: string) {
  return request<{ message: string; data: ApiPayment }>(`/api/admin/payments/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) })
}

export function adminRejectPayment(id: number, note?: string) {
  return request<{ message: string; data: ApiPayment }>(`/api/admin/payments/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) })
}

export type ApiPaymentPackage = { key: string; label: string; credits: number; amount: number }

export type ApiBankDetails = { bank: string; account_number: string; account_name: string; instructions?: string }

export type ApiPayment = {
  id: number
  code: string
  package: string
  package_label: string
  credits: number
  amount: number
  status: 'pending' | 'paid' | 'rejected' | 'cancelled' | 'expired'
  gateway: 'manual' | 'pakasir'
  gateway_is_sandbox: boolean
  gateway_method: string | null
  /** ID transaksi di sisi gateway. Tidak selalu dikirim server; UI harus tahan null. */
  gateway_txn_id?: string | null
  /** Link bayar Pakasir, sudah dibangun server. Null untuk transfer manual. */
  payment_url: string | null
  transfer_reference: string | null
  proof: boolean
  proof_size: number | null
  proof_uploaded_at: string | null
  note: string | null
  admin_note: string | null
  submitted_at: string | null
  expires_at: string | null
  hours_remaining: number | null
  reviewed_at: string | null
  created_at: string
  user: { id: number; name: string; email: string } | null
}

// ── Notifications (in-app inbox) ───────────────────────────────────────────

export type ApiNotification = {
  id: string
  type: string
  data: {
    kind?: string
    stage?: string
    title: string
    body: string
    url?: string
    approved?: boolean
    credits?: number
    payment_id?: number
    code?: string
  }
  read_at: string | null
  created_at: string
}

export function getNotifications() {
  return request<{ data: ApiNotification[]; unread: number }>('/api/notifications')
}

export function getUnreadCount() {
  return request<{ unread: number }>('/api/notifications/unread')
}

export function markNotificationRead(id: string) {
  return request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsRead() {
  return request<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' })
}

// ── Admin: audit trail ─────────────────────────────────────────────────────

export type ApiAuditLog = {
  id: number
  action: string
  description: string
  changes: Record<string, unknown> | null
  subject_type: string | null
  subject_id: number | null
  ip: string | null
  created_at: string
  actor: { id: number; name: string; email: string } | null
}

export function adminAuditLogs(filter?: { action?: string; subjectType?: string; subjectId?: number; page?: number }) {
  const params = new URLSearchParams()
  if (filter?.action) params.set('action', filter.action)
  if (filter?.subjectType) params.set('subject_type', filter.subjectType)
  if (filter?.subjectId) params.set('subject_id', String(filter.subjectId))
  params.set('page', String(filter?.page ?? 1))

  return request<{
    data: ApiAuditLog[]
    meta: { current_page: number; last_page: number; total: number }
  }>(`/api/admin/audit-logs?${params.toString()}`)
}

// ── Types ───────────────────────────────────────────────────────────────────

export type ApiProject = {
  id: number
  name: string
  slug: string
  description: string | null
  icon: string
  color: string
  tags: string[] | null
  status: string
  documents_count?: number
  created_at: string
  updated_at: string
}

export type ApiContext = {
  id: number
  project_id: number
  summary: string | null
  audience: string | null
  problem: string | null
  features: string | null
  business_goal: string | null
  tech_stack: string[] | null
}

export type ApiDocument = {
  id: number
  project_id: number
  type: string
  title: string
  status: string
  current_version: number
  created_at: string
  updated_at: string
  versions?: ApiDocumentVersion[]
}

export type ApiDocumentVersion = {
  id: number
  document_id: number
  version: number
  content: string
  author: string
  generation_id: number | null
  prompt_version: string | null
  model: string | null
  change_note: string | null
  created_at: string
}

export type ApiGeneration = {
  id: number
  user_id: number
  project_id: number
  document_id: number
  tool: string
  document_type: string
  status: string
  stage: GenerationStage
  prompt_version: string
  provider: string
  model: string
  input: Record<string, unknown> | null
  context_snapshot: Record<string, unknown> | null
  output: string | null
  error: string | null
  credits_used: number
  duration_ms: number | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export type ApiCreditTransaction = {
  id: number
  credit_wallet_id: number
  user_id: number
  generation_id: number | null
  type: string
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}