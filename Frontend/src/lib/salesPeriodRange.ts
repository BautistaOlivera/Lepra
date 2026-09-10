import type { SalesGranularity } from '@/types/salesStats'

/**
 * Rangos de fecha alineados al tipo de período de estadísticas.
 * Los rangos siempre cubren períodos completos (semanas de lunes a domingo,
 * meses y años calendario) para que fechas y agrupamiento no se contradigan.
 *
 * "Hoy" usa el calendario local (mismo criterio que el date picker), no UTC.
 * La aritmética sobre `YYYY-MM-DD` trata la fecha como calendario puro.
 *
 * Solo usa matemática básica de `Date` (compatible con navegadores legacy).
 */

export type SalesPeriodPresetId =
  | 'today'
  | 'yesterday'
  | 'day_before_yesterday'
  | 'this_week'
  | 'last_week'
  | 'week_before_last'
  | 'this_month'
  | 'last_month'
  | 'month_before_last'
  | 'this_year'
  | 'last_year'
  | 'custom'

export type NamedSalesPeriodPresetId = Exclude<SalesPeriodPresetId, 'custom'>

export type SalesPeriodRange = {
  from: string
  to: string
  granularity: SalesGranularity
}

export type SalesPeriodPreset = {
  id: NamedSalesPeriodPresetId
  label: string
  granularity: SalesGranularity
}

export const CUSTOM_PERIOD_PRESET_ID = 'custom' as const
export const CUSTOM_PERIOD_PRESET_LABEL = 'Personalizado'
export const DEFAULT_PERIOD_PRESET_ID: NamedSalesPeriodPresetId = 'this_week'

export const PERIOD_PRESETS: SalesPeriodPreset[] = [
  { id: 'today', label: 'Hoy', granularity: 'day' },
  { id: 'yesterday', label: 'Ayer', granularity: 'day' },
  { id: 'day_before_yesterday', label: 'Anteayer', granularity: 'day' },
  { id: 'this_week', label: 'Esta semana', granularity: 'week' },
  { id: 'last_week', label: 'Semana pasada', granularity: 'week' },
  { id: 'week_before_last', label: 'Hace 2 semanas', granularity: 'week' },
  { id: 'this_month', label: 'Este mes', granularity: 'month' },
  { id: 'last_month', label: 'Mes pasado', granularity: 'month' },
  { id: 'month_before_last', label: 'Hace 2 meses', granularity: 'month' },
  { id: 'this_year', label: 'Este año', granularity: 'year' },
  { id: 'last_year', label: 'Año pasado', granularity: 'year' },
]

const CURRENT_PRESET_BY_GRANULARITY: Record<SalesGranularity, NamedSalesPeriodPresetId> = {
  day: 'today',
  week: 'this_week',
  month: 'this_month',
  year: 'this_year',
}

const PRESET_OFFSET: Record<NamedSalesPeriodPresetId, { granularity: SalesGranularity; offset: number }> = {
  today: { granularity: 'day', offset: 0 },
  yesterday: { granularity: 'day', offset: -1 },
  day_before_yesterday: { granularity: 'day', offset: -2 },
  this_week: { granularity: 'week', offset: 0 },
  last_week: { granularity: 'week', offset: -1 },
  week_before_last: { granularity: 'week', offset: -2 },
  this_month: { granularity: 'month', offset: 0 },
  last_month: { granularity: 'month', offset: -1 },
  month_before_last: { granularity: 'month', offset: -2 },
  this_year: { granularity: 'year', offset: 0 },
  last_year: { granularity: 'year', offset: -1 },
}

function parseIso(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Día calendario local de `now` (coincide con el date picker, no con UTC). */
export function todayLocalIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Lleva un día al inicio de su período (lunes / día 1 / 1 de enero). */
export function periodStart(isoDay: string, granularity: SalesGranularity): string {
  const d = parseIso(isoDay)
  if (!d) return isoDay
  if (granularity === 'week') {
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    return iso(d)
  }
  if (granularity === 'month') {
    return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)))
  }
  if (granularity === 'year') {
    return iso(new Date(Date.UTC(d.getUTCFullYear(), 0, 1)))
  }
  return iso(d)
}

/** Lleva un día al fin de su período (domingo / último día del mes / 31 de diciembre). */
export function periodEnd(isoDay: string, granularity: SalesGranularity): string {
  const d = parseIso(isoDay)
  if (!d) return isoDay
  if (granularity === 'week') {
    d.setUTCDate(d.getUTCDate() + (6 - ((d.getUTCDay() + 6) % 7)))
    return iso(d)
  }
  if (granularity === 'month') {
    // Día 0 del mes siguiente = último día del mes actual.
    return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))
  }
  if (granularity === 'year') {
    return iso(new Date(Date.UTC(d.getUTCFullYear(), 11, 31)))
  }
  return iso(d)
}

export function presetsForGranularity(granularity: SalesGranularity): SalesPeriodPreset[] {
  return PERIOD_PRESETS.filter((p) => p.granularity === granularity)
}

export function currentPresetId(granularity: SalesGranularity): NamedSalesPeriodPresetId {
  return CURRENT_PRESET_BY_GRANULARITY[granularity]
}

function shiftPeriod(todayIso: string, granularity: SalesGranularity, offset: number): { from: string; to: string } {
  const start = periodStart(todayIso, granularity)
  const d = parseIso(start)
  if (!d) return { from: start, to: periodEnd(todayIso, granularity) }

  if (granularity === 'day') d.setUTCDate(d.getUTCDate() + offset)
  else if (granularity === 'week') d.setUTCDate(d.getUTCDate() + offset * 7)
  else if (granularity === 'month') d.setUTCMonth(d.getUTCMonth() + offset)
  else d.setUTCFullYear(d.getUTCFullYear() + offset)

  const day = iso(d)
  return { from: periodStart(day, granularity), to: periodEnd(day, granularity) }
}

export function rangeForPreset(
  id: NamedSalesPeriodPresetId,
  now: Date = new Date()
): SalesPeriodRange {
  const spec = PRESET_OFFSET[id]
  const { from, to } = shiftPeriod(todayLocalIso(now), spec.granularity, spec.offset)
  return { from, to, granularity: spec.granularity }
}

/**
 * Preset de un solo período al elegir el tipo (Día → Hoy, Semana → Esta semana, …).
 */
export function defaultRangeForGranularity(
  granularity: SalesGranularity,
  now: Date = new Date()
): { from: string; to: string } {
  const r = rangeForPreset(currentPresetId(granularity), now)
  return { from: r.from, to: r.to }
}

/** Carga inicial y reset: esta semana. */
export function defaultSalesPeriod(now: Date = new Date()): SalesPeriodRange {
  return rangeForPreset(DEFAULT_PERIOD_PRESET_ID, now)
}

export function matchPreset(
  from: string,
  to: string,
  granularity: SalesGranularity,
  now: Date = new Date()
): SalesPeriodPresetId {
  if (!from || !to) return CUSTOM_PERIOD_PRESET_ID
  for (const preset of presetsForGranularity(granularity)) {
    const r = rangeForPreset(preset.id, now)
    if (r.from === from && r.to === to) return preset.id
  }
  return CUSTOM_PERIOD_PRESET_ID
}
