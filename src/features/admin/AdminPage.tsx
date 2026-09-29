import { useLocation, useNavigate } from 'react-router-dom'
import { AdminPanel } from './AdminPanel'
import { ADMIN_NAV, DEFAULT_ADMIN_TAB, adminPath } from './adminNav'
import type { AdminTab } from './adminTabs'

const TAB_IDS = ADMIN_NAV.map((item) => item.id)

/**
 * Administrator area, mounted directly under the app shell (`/app/manajemen`,
 * `/app/manajemen/users`, …) so each section is its own URL and a reload keeps you in place.
 */
export function AdminPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const segment = pathname.replace(/^\/app\/manajemen\/?/, '').split('/')[0]
  const tab: AdminTab = TAB_IDS.includes(segment as AdminTab) ? (segment as AdminTab) : DEFAULT_ADMIN_TAB

  return <AdminPanel tab={tab} onTab={(next) => navigate(adminPath(next))} />
}
