import { describe, it, expect } from 'vitest'
import { isProductInCatalog, isProductInactive, productStatus } from './productStatus'

describe('productStatus', () => {
  it('uses status when present', () => {
    expect(productStatus({ status: 'sin_stock', active: true })).toBe('sin_stock')
  })

  it('falls back from legacy active/in_stock', () => {
    expect(productStatus({ active: false })).toBe('inactive')
    expect(productStatus({ active: true, in_stock: false })).toBe('sin_stock')
    expect(productStatus({ active: true })).toBe('active')
  })

  it('detects catalog visibility', () => {
    expect(isProductInCatalog({ status: 'active', active: true })).toBe(true)
    expect(isProductInCatalog({ status: 'sin_stock', active: true })).toBe(false)
  })

  it('detects inactive', () => {
    expect(isProductInactive({ status: 'inactive', active: false })).toBe(true)
  })
})
