/**
 * Formato argentino (miles con punto, decimales con coma). Solo visualización.
 *
 * No usamos Intl.NumberFormat('es-AR') para el monto: en Chrome 81 / Android 4.4
 * ICU aplica minimumGroupingDigits≈2 → 6200 se muestra "6200" y 22500 "22.500".
 * Desktop moderno sí pone "6.200". Formateamos a mano para unificar.
 */

function formatEsArAmount(amount: number): string {
  const negative = amount < 0
  const abs = Math.abs(amount)
  const rounded = Math.round(abs * 100) / 100
  const [intRaw, fracRaw = ''] = rounded.toFixed(2).split('.')
  const intGrouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const frac = fracRaw.replace(/0+$/, '')
  const body = frac ? `${intGrouped},${frac}` : intGrouped
  return negative ? `-${body}` : body
}

export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  return formatEsArAmount(amount)
}

/** Monto con símbolo $ y separadores es-AR (ej. $1.234,50). */
export function formatMoneyWithSymbol(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  return `$${formatMoney(amount)}`
}

/** Igual que formatMoneyWithSymbol (misma visualización en legacy y desktop). */
export function formatMoneyCurrency(amount: number): string {
  return formatMoneyWithSymbol(amount)
}

/** Eje de gráficos: valores grandes en miles. */
export function formatMoneyAxis(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1000) {
    return `${formatMoneyWithSymbol(value / 1000)} mil`
  }
  return formatMoneyWithSymbol(value)
}
