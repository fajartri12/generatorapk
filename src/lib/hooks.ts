import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await api.getProjects()).data,
  })
}

export function useProject(id: number) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => (await api.getProject(id)).data,
    enabled: Number.isFinite(id),
  })
}

export function useCredits() {
  return useQuery({
    queryKey: ['credits'],
    queryFn: async () => (await api.getCredits()).data,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProjectContext(projectId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<api.ApiContext>) => api.updateProjectContext(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId] }),
  })
}

/**
 * Generates a document and tracks its progress.
 *
 * The POST only reserves the credits and returns the new Generation; the model
 * call runs on the queue. We then poll `GET /api/generations/{id}` so the
 * caller can render the real stage instead of guessing (AGENTS.md §17).
 *
 * Invalidates the project and credits when the run reaches a terminal state,
 * so the document list and balance stay correct whether it succeeded, failed,
 * or was cancelled.
 */
export function useGenerate(projectId: number) {
  const qc = useQueryClient()
  const [generationId, setGenerationId] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)

  const start = useMutation({
    mutationFn: (documentType: string) => api.createGeneration({ project_id: projectId, document_type: documentType }),
    onSuccess: (result) => setGenerationId(result.data.id),
  })

  const progress = useQuery({
    queryKey: ['generations', generationId],
    queryFn: async () => (await api.getGeneration(generationId as number)).data,
    enabled: generationId != null,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'running' ? 1500 : false
    },
  })

  const active = progress.data ?? null
  const isRunning = active != null && (active.status === 'pending' || active.status === 'running')

  // Live stopwatch. The model takes tens of seconds, so a ticking counter is
  // honest feedback; the stage comes from the server, not from this timer.
  useEffect(() => {
    if (!isRunning) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 100)
    return () => window.clearInterval(timer)
  }, [isRunning, generationId])

  // Refresh everything downstream once the run ends.
  useEffect(() => {
    if (!active || isRunning) return
    qc.invalidateQueries({ queryKey: ['projects', projectId] })
    qc.invalidateQueries({ queryKey: ['credits'] })
    qc.invalidateQueries({ queryKey: ['documents'] })
    qc.invalidateQueries({ queryKey: ['generations'] })
  }, [active, isRunning, projectId, qc])

  const cancel = useMutation({
    mutationFn: () => api.cancelGeneration(generationId as number),
    onSuccess: (result) => {
      qc.setQueryData(['generations', generationId], result.data)
      qc.invalidateQueries({ queryKey: ['credits'] })
    },
  })

  return {
    /** Kick off a generation for a document type. */
    start: (documentType: string) => start.mutate(documentType),
    /** The generation being tracked, with its real stage. */
    generation: active,
    /** True from the moment the POST is sent until the run ends. */
    isPending: start.isPending || isRunning,
    isRunning,
    stage: active?.stage ?? (start.isPending ? 'queued' : null),
    elapsedMs,
    error: start.error ?? progress.error ?? active?.error ?? null,
    startError: start.error,
    cancel: () => cancel.mutate(),
    isCancelling: cancel.isPending,
    /** Clear tracking after the UI has acknowledged the result. */
    reset: () => {
      setGenerationId(null)
      setElapsedMs(0)
      start.reset()
      cancel.reset()
    },
  }
}

export function useAllDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const projects = (await api.getProjects()).data
      const results = await Promise.all(projects.map(async (project) => (await api.getProjectDocuments(project.id)).data))
      return results.flat()
    },
  })
}

export function useDocument(id: number) {
  return useQuery({ queryKey: ['documents', id], queryFn: async () => (await api.getDocument(id)).data, enabled: Number.isFinite(id) })
}

export function useGenerations() {
  return useQuery({ queryKey: ['generations'], queryFn: async () => (await api.getGenerations()).data })
}

/** Cost table comes from the backend config, never hard-coded in the UI (AGENTS.md §27). */
export function useCreditCosts() {
  return useQuery({
    queryKey: ['credit-costs'],
    queryFn: async () => (await api.getCreditCosts()).data,
    staleTime: 5 * 60_000,
  })
}

/** Same endpoint, but keeps `starting_balance` which sits beside `data`, not inside it. */
export function useCreditCostConfig() {
  return useQuery({
    queryKey: ['credit-costs', 'config'],
    queryFn: () => api.getCreditCosts(),
    staleTime: 5 * 60_000,
  })
}

// ── Admin hooks ────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery({ queryKey: ['admin', 'stats'], queryFn: api.adminStats })
}

export function useAdminUsers(inactive = false) {
  return useQuery({ queryKey: ['admin', 'users', inactive ? 'inactive' : 'all'], queryFn: async () => (await api.adminUsers(inactive)).data })
}

export function useAdminProjects() {
  return useQuery({ queryKey: ['admin', 'projects'], queryFn: async () => (await api.adminProjects()).data })
}

