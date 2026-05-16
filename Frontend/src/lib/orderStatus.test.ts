import { describe, expect, it } from 'vitest'
import { mergeStatusBreakdown, normalizeOrderStatus } from './orderStatus'

describe('orderStatus', () => {
  it('normaliza CANCELLED a CANCELED', () => {
    expect(normalizeOrderStatus('CANCELLED')).toBe('CANCELED')
    expect(normalizeOrderStatus('cancelled')).toBe('CANCELED')
  })

  it('fusiona breakdown legacy en un solo Cancelado', () => {
    const merged = mergeStatusBreakdown({ CANCELED: 2, CANCELLED: 3, PENDING: 1 })
    expect(merged.CANCELED).toBe(5)
    expect(merged.PENDING).toBe(1)
  })
})
