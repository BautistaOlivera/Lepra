import { lepraDb } from './db'
import { getStoredUser } from './admin'

const SESSION_USER_KEY = 'lepra_session_user_id'

/** Si entra otro usuario, borra pedidos, clientes, sueldos y la cola del anterior. */
export async function resetLocalSessionIfUserChanged(userId: number): Promise<void> {
  let prev: string | null = null
  try {
    prev = localStorage.getItem(SESSION_USER_KEY)
  } catch {
    prev = null
  }
  if (!prev) {
    const stored = getStoredUser()
    if (stored?.id != null) prev = String(stored.id)
  }
  const next = String(userId)
  if (prev && prev !== next) {
    await Promise.all([
      lepraDb.orders.clear(),
      lepraDb.users.clear(),
      lepraDb.salaryMonths.clear(),
      lepraDb.outbox.clear(),
      lepraDb.idmap.clear(),
    ])
    await lepraDb.meta.bulkDelete(['users_lastSync', 'orders_lastSync', 'salaries_lastSync'])
  }
  try {
    localStorage.setItem(SESSION_USER_KEY, next)
  } catch {
    // ignore
  }
}
