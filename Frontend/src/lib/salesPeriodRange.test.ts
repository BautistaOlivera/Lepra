import { describe, expect, it } from 'vitest'
import {
  periodStart,
  periodEnd,
  defaultRangeForGranularity,
  defaultSalesPeriod,
  defaultChartPeriod,
  matchPreset,
  matchChartPreset,
  rangeForPreset,
  rangeForChartPreset,
  todayLocalIso,
} from './salesPeriodRange'

/** Miércoles 15/07/2026 mediodía local (evita corrimientos UTC). */
const NOW = new Date(2026, 6, 15, 12, 0, 0)

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

describe('todayLocalIso', () => {
  it('usa el calendario local, no UTC', () => {
    expect(todayLocalIso(NOW)).toBe('2026-07-15')
  })
})

describe('rangeForPreset', () => {
  it('día: hoy, ayer y anteayer son un solo día', () => {
    expect(rangeForPreset('today', NOW)).toEqual({
      from: '2026-07-15',
      to: '2026-07-15',
      granularity: 'day',
    })
    expect(rangeForPreset('yesterday', NOW)).toEqual({
      from: '2026-07-14',
      to: '2026-07-14',
      granularity: 'day',
    })
    expect(rangeForPreset('day_before_yesterday', NOW)).toEqual({
      from: '2026-07-13',
      to: '2026-07-13',
      granularity: 'day',
    })
  })

  it('semana: esta, pasada y hace 2 son lunes–domingo de un solo período', () => {
    expect(rangeForPreset('this_week', NOW)).toEqual({
      from: '2026-07-13',
      to: '2026-07-19',
      granularity: 'week',
    })
    expect(rangeForPreset('last_week', NOW)).toEqual({
      from: '2026-07-06',
      to: '2026-07-12',
      granularity: 'week',
    })
    expect(rangeForPreset('week_before_last', NOW)).toEqual({
      from: '2026-06-29',
      to: '2026-07-05',
      granularity: 'week',
    })
  })

  it('mes: este, pasado y hace 2 son un mes calendario', () => {
    expect(rangeForPreset('this_month', NOW)).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
      granularity: 'month',
    })
    expect(rangeForPreset('last_month', NOW)).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
      granularity: 'month',
    })
    expect(rangeForPreset('month_before_last', NOW)).toEqual({
      from: '2026-05-01',
      to: '2026-05-31',
      granularity: 'month',
    })
  })

  it('mes pasado no desborda desde el 31 de enero', () => {
    const jan31 = new Date(2026, 0, 31, 12, 0, 0)
    expect(rangeForPreset('this_month', jan31)).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      granularity: 'month',
    })
    expect(rangeForPreset('last_month', jan31)).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
      granularity: 'month',
    })
  })

  it('año: este y pasado son un año calendario', () => {
    expect(rangeForPreset('this_year', NOW)).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
      granularity: 'year',
    })
    expect(rangeForPreset('last_year', NOW)).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
      granularity: 'year',
    })
  })
})

describe('defaultRangeForGranularity', () => {
  it('día: solo hoy (un período)', () => {
    expect(defaultRangeForGranularity('day', NOW)).toEqual({
      from: '2026-07-15',
      to: '2026-07-15',
    })
  })

  it('semana: solo la semana actual, lunes a domingo', () => {
    const r = defaultRangeForGranularity('week', NOW)
    expect(r).toEqual({ from: '2026-07-13', to: '2026-07-19' })
    expect(periodStart(r.from, 'week')).toBe(r.from)
    expect(periodEnd(r.to, 'week')).toBe(r.to)
  })

  it('mes: solo el mes calendario actual', () => {
    expect(defaultRangeForGranularity('month', NOW)).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    })
  })

  it('mes: no desborda desde fin de mes (31 de enero)', () => {
    const jan31 = new Date(2026, 0, 31, 12, 0, 0)
    expect(defaultRangeForGranularity('month', jan31)).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    })
  })

  it('año: solo el año calendario actual', () => {
    expect(defaultRangeForGranularity('year', NOW)).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    })
  })
})

