import type { SalesGranularity } from '@/types/salesStats'

/**
 * Rangos de fecha alineados al "Agrupar por" de estadísticas.
 * El agrupamiento actúa como extensión del selector de fechas: los rangos
 * siempre cubren períodos completos (semanas de lunes a domingo, meses y
 * años calendario) para que fechas y agrupamiento no se contradigan.
 *
 * Solo usa matemática básica de `Date` (compatible con navegadores legacy).
 */

function parseIso(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function todayUtcIso(now: Date): string {
  return iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())))
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

/**
 * Rango preset al elegir un agrupamiento (el botón funciona como atajo):
 * - Día: últimos 30 días.
 * - Semana: semana actual y las 11 anteriores (lunes a domingo).
 * - Mes: mes actual y los 11 anteriores, completos.
 * - Año: año actual y los 2 anteriores, completos.
 */
export function defaultRangeForGranularity(
  granularity: SalesGranularity,
  now: Date = new Date()
): { from: string; to: string } {
  const today = todayUtcIso(now)
  const d = parseIso(today)!

  if (granularity === 'week') {
    const from = parseIso(periodStart(today, 'week'))!
    from.setUTCDate(from.getUTCDate() - 7 * 11)
    return { from: iso(from), to: periodEnd(today, 'week') }
  }
  if (granularity === 'month') {
    const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1))
    return { from: iso(from), to: periodEnd(today, 'month') }
  }
  if (granularity === 'year') {
    return {
      from: iso(new Date(Date.UTC(d.getUTCFullYear() - 2, 0, 1))),
      to: iso(new Date(Date.UTC(d.getUTCFullYear(), 11, 31))),
    }
  }
  const from = new Date(d)
  from.setUTCDate(from.getUTCDate() - 29)
  return { from: iso(from), to: today }
}
