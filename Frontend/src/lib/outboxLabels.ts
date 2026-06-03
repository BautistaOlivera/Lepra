import type { OutboxCommandType, OutboxRow } from '@/offline/db'

/** Texto para el dueño / admin no técnico (lista de pendientes). */
export const OUTBOX_TYPE_LABELS: Record<OutboxCommandType, string> = {
  USER_CREATE: 'Crear cliente',
  USER_UPDATE: 'Editar cliente',
  USER_DEACTIVATE: 'Desactivar cliente',
  PRODUCT_CREATE: 'Crear producto',
  PRODUCT_UPDATE: 'Editar producto',
  PRODUCT_DEACTIVATE: 'Desactivar producto',
  PRODUCT_TIERS_SYNC: 'Precios por volumen',
  ORDER_CREATE_ADMIN: 'Crear pedido',
  ORDER_STATUS_SET: 'Cambiar estado del pedido',
  ORDER_PAYMENT_UPDATE: 'Actualizar pago del pedido',
}

export function outboxTypeLabel(type: OutboxCommandType): string {
  return OUTBOX_TYPE_LABELS[type] ?? type
}

/** Una línea: código (acción legible). */
export function formatOutboxType(type: OutboxCommandType): string {
  const label = outboxTypeLabel(type)
  return `${type} (${label})`
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  FULFILLED: 'Cumplido',
  CANCELED: 'Cancelado',
}

export function outboxPayloadSummary(r: OutboxRow): string {
  const p: any = r.payload
  if (!p) return ''

  switch (r.type) {
    case 'USER_CREATE':
      return p?.data?.email ? `Cliente: ${p.data.email}` : ''
    case 'USER_UPDATE':
      return p?.id != null ? `Cliente n.º ${p.id}` : ''
    case 'USER_DEACTIVATE':
      return p?.id != null ? `Cliente n.º ${p.id}` : ''
    case 'PRODUCT_CREATE': {
      const name = p?.data?.name
      const tiers = Array.isArray(p?.tiers) ? p.tiers.length : 0
      const parts = [name ? `Producto: ${name}` : '', tiers > 0 ? `${tiers} precio(s) por volumen` : ''].filter(Boolean)
      return parts.join(' · ')
    }
    case 'PRODUCT_UPDATE':
      return p?.id != null ? `Producto n.º ${p.id}` : ''
    case 'PRODUCT_DEACTIVATE':
      return p?.id != null ? `Producto n.º ${p.id}` : ''
    case 'PRODUCT_TIERS_SYNC': {
      const parts = [
        p?.id != null ? `Producto n.º ${p.id}` : '',
        p?.create?.length ? `${p.create.length} nuevo(s)` : '',
        p?.update?.length ? `${p.update.length} editado(s)` : '',
        p?.delete?.length ? `${p.delete.length} eliminado(s)` : '',
        p?.has_tiered_pricing === false ? 'volumen desactivado' : '',
      ].filter(Boolean)
      return parts.join(' · ')
    }
    case 'ORDER_CREATE_ADMIN': {
      const lines = p?.data?.lines?.length ?? 0
      const guest = (p?.data?.customer_name && String(p.data.customer_name).trim()) || ''
      const user = p?.data?.id_user
      const client =
        guest || (user != null && Number(user) !== 0 ? `Cliente n.º ${user}` : '')
      return [client, lines ? `${lines} línea(s)` : ''].filter(Boolean).join(' · ')
    }
    case 'ORDER_STATUS_SET': {
      if (p?.id == null) return ''
      const st = ORDER_STATUS_LABELS[String(p.status)] ?? p.status
      return `Pedido n.º ${p.id} → ${st}`
    }
    case 'ORDER_PAYMENT_UPDATE':
      return p?.id != null ? `Pedido n.º ${p.id} (notas de pago)` : ''
    default:
      return ''
  }
}
