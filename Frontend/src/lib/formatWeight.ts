const weightFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

export function hasWeight(weight: number | null | undefined): weight is number {
  return weight != null && Number.isFinite(weight)
}

export function formatWeight(weight: number | null | undefined): string {
  if (weight == null || !Number.isFinite(weight)) return '—'
  return `${weightFormatter.format(weight)} kg`
}

export function parseWeightInput(
  raw: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const trimmed = raw.trim().replace(',', '.')
  if (!trimmed) return { ok: true, value: null }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false, message: 'Peso inválido' }
  const [, decimals] = trimmed.split('.')
  if (decimals && decimals.length > 3) return { ok: false, message: 'Máximo 3 decimales' }
  const value = parseFloat(trimmed)
  if (!Number.isFinite(value) || value < 0) return { ok: false, message: 'Peso inválido' }
  return { ok: true, value }
}
