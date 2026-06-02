/** Formato numérico argentino (miles con punto, decimales con coma). Solo visualización. */
const arsAmount = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const arsCurrency = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  return arsAmount.format(amount)
}

/** Monto con símbolo $ y separadores es-AR (ej. $1.234,50). */
export function formatMoneyWithSymbol(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  return `$${formatMoney(amount)}`
}

/** Igual que formatMoney pero con estilo moneda del locale (espacio opcional tras $). */
export function formatMoneyCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  return arsCurrency.format(amount)
}

/** Eje de gráficos: valores grandes en miles. */
export function formatMoneyAxis(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1000) {
    return `${formatMoneyWithSymbol(value / 1000)} mil`
  }
  return formatMoneyWithSymbol(value)
}
