import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Product } from '@/types'

export interface CartItem {
  id_product: number
  quantity: number
  product: Product
}

interface CartContextValue {
  items: CartItem[]
  addItem: (product: Product, quantity?: number) => void
  removeItem: (id_product: number) => void
  updateQuantity: (id_product: number, quantity: number) => void
  clearCart: () => void
  itemCount: number
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id_product === product.id)
      if (existing) {
        return prev.map((i) =>
          i.id_product === product.id ? { ...i, quantity: i.quantity + quantity } : i
        )
      }
      return [...prev, { id_product: product.id, quantity, product }]
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

  const clearCart = useCallback(() => setItems([]), [])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, itemCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
