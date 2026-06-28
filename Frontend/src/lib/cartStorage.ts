import type { Product } from '@/types'

export interface StoredCartItem {
  id_product: number
  weight: number
  product: Product
}

const STORAGE_KEY = 'lepra_cart_v1'

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false
  const p = value as Product
  return typeof p.id === 'number' && typeof p.name === 'string' && typeof p.price === 'number'
}

function isStoredCartItem(value: unknown): value is StoredCartItem {
  if (!value || typeof value !== 'object') return false
  const row = value as StoredCartItem
  return (
    typeof row.id_product === 'number' &&
    typeof row.weight === 'number' &&
    row.weight > 0 &&
    isProduct(row.product) &&
    row.product.id === row.id_product
  )
}

export function loadCartFromStorage(): StoredCartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isStoredCartItem)
  } catch {
    return []
  }
}

export function saveCartToStorage(items: StoredCartItem[]): void {
  try {
    if (items.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* quota / private mode */
  }
}
