/** Textos de conexión y sincronización para el dueño (panel admin). */

export const CONEXION_EN_LINEA = 'Con conexión'
export const CONEXION_SIN = 'Sin conexión'
export const MENSAJE_SIN_CONEXION = 'Sin conexión a internet'

const SYNC_ENTITY_ES: Record<string, string> = {
  user: 'cliente',
  product: 'producto',
  order: 'pedido',
}

/** Errores guardados en cola o repos → español legible en UI. */
export function formatErrorParaUsuario(message: string | undefined | null): string {
  if (!message?.trim()) return ''
  const m = message.trim()
  if (m === 'Offline') return CONEXION_SIN

  const legacy = m.match(/^Esperando sync de (\w+) \((-?\d+)\)/i)
  if (legacy) {
    const entity = SYNC_ENTITY_ES[legacy[1].toLowerCase()] ?? legacy[1]
    return `Esperando sincronización de ${entity} (${legacy[2]})`
  }

  return m
}

export function esErrorDependenciaSincronizacion(message: string | undefined | null): boolean {
  const low = (message || '').toLowerCase()
  return low.startsWith('esperando sync') || low.startsWith('esperando sincronización')
}
