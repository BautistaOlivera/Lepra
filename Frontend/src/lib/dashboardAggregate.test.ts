import { describe, expect, it } from 'vitest'
import { aggregateDashboardFromLocal } from './dashboardAggregate'
import type { Order, Product } from '@/types'

const NOW = new Date('2026-05-16T12:00:00Z')

describe('aggregateDashboardFromLocal', () => {
  it('agrega pedidos del día y excluye cancelados de facturación', () => {
    const orders: Order[] = [
      {
        id: 1,
        id_user: 1,
        total: 100,
        status: 'FULFILLED',
        active: true,
        created_at: '2026-05-16T10:00:00',
      },
      {
        id: 2,
        id_user: 1,
        total: 50,
        status: 'CANCELED',
        active: true,
        created_at: '2026-05-16T11:00:00',
      },
    ]
    const stats = aggregateDashboardFromLocal(orders, [], [], NOW)
    expect(stats.source).toBe('local')
    expect(stats.periods.day.orders).toBe(1)
    expect(stats.periods.day.status_breakdown.FULFILLED).toBe(1)
    expect(stats.periods.day.status_breakdown.CANCELED).toBe(1)
    expect(stats.periods.day.daily_series).toHaveLength(24)
    expect(stats.periods.day.daily_series[10]?.orders).toBe(1)
  })

  it('filtra top productos y serie por período', () => {
    const products: Product[] = [
      { id: 10, name: 'Queso', price: 10, has_tiered_pricing: false, active: true },
      { id: 20, name: 'Yogur', price: 5, has_tiered_pricing: false, active: true },
    ]
    const orders: Order[] = [
      {
        id: 1,
        id_user: 1,
        total: 30,
        status: 'FULFILLED',
        active: true,
        created_at: '2026-05-16T10:00:00',
        lines: [{ id_product: 10, weight: 3, price_per_kg: 10 }],
      },
      {
        id: 2,
        id_user: 1,
        total: 20,
        status: 'FULFILLED',
        active: true,
        created_at: '2026-05-14T10:00:00',
        lines: [{ id_product: 20, weight: 2, price_per_kg: 10 }],
      },
    ]
    const stats = aggregateDashboardFromLocal(orders, products, [], NOW)
    expect(stats.periods.day.top_products.map((p) => p.name)).toEqual(['Queso'])
    expect(stats.periods.week.top_products.map((p) => p.name)).toEqual(['Queso', 'Yogur'])
    expect(stats.periods.week.daily_series).toHaveLength(7)
    expect(stats.periods.month.daily_series).toHaveLength(31)
    expect(stats.periods.month.daily_series[0]?.date).toBe('2026-05-01')
    expect(stats.periods.month.daily_series.at(-1)?.date).toBe('2026-05-31')
    expect(stats.top_products[0]?.name).toBe('Queso')
  })
})
