import type { ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { LandingPage } from '../features/landing/LandingPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { ProjectPage } from '../features/projects/ProjectPage'
import { ProjectsPage } from '../features/projects/ProjectsPage'
import { DocumentsPage } from '../features/workspace/DocumentsPage'
import { DocumentPage } from '../features/workspace/DocumentPage'
import { HistoryPage } from '../features/workspace/HistoryPage'
import { BillingPage } from '../features/workspace/BillingPage'
import { PaymentsPage } from '../features/workspace/PaymentsPage'
import { SettingsPage } from '../features/workspace/SettingsPage'
import { ToolsPage } from '../features/workspace/ToolsPage'
import { PlaceholderPage } from '../features/workspace/PlaceholderPage'
import { AuthPage } from '../features/auth/AuthPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { GoogleCallbackPage } from '../features/auth/GoogleCallbackPage'
import { AdminPage } from '../features/admin/AdminPage'
import { AppLayout } from '../components/layout/AppLayout'
import { RequireUser } from '../components/auth/RequireUser'
import { useAuth } from '../lib/auth'
import { getToken } from '../lib/api'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading || (getToken() && !user)) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted">Memuat…</div>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  // Wait for the session check, otherwise an admin reload briefly looks like a non-admin.
  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted">Memuat…</div>
  if (user?.role !== 'admin') return <Navigate to="/app" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/google/done" element={<GoogleCallbackPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
        {/* `/app` is the user dashboard; an admin has no workspace, so it forwards to the panel. */}
        <Route index element={<RequireUser><DashboardPage /></RequireUser>} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="documents/:id" element={<DocumentPage />} />
        <Route path="templates" element={<ToolsPage />} />
        <Route path="templates/:category" element={<ToolsPage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="tools/:category" element={<ToolsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin/*" element={<Navigate to="/app/manajemen" replace />} />
        <Route path="manajemen" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        <Route path="manajemen/:section" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        <Route path="*" element={<PlaceholderPage />} />
      </Route>
    </Routes>
  )
}
