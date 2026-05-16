export type OrderStatusKey = 'PENDING' | 'FULFILLED' | 'CANCELED'

/** Unifica variantes legacy (p. ej. CANCELLED del seed) al estado canónico CANCELED. */
export function normalizeOrderStatus(status: string | null | undefined): OrderStatusKey {
  const s = (status || 'PENDING').toUpperCase()
  if (s === 'CANCELLED' || s === 'CANCELED') return 'CANCELED'
  if (s === 'FULFILLED') return 'FULFILLED'
  return 'PENDING'
}

export function isCanceledStatus(status: string | null | undefined): boolean {
  return normalizeOrderStatus(status) === 'CANCELED'
}

export const ORDER_STATUS_LABELS: Record<OrderStatusKey, string> = {
  PENDING: 'Pendiente',
  FULFILLED: 'Cumplido',
  CANCELED: 'Cancelado',
}

export function mergeStatusBreakdown(
  breakdown: Record<string, number>
): Record<OrderStatusKey, number> {
  const merged: Record<OrderStatusKey, number> = { PENDING: 0, FULFILLED: 0, CANCELED: 0 }
  for (const [key, value] of Object.entries(breakdown)) {
    merged[normalizeOrderStatus(key)] += value
  }
  return merged
}
