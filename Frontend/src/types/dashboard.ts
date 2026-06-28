export type DashboardPeriodKey = 'day' | 'week' | 'month'

export interface DashboardPeriodStats {
  orders: number
  revenue: number
  previous_orders: number
  previous_revenue: number
}

export interface DashboardDailyPoint {
  date: string
  orders: number
  revenue: number
}

export interface DashboardTopProduct {
  id_product: number
  name: string
  total_kg: number
  revenue: number
}

export interface DashboardStats {
  source: 'server' | 'local'
  generated_at: string
  counts: {
    products_active: number
    users_active: number
    orders_pending: number
  }
  periods: Record<DashboardPeriodKey, DashboardPeriodStats>
  status_breakdown: Record<string, number>
  daily_series: DashboardDailyPoint[]
  top_products: DashboardTopProduct[]
}
