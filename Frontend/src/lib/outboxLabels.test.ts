import { describe, it, expect } from 'vitest'
import { formatOutboxType, outboxTypeLabel, outboxPayloadSummary } from './outboxLabels'
import type { OutboxRow } from '@/offline/db'

describe('outboxTypeLabel', () => {
  it('returns friendly action label', () => {
    expect(outboxTypeLabel('PRODUCT_TIERS_SYNC')).toBe('Precios por volumen')
    expect(outboxTypeLabel('USER_CREATE')).toBe('Crear cliente')
  })
})

describe('formatOutboxType', () => {
  it('includes friendly label in parentheses', () => {
    expect(formatOutboxType('PRODUCT_TIERS_SYNC')).toBe('PRODUCT_TIERS_SYNC (Precios por volumen)')
  })
})

describe('outboxPayloadSummary', () => {
  it('summarizes product create with tiers in Spanish', () => {
    const row: OutboxRow = {
      id: '1',
      type: 'PRODUCT_CREATE',
      payload: { data: { name: 'Yogur' }, tiers: [{ min_quantity: 5, unit_price: 9 }] },
      createdAt: 0,
      status: 'pending',
      retries: 0,
    }
    expect(outboxPayloadSummary(row)).toContain('Yogur')
    expect(outboxPayloadSummary(row)).toContain('volumen')
  })
})
