export interface Product {
  id: number
  name: string
  price: number
  weight?: number | null
  brand?: string | null
  category?: string | null
  has_tiered_pricing: boolean
  img?: string | null
  active: boolean
  price_tiers?: PriceTier[]
  updated_at?: string | null
}

export interface PriceTier {
  id: number
  min_quantity: number
  unit_price: number
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
  quantity: number
  unit_price: number
  weight?: number | null
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
  status: 'PENDING' | 'FULFILLED' | 'CANCELED'
  active: boolean
  lines?: OrderProduct[]
}

export interface PaginatedFilters {
  search?: string
  category?: string
  active?: boolean
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
