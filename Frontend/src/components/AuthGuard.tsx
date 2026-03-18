import { Navigate, useLocation } from 'react-router-dom'
import { isOfflineAdminGraceAllowed } from '@/offline/authGrace'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('lepra_token')
  const location = useLocation()

  if (!token) {
    // Admin offline grace: permite entrar al panel aunque no puedas re-loguear offline
    if (isOfflineAdminGraceAllowed()) {
      return <>{children}</>
    }
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
