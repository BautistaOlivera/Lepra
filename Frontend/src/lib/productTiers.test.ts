import { describe, it, expect } from 'vitest'
import {
  validateTierDrafts,
  tiersChanged,
  computeTierDiff,
  tierDraftsFromProduct,
} from './productTiers'

describe('validateTierDrafts', () => {
  it('rejects min_kg below 2', () => {
    const res = validateTierDrafts([{ key: 'a', min_kg: '1', price_per_kg: '9' }])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.message).toMatch(/2 o más/)
  })

  it('rejects duplicate min_kg', () => {
    const res = validateTierDrafts([
      { key: 'a', min_kg: '5', price_per_kg: '9' },
      { key: 'b', min_kg: '5', price_per_kg: '8' },
    ])
    expect(res.ok).toBe(false)
  })

  it('accepts valid rows', () => {
    const res = validateTierDrafts([{ key: 'a', min_kg: '5', price_per_kg: '9.5' }])
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.tiers[0].min_kg).toBe(5)
      expect(res.tiers[0].price_per_kg).toBe(9.5)
    }
  })

  it('converts pieces to min_kg when piece weight set (bulk)', () => {
    const res = validateTierDrafts([{ key: 'a', min_kg: '3', price_per_kg: '8' }], {
      pieceWeightKg: 0.5,
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.tiers[0].min_kg).toBe(1.5)
  })

  it('stores min pieces directly for fixed_weight products', () => {
    const res = validateTierDrafts([{ key: 'a', min_kg: '5', price_per_kg: '90' }], {
      fixedWeight: true,
      pieceWeightKg: 0.5,
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.tiers[0].min_kg).toBe(5)
  })

  it('rejects below 2 pieces when piece weight set', () => {
    const res = validateTierDrafts([{ key: 'a', min_kg: '1', price_per_kg: '8' }], { pieceWeightKg: 0.5 })
    expect(res.ok).toBe(false)
  })
})

describe('computeTierDiff', () => {
  const initial = [
    { id: 1, min_kg: 5, price_per_kg: 9 },
    { id: 2, min_kg: 10, price_per_kg: 8 },
  ]

  it('detects no changes', () => {
    const current = [
      { id: 1, min_kg: 5, price_per_kg: 9 },
      { id: 2, min_kg: 10, price_per_kg: 8 },
    ]
    expect(tiersChanged(initial, current)).toBe(false)
    const diff = computeTierDiff(initial, current)
    expect(diff.create).toHaveLength(0)
    expect(diff.update).toHaveLength(0)
    expect(diff.delete).toHaveLength(0)
  })

  it('detects create update delete', () => {
    const current = [
      { id: 1, min_kg: 5, price_per_kg: 8.5 },
      { min_kg: 20, price_per_kg: 7 },
    ]
    const diff = computeTierDiff(initial, current)
    expect(diff.update).toEqual([{ id: 1, min_kg: 5, price_per_kg: 8.5 }])
    expect(diff.delete).toEqual([2])
    expect(diff.create).toEqual([{ min_kg: 20, price_per_kg: 7 }])
  })
})

describe('tierDraftsFromProduct', () => {
  it('sorts by min_kg', () => {
    const drafts = tierDraftsFromProduct([
      { id: 2, min_kg: 10, price_per_kg: 8 },
      { id: 1, min_kg: 5, price_per_kg: 9 },
    ])
    expect(drafts[0].min_kg).toBe('5')
    expect(drafts[1].min_kg).toBe('10')
  })

  it('shows pieces when piece weight provided (bulk)', () => {
    const drafts = tierDraftsFromProduct([{ id: 1, min_kg: 1.5, price_per_kg: 9 }], { pieceWeightKg: 0.5 })
    expect(drafts[0].min_kg).toBe('3')
  })

  it('shows pieces for fixed_weight without conversion', () => {
    const drafts = tierDraftsFromProduct([{ id: 1, min_kg: 5, price_per_kg: 90 }], {
      fixedWeight: true,
      pieceWeightKg: 0.5,
    })
    expect(drafts[0].min_kg).toBe('5')
  })
})
