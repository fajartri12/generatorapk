import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../../lib/auth'
import { ADMIN_NAV } from './adminNav'
import type { AdminTab } from './adminTabs'
import { AdminAuditTab } from './AdminAuditTab'
import { AdminBankTab } from './AdminBankTab'
import { AdminCostsTab } from './AdminCostsTab'
import { AdminGatewayOrdersTab } from './AdminGatewayOrdersTab'
import { AdminGenerationsTab } from './AdminGenerationsTab'
import { AdminOverviewTab } from './AdminOverviewTab'
import { AdminPaymentsTab } from './AdminPaymentsTab'
import { AdminProjectsTab } from './AdminProjectsTab'
import { AdminUsersTab } from './AdminUsersTab'

export function AdminPanel({ tab, onTab }: { tab: AdminTab; onTab: (tab: AdminTab) => void }) {
  const { user } = useAuth()
  const section = ADMIN_NAV.find((item) => item.id === tab) ?? ADMIN_NAV[0]

  return (
    <div className={`mx-auto w-full ${section.width === 'wide' ? 'max-w-6xl' : 'max-w-[1440px]'}`}>
        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">Manajemen</Badge>
            <Badge tone="neutral">{section.label}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">{section.label}</h1>
          <p className="mt-1 max-w-2xl text-muted">
            {section.desc} Anda masuk sebagai <span className="font-medium text-foreground">{user?.name}</span>.
          </p>
        </header>

        {tab === 'overview' && <AdminOverviewTab onOpenTab={(next) => onTab(next as AdminTab)} />}
        {tab === 'users' && <AdminUsersTab />}
        {tab === 'projects' && <AdminProjectsTab />}
        {tab === 'generations' && <AdminGenerationsTab />}
        {tab === 'payments' && <AdminPaymentsTab />}
        {tab === 'gateway' && <AdminGatewayOrdersTab />}
        {tab === 'costs' && <AdminCostsTab />}
        {tab === 'bank' && <AdminBankTab />}
        {tab === 'audit' && <AdminAuditTab />}
    </div>
  )
}

/** Shown when an admin token is valid but the admin endpoints reject the request. */
export function AdminDenied() {
  return (
    <Card>
      <p className="text-sm text-danger">
        Tidak dapat memuat data administrator. Pastikan akun Anda masih memiliki role admin, lalu muat ulang halaman.
      </p>
    </Card>
  )
}
