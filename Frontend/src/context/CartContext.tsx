import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { Product } from '@/types'
import { loadCartFromStorage, saveCartToStorage } from '@/lib/cartStorage'

export interface CartItem {
  id_product: number
  quantity: number
  product: Product
  /** Peso por línea (kg); opcional, editable al confirmar pedido. */
  weight?: number | null
}

interface CartContextValue {
  items: CartItem[]
  addItem: (product: Product, quantity?: number) => void
  removeItem: (id_product: number) => void
  updateQuantity: (id_product: number, quantity: number) => void
  updateLineWeight: (id_product: number, weight: number | null) => void
  clearCart: () => void
  itemCount: number
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage())

  useEffect(() => {
    saveCartToStorage(items)
  }, [items])

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id_product === product.id)
      if (existing) {
        return prev.map((i) =>
          i.id_product === product.id ? { ...i, quantity: i.quantity + quantity } : i
        )
      }
      return [...prev, {
        id_product: product.id,
        quantity,
        product,
        weight: product.weight ?? null,
      }]
    })
  }, [])

  const removeItem = useCallback((id_product: number) => {
    setItems((prev) => prev.filter((i) => i.id_product !== id_product))
  }, [])

  const updateQuantity = useCallback((id_product: number, quantity: number) => {
    if (quantity < 1) {
      setItems((prev) => prev.filter((i) => i.id_product !== id_product))
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.id_product === id_product ? { ...i, quantity } : i))
    )
  }, [])

  const updateLineWeight = useCallback((id_product: number, weight: number | null) => {
    setItems((prev) =>
      prev.map((i) => (i.id_product === id_product ? { ...i, weight } : i))
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, updateLineWeight, clearCart, itemCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