export function useAdminGenerations() {
  return useQuery({ queryKey: ['admin', 'generations'], queryFn: async () => (await api.adminGenerations()).data })
}

/** Rekening tujuan transfer: dipakai halaman pembayaran, jadi ikut di-invalidate. */
export function useAdminBankSettings() {
  return useQuery({ queryKey: ['admin', 'bank'], queryFn: async () => (await api.adminBankSettings()).data })
}

export function useAdminUpdateBankSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof api.adminUpdateBankSettings>[0]) => api.adminUpdateBankSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bank'] })
      qc.invalidateQueries({ queryKey: ['admin', 'audit'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

/** Pesanan gateway: galat "sudah bayar tapi kredit belum masuk" bermuara di sini. */
export function useAdminGatewayOrders(status?: string) {
  return useQuery({
    queryKey: ['admin', 'gateway-orders', status ?? 'all'],
    queryFn: () => api.adminGatewayOrders(status),
  })
}

/** Perubahan saldo admin (koreksi manual dan massal) selalu memengaruhi banyak tab. */
function invalidateCreditTabs(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin', 'users'] })
  qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
  qc.invalidateQueries({ queryKey: ['admin', 'audit'] })
  qc.invalidateQueries({ queryKey: ['credits'] })
}

export function useAdminAdjustCredits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount, description }: { id: number; amount: number; description: string }) =>
      api.adminAdjustCredits(id, { amount, description }),
    onSuccess: () => invalidateCreditTabs(qc),
  })
}

export function useAdminBulkCredits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { user_ids: number[]; amount: number; description: string }) => api.adminBulkCredits(data),
    onSuccess: () => invalidateCreditTabs(qc),
  })
}

export function useAdminSyncGatewayOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.adminSyncGatewayOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gateway-orders'] })
      qc.invalidateQueries({ queryKey: ['admin', 'audit'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })
}

// ── Payment hooks ──────────────────────────────────────────────────────────

/** Packages, bank details, and the user's own transfer orders. */
export function usePayments() {
  return useQuery({ queryKey: ['payments'], queryFn: () => api.getPayments() })
}

export function useCreatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (packageKey: string) => api.createPayment(packageKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  })
}

export function useSubmitPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { transfer_reference: string; note?: string } }) => api.submitPayment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  })
}

/** Creates a Pakasir order and returns its payment link. No query invalidation
 *  yet: the order is only interesting once the buyer returns or syncs. */
export function useCheckoutPakasir() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ packageKey, redirectUrl }: { packageKey: string; redirectUrl?: string }) => api.checkoutPakasir(packageKey, redirectUrl),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  })
}

/** Polls Pakasir for the truth. Settlement only happens server-side, so a paid
 *  order also refreshes the credit balance. */
export function useSyncPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.syncPayment(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      if (res.data.status === 'paid') {
        qc.invalidateQueries({ queryKey: ['credits'] })
        qc.invalidateQueries({ queryKey: ['generations'] })
      }
    },
  })
}

/** Sandbox helper: marks the order paid on Pakasir's side, then syncs locally. */
export function useSimulatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.simulatePayment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['credits'] })
    },
  })
}

export function useCancelPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.cancelPayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  })
}

/** Uploads a receipt for an existing order. Multipart, so it bypasses the JSON client. */
export function useUploadPaymentProof() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => api.uploadPaymentProof(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  })
}

/** Admin review queue. `status` filters server-side, so the badge counts stay honest. */
export function useAdminPayments(status?: string) {
  return useQuery({
    queryKey: ['admin', 'payments', status ?? 'all'],
    queryFn: () => api.adminPayments(status),
  })
}

export function useAdminDecidePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, note }: { id: number; action: 'approve' | 'reject'; note?: string }) =>
      action === 'approve' ? api.adminApprovePayment(id, note) : api.adminRejectPayment(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'payments'] })
      // Approving writes a ledger row and changes a balance.
      qc.invalidateQueries({ queryKey: ['credits'] })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      // Every decision leaves a trail, so a stale list would be a lie.
      qc.invalidateQueries({ queryKey: ['admin', 'audit'] })
    },
  })
}

// ── Notification hooks ─────────────────────────────────────────────────────

/** The inbox. Polled slowly so the badge keeps up without a socket. */
export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: api.getNotifications,
    enabled,
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

// ── Admin: audit trail ─────────────────────────────────────────────────────

export function useAdminAuditLogs(filter?: { action?: string; subjectType?: string; subjectId?: number }) {
  return useQuery({
    queryKey: ['admin', 'audit', filter?.action ?? 'all', filter?.subjectType ?? '', filter?.subjectId ?? 0],
    queryFn: async () => api.adminAuditLogs(filter),
  })
}
