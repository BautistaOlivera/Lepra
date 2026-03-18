import { isOnlineNow } from '@/offline/network'
import { isAdminUser } from '@/offline/admin'

// Permite entrar offline al admin si hubo login online "reciente".
// Ajustable según necesidad.
export const OFFLINE_ADMIN_GRACE_MS = 7 * 24 * 60 * 60 * 1000 // 7 días

export function markOnlineAuth() {
  try {
    localStorage.setItem('lepra_lastOnlineAuthAt', String(Date.now()))
    localStorage.removeItem('lepra_auth_required')
  } catch {
    // ignore
  }
}

export function isOfflineAdminGraceAllowed(): boolean {
  if (isOnlineNow()) return false
  if (!isAdminUser()) return false
  const token = localStorage.getItem('lepra_token')
  if (!token) return false
  const last = Number(localStorage.getItem('lepra_lastOnlineAuthAt') || '0')
  if (!Number.isFinite(last) || last <= 0) return false
  return Date.now() - last <= OFFLINE_ADMIN_GRACE_MS
}

export function isAuthRequiredFlagSet(): boolean {
  try {
    return localStorage.getItem('lepra_auth_required') === '1'
  } catch {
    return false
  }
}

