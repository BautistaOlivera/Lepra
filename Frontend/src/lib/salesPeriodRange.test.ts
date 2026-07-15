import { describe, expect, it } from 'vitest'
import { periodStart, periodEnd, defaultRangeForGranularity } from './salesPeriodRange'

describe('periodStart', () => {
  it('día: devuelve el mismo día', () => {
    expect(periodStart('2026-07-15', 'day')).toBe('2026-07-15')
  })

  it('semana: lleva al lunes de esa semana', () => {
    // 2026-07-15 es miércoles → lunes 2026-07-13
    expect(periodStart('2026-07-15', 'week')).toBe('2026-07-13')
    // Un lunes queda igual
    expect(periodStart('2026-07-13', 'week')).toBe('2026-07-13')
    // Un domingo va al lunes anterior
    expect(periodStart('2026-07-19', 'week')).toBe('2026-07-13')
  })

  it('mes: lleva al día 1', () => {
    expect(periodStart('2026-07-15', 'month')).toBe('2026-07-01')
  })

  it('año: lleva al 1 de enero', () => {
    expect(periodStart('2026-07-15', 'year')).toBe('2026-01-01')
  })

  it('valor inválido: lo devuelve sin tocar', () => {
    expect(periodStart('', 'month')).toBe('')
  })
})

describe('periodEnd', () => {
  it('día: devuelve el mismo día', () => {
    expect(periodEnd('2026-07-15', 'day')).toBe('2026-07-15')
  })

  it('semana: lleva al domingo de esa semana', () => {
    expect(periodEnd('2026-07-15', 'week')).toBe('2026-07-19')
    expect(periodEnd('2026-07-19', 'week')).toBe('2026-07-19')
  })

  it('mes: lleva al último día del mes (incluye febrero bisiesto)', () => {
    expect(periodEnd('2026-07-15', 'month')).toBe('2026-07-31')
    expect(periodEnd('2026-02-10', 'month')).toBe('2026-02-28')
    expect(periodEnd('2028-02-10', 'month')).toBe('2028-02-29')
  })

  it('año: lleva al 31 de diciembre', () => {
    expect(periodEnd('2026-07-15', 'year')).toBe('2026-12-31')
  })
})

describe('defaultRangeForGranularity', () => {
  const now = new Date(Date.UTC(2026, 6, 15)) // miércoles 15/07/2026

  it('día: últimos 30 días', () => {
    expect(defaultRangeForGranularity('day', now)).toEqual({
      from: '2026-06-16',
      to: '2026-07-15',
    })
  })

  it('semana: 12 semanas completas terminando en la semana actual', () => {
    const r = defaultRangeForGranularity('week', now)
    expect(r).toEqual({ from: '2026-04-27', to: '2026-07-19' })
    // Bordes alineados: lunes y domingo
    expect(periodStart(r.from, 'week')).toBe(r.from)
    expect(periodEnd(r.to, 'week')).toBe(r.to)
  })

  it('mes: 12 meses calendario completos', () => {
    expect(defaultRangeForGranularity('month', now)).toEqual({
      from: '2025-08-01',
      to: '2026-07-31',
    })
  })

  it('mes: no desborda desde fin de mes (31 de enero)', () => {
    const jan31 = new Date(Date.UTC(2026, 0, 31))
    expect(defaultRangeForGranularity('month', jan31)).toEqual({
      from: '2025-02-01',
      to: '2026-01-31',
    })
  })

  it('año: 3 años calendario completos', () => {
    expect(defaultRangeForGranularity('year', now)).toEqual({
      from: '2024-01-01',
      to: '2026-12-31',
    })
  })
})
