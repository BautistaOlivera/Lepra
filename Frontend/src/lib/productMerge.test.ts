import { describe, it, expect } from 'vitest'
import { mergeProductForCache, applyTierDiffToLocal } from './productMerge'
import type { Product } from '@/types'

describe('mergeProductForCache', () => {
  it('keeps existing tiers when incoming omits price_tiers', () => {
    const existing: Product = {
      id: 1,
      name: 'A',
      price: 10,
      has_tiered_pricing: true,
      active: true,
      price_tiers: [{ id: 1, min_kg: 5, price_per_kg: 9 }],
    }
    const incoming: Product = {
      id: 1,
      name: 'A',
      price: 11,
      has_tiered_pricing: true,
      active: true,
    }
    const merged = mergeProductForCache(existing, incoming)
    expect(merged.price).toBe(11)
    expect(merged.price_tiers).toEqual(existing.price_tiers)
  })

  it('replaces tiers when incoming includes price_tiers', () => {
    const existing: Product = {
      id: 1,
      name: 'A',
      price: 10,
      has_tiered_pricing: true,
      active: true,
      price_tiers: [{ id: 1, min_kg: 5, price_per_kg: 9 }],
    }
    const incoming: Product = {
      id: 1,
      name: 'A',
      price: 10,
      has_tiered_pricing: false,
      active: true,
      price_tiers: [],
    }
    const merged = mergeProductForCache(existing, incoming)
    expect(merged.price_tiers).toEqual([])
  })
})

describe('applyTierDiffToLocal', () => {
  it('applies create update delete', () => {
    const initial = [{ id: 1, min_kg: 5, price_per_kg: 9 }]
    const next = applyTierDiffToLocal(initial, {
      update: [{ id: 1, min_kg: 5, price_per_kg: 8.5 }],
      create: [{ min_kg: 10, price_per_kg: 8 }],
      delete: [],
    })
    expect(next.find((t) => t.min_kg === 5)?.price_per_kg).toBe(8.5)
    expect(next.some((t) => t.min_kg === 10)).toBe(true)
  })
})
