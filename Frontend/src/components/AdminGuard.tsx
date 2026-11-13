import { Navigate } from 'react-router-dom'
import { isOfflineAdminGraceAllowed } from '@/offline/authGrace'
import { isStaffUser } from '@/offline/admin'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const userStr = localStorage.getItem('lepra_user')
  if (!userStr) {
    if (isOfflineAdminGraceAllowed()) return <>{children}</>
    return <Navigate to="/login" replace />
  }
  if (!isStaffUser()) return <Navigate to="/" replace />
  return <>{children}</>
}
