import type { AuthUser } from '@/types'

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('lepra_user')
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function isAdminUser(): boolean {
  const u = getStoredUser()
  return (u?.rol || '').toUpperCase() === 'ADMIN'
}

