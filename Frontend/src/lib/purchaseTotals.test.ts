import { describe, it, expect } from 'vitest'
import {
  formatUnitDraft,
  lineAmount,
  pricePerKgFromAmount,
  purchaseTotal,
} from './purchaseTotals'

describe('purchaseTotal', () => {
  it('sums product lines and the unitemized amount', () => {
    expect(lineAmount(2, 100)).toBe(200)
    expect(purchaseTotal([200, 15], 1000)).toBe(1215)
    expect(purchaseTotal([], 800)).toBe(800)
  })

  it('recomputes purchase price from an edited line amount', () => {
    const price = pricePerKgFromAmount(3, 10)
    expect(lineAmount(3, price)).toBe(10)
    expect(formatUnitDraft(price)).toBe('3.333333')
  })
})
