import type { Order } from '@/types'

/** Nombre del cliente en listas, PDF y modales. */
export function orderCustomerLabel(order: Pick<Order, 'user_name' | 'customer_name' | 'id_user'>): string {
  const name = (order.user_name || order.customer_name || '').trim()
  if (name) return name
  if (order.id_user != null && order.id_user > 0) return `Cliente #${order.id_user}`
  return 'Sin cliente'
}
