import type { Order } from '@/types'

/** Nombre del cliente en listas, PDF y modales. */
export function orderCustomerLabel(order: Pick<Order, 'user_name' | 'customer_name' | 'id_user'>): string {
  const name = (order.user_name || order.customer_name || '').trim()
  if (name) return name
  if (order.id_user != null && order.id_user > 0) return `Cliente #${order.id_user}`
  return 'Sin cliente'
}

/** Resumen corto de productos del pedido para cards. */
export function orderLinesPreview(order: Pick<Order, 'lines'>, maxNames = 2): string {
  const lines = order.lines || []
  if (!lines.length) return 'Sin productos'
  const names = lines.map((l) => {
    const n = (l.product_name || '').trim()
    return n || `Producto #${l.id_product}`
  })
  if (names.length <= maxNames) return names.join(' · ')
  return `${names.slice(0, maxNames).join(' · ')} +${names.length - maxNames}`
}

/** Primera línea de notas de pago, compacta. */
export function orderPaymentPreview(payment: string | null | undefined, maxLen = 48): string | null {
  const raw = (payment || '').trim()
  if (!raw) return null
  const oneLine = raw.replace(/\s+/g, ' ')
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, Math.max(1, maxLen - 1))}…`
}
