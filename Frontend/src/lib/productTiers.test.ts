import { describe, it, expect } from 'vitest'
import {
  validateTierDrafts,
  tiersChanged,
  computeTierDiff,
  tierDraftsFromProduct,
} from './productTiers'

describe('validateTierDrafts', () => {
  it('rejects min_quantity below 2', () => {
    const res = validateTierDrafts([{ key: 'a', min_quantity: '1', unit_price: '9' }])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.message).toMatch(/2 o más/)
  })

  it('rejects duplicate min_quantity', () => {
    const res = validateTierDrafts([
      { key: 'a', min_quantity: '5', unit_price: '9' },
      { key: 'b', min_quantity: '5', unit_price: '8' },
    ])
    expect(res.ok).toBe(false)
  })

  it('accepts valid rows', () => {
    const res = validateTierDrafts([{ key: 'a', min_quantity: '5', unit_price: '9.5' }])
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.tiers[0].min_quantity).toBe(5)
      expect(res.tiers[0].unit_price).toBe(9.5)
    }
  })
})

describe('computeTierDiff', () => {
  const initial = [
    { id: 1, min_quantity: 5, unit_price: 9 },
    { id: 2, min_quantity: 10, unit_price: 8 },
  ]

  it('detects no changes', () => {
    const current = [
      { id: 1, min_quantity: 5, unit_price: 9 },
      { id: 2, min_quantity: 10, unit_price: 8 },
    ]
    expect(tiersChanged(initial, current)).toBe(false)
    const diff = computeTierDiff(initial, current)
    expect(diff.create).toHaveLength(0)
    expect(diff.update).toHaveLength(0)
    expect(diff.delete).toHaveLength(0)
  })

  it('detects create update delete', () => {
    const current = [
      { id: 1, min_quantity: 5, unit_price: 8.5 },
      { min_quantity: 20, unit_price: 7 },
    ]
    const diff = computeTierDiff(initial, current)
    expect(diff.update).toEqual([{ id: 1, min_quantity: 5, unit_price: 8.5 }])
    expect(diff.delete).toEqual([2])
    expect(diff.create).toEqual([{ min_quantity: 20, unit_price: 7 }])
  })
})

describe('tierDraftsFromProduct', () => {
  it('sorts by min_quantity', () => {
    const drafts = tierDraftsFromProduct([
      { id: 2, min_quantity: 10, unit_price: 8 },
      { id: 1, min_quantity: 5, unit_price: 9 },
    ])
    expect(drafts[0].min_quantity).toBe('5')
    expect(drafts[1].min_quantity).toBe('10')
  })
})
