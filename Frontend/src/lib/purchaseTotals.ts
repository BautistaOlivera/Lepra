/** Total de abastecimiento en el cliente. El servidor vuelve a calcularlo al guardar. */

export function lineAmount(weight: number, pricePerKg: number): number {
  return Math.round(weight * pricePerKg * 100) / 100
}

export function pricePerKgFromAmount(weight: number, amount: number): number {
  if (!(weight > 0)) return 0
  return amount / weight
}

export function purchaseTotal(lineAmounts: number[], unitemized: number): number {
  const extra = Number.isFinite(unitemized) ? unitemized : 0
  const sum = lineAmounts.reduce((acc, n) => acc + n, 0) + extra
  return Math.round(sum * 100) / 100
}

/** Precio de compra con hasta 6 decimales, para que kilos × precio recupere el importe. */
export function formatUnitDraft(value: number): string {
  if (!Number.isFinite(value)) return ''
  return value.toFixed(6).replace(/\.?0+$/, '')
}

export function formatAmountDraft(value: number): string {
  if (!Number.isFinite(value)) return ''
  return (Math.round(value * 100) / 100).toFixed(2)
}

export function parsePurchasePrice(
  raw: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim().replace(',', '.')
  if (!trimmed) return { ok: false, message: 'Precio inválido' }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false, message: 'Precio inválido' }
  const [, decimals] = trimmed.split('.')
  if (decimals && decimals.length > 6) return { ok: false, message: 'Máximo 6 decimales' }
  const value = parseFloat(trimmed)
  if (!Number.isFinite(value) || value < 0) return { ok: false, message: 'Precio inválido' }
  return { ok: true, value }
}
