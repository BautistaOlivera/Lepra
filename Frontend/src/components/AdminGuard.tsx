import { Navigate } from 'react-router-dom'
import { isOfflineAdminGraceAllowed } from '@/offline/authGrace'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const userStr = localStorage.getItem('lepra_user')
  if (!userStr) {
    if (isOfflineAdminGraceAllowed()) return <>{children}</>
    return <Navigate to="/login" replace />
  }
  const user = JSON.parse(userStr)
  if (user.rol !== 'ADMIN') return <Navigate to="/" replace />
  return <>{children}</>
}
