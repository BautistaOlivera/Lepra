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

export interface Order {
  id: number
  id_user: number | null
  customer_name?: string | null
  user_name?: string | null
  total: number
  date?: string | null
  created_at?: string | null
  updated_at?: string | null
  payment?: string | null
  /** Cargo puntual fuera de catálogo (suma al total). */
  extra_amount?: number | null
  /** Descripción del cargo extra (productos de favor / única vez). */
  extra_note?: string | null
  status: 'PENDING' | 'FULFILLED' | 'CANCELED'
  active: boolean
  lines?: OrderProduct[]
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
