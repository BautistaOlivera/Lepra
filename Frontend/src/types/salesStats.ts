export type SalesGranularity = 'day' | 'week' | 'month' | 'year'

export interface SalesStatsParams {
  date_from?: string
  date_to?: string
  product_id?: number | null
  category?: string | null
  granularity?: SalesGranularity
}

export interface SalesSummary {
  orders: number
  revenue: number
  quantity: number
  avg_ticket: number
  previous_orders: number
  previous_revenue: number
}

export interface SalesTimePoint {
  period: string
  orders: number
  revenue: number
  quantity: number
}

export interface SalesByProduct {
  id_product: number
  name: string
  category: string | null
  quantity: number
  revenue: number
  orders: number
}

export interface SalesByCategory {
  category: string
  quantity: number
  revenue: number
  orders: number
}

export interface SalesByCustomer {
  label: string
  quantity: number
  revenue: number
  orders: number
}

export interface SalesProductCustomerCell {
  label: string
  quantity: number
}

export interface SalesProductByCustomer {
  id_product: number
  name: string
  category: string | null
  total_quantity: number
  customers: SalesProductCustomerCell[]
}

export interface SalesStats {
  source: 'server' | 'local'
  generated_at: string
  filters: {
    date_from: string
    date_to: string
    product_id: number | null
    category: string | null
    granularity: SalesGranularity
  }
  summary: SalesSummary
  time_series: SalesTimePoint[]
  by_product: SalesByProduct[]
  by_category: SalesByCategory[]
  by_customer: SalesByCustomer[]
  product_by_customer: SalesProductByCustomer[]
}