describe('defaultSalesPeriod', () => {
  it('carga inicial: esta semana', () => {
    expect(defaultSalesPeriod(NOW)).toEqual({
      from: '2026-07-13',
      to: '2026-07-19',
      granularity: 'week',
    })
  })
})

describe('matchPreset', () => {
  it('reconoce presets del tipo activo', () => {
    expect(matchPreset('2026-07-15', '2026-07-15', 'day', NOW)).toBe('today')
    expect(matchPreset('2026-07-14', '2026-07-14', 'day', NOW)).toBe('yesterday')
    expect(matchPreset('2026-07-13', '2026-07-19', 'week', NOW)).toBe('this_week')
    expect(matchPreset('2026-07-06', '2026-07-12', 'week', NOW)).toBe('last_week')
    expect(matchPreset('2026-07-01', '2026-07-31', 'month', NOW)).toBe('this_month')
    expect(matchPreset('2026-01-01', '2026-12-31', 'year', NOW)).toBe('this_year')
  })

  it('rango que no coincide → personalizado', () => {
    expect(matchPreset('2026-07-01', '2026-07-19', 'week', NOW)).toBe('custom')
    expect(matchPreset('2026-07-13', '2026-07-19', 'day', NOW)).toBe('custom')
  })

  it('fechas vacías → personalizado', () => {
    expect(matchPreset('', '2026-07-19', 'week', NOW)).toBe('custom')
    expect(matchPreset('2026-07-13', '', 'week', NOW)).toBe('custom')
  })
})

describe('rangeForChartPreset', () => {
  it('día: últimos 7 / 15 / 30 cubren varios días hasta hoy', () => {
    expect(rangeForChartPreset('last_7_days', NOW)).toEqual({
      from: '2026-07-09',
      to: '2026-07-15',
      granularity: 'day',
    })
    expect(rangeForChartPreset('last_15_days', NOW)).toEqual({
      from: '2026-07-01',
      to: '2026-07-15',
      granularity: 'day',
    })
    expect(rangeForChartPreset('last_30_days', NOW)).toEqual({
      from: '2026-06-16',
      to: '2026-07-15',
      granularity: 'day',
    })
  })

  it('semana: 4 / 12 semanas completas lunes–domingo', () => {
    expect(rangeForChartPreset('last_4_weeks', NOW)).toEqual({
      from: '2026-06-22',
      to: '2026-07-19',
      granularity: 'week',
    })
    expect(rangeForChartPreset('last_12_weeks', NOW)).toEqual({
      from: '2026-04-27',
      to: '2026-07-19',
      granularity: 'week',
    })
  })

  it('mes: 3 / 12 meses calendario completos', () => {
    expect(rangeForChartPreset('last_3_months', NOW)).toEqual({
      from: '2026-05-01',
      to: '2026-07-31',
      granularity: 'month',
    })
    expect(rangeForChartPreset('last_12_months', NOW)).toEqual({
      from: '2025-08-01',
      to: '2026-07-31',
      granularity: 'month',
    })
  })

  it('año: 2 / 3 años calendario', () => {
    expect(rangeForChartPreset('last_2_years', NOW)).toEqual({
      from: '2025-01-01',
      to: '2026-12-31',
      granularity: 'year',
    })
    expect(rangeForChartPreset('last_3_years', NOW)).toEqual({
      from: '2024-01-01',
      to: '2026-12-31',
      granularity: 'year',
    })
  })
})

describe('defaultChartPeriod', () => {
  it('gráficos arrancan en últimos 30 días', () => {
    expect(defaultChartPeriod(NOW)).toEqual({
      from: '2026-06-16',
      to: '2026-07-15',
      granularity: 'day',
    })
  })
})

describe('matchChartPreset', () => {
  it('reconoce el rango de evolución', () => {
    expect(matchChartPreset('2026-06-16', '2026-07-15', 'day', NOW)).toBe('last_30_days')
    expect(matchChartPreset('2026-04-27', '2026-07-19', 'week', NOW)).toBe('last_12_weeks')
  })

  it('un solo día no es un preset de gráficos', () => {
    expect(matchChartPreset('2026-07-15', '2026-07-15', 'day', NOW)).toBe('custom')
  })
})
