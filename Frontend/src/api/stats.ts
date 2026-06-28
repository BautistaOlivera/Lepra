import { api } from './client'
import type { DashboardStats } from '@/types/dashboard'
import type { SalesStats, SalesStatsParams } from '@/types/salesStats'

export async function getDashboardStats() {
  return api<DashboardStats>('/stats/dashboard')
}

function buildSalesQuery(params: SalesStatsParams): string {
  const q = new URLSearchParams()
  if (params.date_from) q.set('date_from', params.date_from)
  if (params.date_to) q.set('date_to', params.date_to)
  if (params.product_id != null) q.set('product_id', String(params.product_id))
  if (params.category) q.set('category', params.category)
  if (params.granularity) q.set('granularity', params.granularity)
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function getSalesStats(params: SalesStatsParams = {}) {
  return api<SalesStats>(`/stats/sales${buildSalesQuery(params)}`)
}
