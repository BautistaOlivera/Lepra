export const CHART = {
  yellow: '#e6b800',
  yellowLight: '#ffe566',
  black: '#1a1a1a',
  gray: '#6c757d',
  grid: '#e5e5e5',
  pending: '#e6b800',
  fulfilled: '#2d8a4e',
  canceled: '#adb5bd',
} as const

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  })
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null
  return Math.round(((current - previous) / previous) * 100)
}
