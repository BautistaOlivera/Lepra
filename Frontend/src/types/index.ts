export type ProductStatus = 'active' | 'sin_stock' | 'inactive'

export interface Product {
  id: number
  name: string
  /** Precio por kg */
  price: number
  /** Peso por pieza estándar (kg). Obligatorio si fixed_weight. */
  weight?: number | null
  /** Si true, se vende solo en múltiplos de weight (no se escribe kg libre). */
  fixed_weight?: boolean
  brand?: string | null
  category?: string | null
  has_tiered_pricing: boolean
  img?: string | null
  /** Visibilidad: active (catálogo), sin_stock (solo admin), inactive (baja). */
  status?: ProductStatus
  active: boolean
  /** @deprecated usar status — cache legacy */
  in_stock?: boolean
  price_tiers?: PriceTier[]
  updated_at?: string | null
}

export interface PriceTier {
  id: number
  min_kg: number
  price_per_kg: number
}

export interface User {
  id: number
  email: string
  name?: string | null
  location?: string | null
  rol: string
  active: boolean
  updated_at?: string | null
}

export interface OrderProduct {
  id?: number
  id_product: number
  /** Peso total de la línea en kg. null = sin pesar (admin). */
  weight: number | null
  /** Precio unitario: $/kg o $/pieza según el producto */
  price_per_kg: number
  sold_by_piece?: boolean
  product_name?: string
  product_brand?: string
}

export type OrderPaymentMethod = 'efectivo' | 'transferencia' | 'cheque' | 'otro'

export interface OrderPayment {
  id: number
  id_order: number
  amount: number
  method: OrderPaymentMethod | string
  paid_at?: string | null
  note?: string | null
  created_at?: string | null
}

export interface Order {
  id: number
  id_user: number | null
  customer_name?: string | null
  user_name?: string | null
  total: number
  date?: string | null
  created_at?: string | null
  updated_at?: string | null
  /** Nota libre legacy (no descuenta del total). */
  payment?: string | null
  /** Cargo puntual fuera de catálogo (suma al total). */
  extra_amount?: number | null
  /** Descripción del cargo extra (productos de favor / única vez). */
  extra_note?: string | null
  /** Historial de cobros parciales. */
  payments?: OrderPayment[]
  /** Suma de pagos estructurados. */
  amount_paid?: number
  /** total - amount_paid (no negativo). */
  balance?: number
  status: 'PENDING' | 'FULFILLED' | 'CANCELED'
  active: boolean
  lines?: OrderProduct[]
}

export interface Supplier {
  id: number
  name: string
  active: boolean
  updated_at?: string | null
}

export interface PurchaseLine {
  id?: number
  id_product: number
  product_name?: string | null
  product_brand?: string | null
  weight: number
  /** Precio de compra por kg. No es el precio de venta del catálogo. */
  price_per_kg: number
  amount?: number
}

export interface Purchase {
  id: number
  id_supplier: number
  supplier_name?: string | null
  date?: string | null
  unitemized_amount: number
  total: number
  note?: string | null
  active: boolean
  created_at?: string | null
  updated_at?: string | null
  lines?: PurchaseLine[]
}

export interface PaginatedFilters {
  search?: string
  category?: string
  active?: boolean
  /** Lista admin: incluye sin stock en "todos", separado de inactivos. */
  admin_list?: boolean
  status?: string
  rol?: string
  date_from?: string
  date_to?: string
  id_supplier?: number
}

export interface PaginatedRequest<T = PaginatedFilters> {
  limit?: number
  last_seen_id?: number | null
  filters?: T
}

export interface PaginatedResponse<T> {
  items: T[]
  next_cursor: number | null
}

export interface AuthUser {
  id: number
  email: string
  name?: string | null
  rol: string
  active: boolean
}
