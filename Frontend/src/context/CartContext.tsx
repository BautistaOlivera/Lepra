import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { Product } from '@/types'
import { loadCartFromStorage, saveCartToStorage } from '@/lib/cartStorage'
import {
  defaultLineWeightKg,
  isFixedWeightProduct,
  minKgFromPieces,
  pieceWeightKg,
} from '@/lib/pricing'

export interface CartItem {
  id_product: number
  weight: number
  product: Product
}

interface CartContextValue {
  items: CartItem[]
  addItem: (product: Product) => void
  removeItem: (id_product: number) => void
  updateWeight: (id_product: number, weight: number) => void
  adjustPieces: (id_product: number, delta: number) => void
  clearCart: () => void
  itemCount: number
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage())

  useEffect(() => {
    saveCartToStorage(items)
  }, [items])

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id_product === product.id)
      const defaultWeight = defaultLineWeightKg(product)
      if (existing) {
        const piece = pieceWeightKg(product)
        const added =
          isFixedWeightProduct(product) && piece ? piece : defaultWeight
        return prev.map((i) =>
          i.id_product === product.id ? { ...i, weight: i.weight + added } : i
        )
      }
      return [...prev, { id_product: product.id, weight: defaultWeight, product }]
    })
  }, [])

  const removeItem = useCallback((id_product: number) => {
    setItems((prev) => prev.filter((i) => i.id_product !== id_product))
  }, [])

  const updateWeight = useCallback((id_product: number, weight: number) => {
    if (weight <= 0) {
      setItems((prev) => prev.filter((i) => i.id_product !== id_product))
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.id_product === id_product ? { ...i, weight } : i))
    )
  }, [])

  const adjustPieces = useCallback((id_product: number, delta: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id_product !== id_product) return i
        const piece = pieceWeightKg(i.product)
        if (!piece) return i
        const nextPieces = Math.max(1, Math.round(i.weight / piece) + delta)
        return { ...i, weight: minKgFromPieces(nextPieces, piece) }
      })
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const itemCount = items.length

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateWeight, adjustPieces, clearCart, itemCount }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
