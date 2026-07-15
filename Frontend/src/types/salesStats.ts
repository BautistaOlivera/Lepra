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
  total_kg: number
  avg_ticket: number
  previous_orders: number
  previous_revenue: number
}

export interface SalesTimePoint {
  period: string
  orders: number
  revenue: number
  total_kg: number
}

export interface SalesByProduct {
  id_product: number
  name: string
  category: string | null
  total_kg: number
  revenue: number
  orders: number
}

export interface SalesByCategory {
  category: string
  total_kg: number
  revenue: number
  orders: number
}

export interface SalesByCustomer {
  label: string
  total_kg: number
  revenue: number
  orders: number
}

export interface SalesProductCustomerCell {
  label: string
  total_kg: number
  qty?: number
}

export interface SalesProductByCustomer {
  id_product: number
  name: string
  category: string | null
  total_kg: number
  total_qty?: number
  unit?: string
  sold_by_piece?: boolean
  customers: SalesProductCustomerCell[]
}

export interface SalesPlanillaProduct {
  id_product: number
  name: string
  category: string | null
  sold_by_piece: boolean
  unit: string
}

export interface SalesPlanillaBlockRow {
  id_product: number
  name: string
  unit: string
  sold_by_piece: boolean
  qtys: number[]
  total: number
}

export interface SalesPlanillaBlock {
  period: string
  rows: SalesPlanillaBlockRow[]
  customer_totals: number[]
  grand_total: number
}

export interface SalesPlanillaPeriodRow {
  id_product: number
  name: string
  unit: string
  sold_by_piece: boolean
  values: number[]
  total: number
}

export interface SalesPlanilla {
  customers: string[]
  customer_keys: string[]
  products: SalesPlanillaProduct[]
  period_keys: string[]
  blocks: SalesPlanillaBlock[]
  by_period: SalesPlanillaPeriodRow[]
  period_totals: number[]
  grand_total: number
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
  planilla?: SalesPlanilla
}
