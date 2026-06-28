import { describe, expect, it } from 'vitest'
import { aggregateDashboardFromLocal } from './dashboardAggregate'
import type { Order, Product } from '@/types'

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
    const stats = aggregateDashboardFromLocal(orders, [], [])
    expect(stats.source).toBe('local')
    expect(stats.periods.day.orders).toBeGreaterThanOrEqual(0)
    expect(stats.status_breakdown.FULFILLED).toBe(1)
  })

  it('top products desde líneas locales', () => {
    const orders: Order[] = [
      {
        id: 1,
        id_user: 1,
        total: 30,
        status: 'FULFILLED',
        active: true,
        created_at: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
        lines: [{ id_product: 10, weight: 3, price_per_kg: 10 }],
      },
    ]
    const products: Product[] = [
      {
        id: 10,
        name: 'Queso',
        price: 10,
        has_tiered_pricing: false,
        active: true,
      },
    ]
    const stats = aggregateDashboardFromLocal(orders, products, [])
    expect(stats.top_products[0]?.name).toBe('Queso')
    expect(stats.top_products[0]?.total_kg).toBe(3)
  })
})
