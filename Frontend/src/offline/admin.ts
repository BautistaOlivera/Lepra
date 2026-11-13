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

export function isEmployeeUser(): boolean {
  const u = getStoredUser()
  return (u?.rol || '').toUpperCase() === 'EMPLOYEE'
}

/** Admin o empleado: entran al panel y sincronizan clientes, productos y pedidos. */
export function isStaffUser(): boolean {
  const rol = (getStoredUser()?.rol || '').toUpperCase()
  return rol === 'ADMIN' || rol === 'EMPLOYEE'
}

