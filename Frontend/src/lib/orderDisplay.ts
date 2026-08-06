import type { Order, OrderPayment } from '@/types'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'

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

export function orderAmountPaid(order: Pick<Order, 'amount_paid' | 'payments'>): number {
  if (typeof order.amount_paid === 'number' && Number.isFinite(order.amount_paid)) {
    return Math.round(order.amount_paid * 100) / 100
  }
  const payments = order.payments || []
  return Math.round(payments.reduce((s, p) => s + Number(p.amount || 0), 0) * 100) / 100
}

export function orderBalance(
  order: Pick<Order, 'total' | 'amount_paid' | 'payments' | 'balance' | 'status'>
): number {
  if ((order.status || '').toUpperCase() === 'FULFILLED') return 0
  if (typeof order.balance === 'number' && Number.isFinite(order.balance)) {
    return Math.max(0, Math.round(order.balance * 100) / 100)
  }
  const paid = orderAmountPaid(order)
  return Math.max(0, Math.round((Number(order.total || 0) - paid) * 100) / 100)
}

/** Monto a mostrar como pagado (en cumplido se asume cobrado el total). */
export function orderDisplayPaid(
  order: Pick<Order, 'total' | 'amount_paid' | 'payments' | 'status'>
): number {
  const paid = orderAmountPaid(order)
  if ((order.status || '').toUpperCase() === 'FULFILLED') {
    return Math.max(paid, Math.round(Number(order.total || 0) * 100) / 100)
  }
  return paid
}

/** Texto corto de saldo para tiles/lista. Siempre muestra saldo restante para feedback visual. */
export function orderBalancePreview(
  order: Pick<Order, 'total' | 'amount_paid' | 'payments' | 'balance' | 'payment' | 'status'>
): string {
  if ((order.status || '').toUpperCase() === 'FULFILLED') return 'Al día'
  const balance = orderBalance(order)
  if (balance <= 0.009) return 'Al día'
  return `Saldo restante ${formatMoneyWithSymbol(balance)}`
}

export function paymentMethodLabel(method: string | null | undefined): string {
  const key = (method || '').toLowerCase()
  if (key === 'efectivo') return 'Efectivo'
  if (key === 'transferencia') return 'Transferencia'
  if (key === 'cheque') return 'Cheque'
  if (key === 'otro') return 'Otro'
  return method || 'Pago'
}

export function withPaymentSummary(
  order: Order,
  payments: OrderPayment[],
  amountPaid?: number,
  balance?: number
): Order {
  const paid =
    typeof amountPaid === 'number'
      ? amountPaid
      : Math.round(payments.reduce((s, p) => s + Number(p.amount || 0), 0) * 100) / 100
  const fulfilled = (order.status || '').toUpperCase() === 'FULFILLED'
  const bal = fulfilled
    ? 0
    : typeof balance === 'number'
      ? balance
      : Math.max(0, Math.round((Number(order.total || 0) - paid) * 100) / 100)
  return { ...order, payments, amount_paid: paid, balance: bal }
}
