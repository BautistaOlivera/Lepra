import { getSalesStats } from '@/api/stats'
import { aggregateSalesStatsFromLocal } from '@/lib/salesStatsAggregate'
import { lepraDb } from '@/offline/db'
import { isAdminUser } from '@/offline/admin'
import { isOnlineNow } from '@/offline/network'
import type { SalesStats, SalesStatsParams } from '@/types/salesStats'

export async function getSalesStatsHybrid(params: SalesStatsParams = {}): Promise<{
  data?: SalesStats
  error?: { status: number; message: string }
}> {
  if (isOnlineNow()) {
    const res = await getSalesStats(params)
    if (res.data) return res
    if (!isAdminUser()) return res
  }

  if (!isAdminUser()) {
    return { error: { status: 0, message: 'Sin datos sin conexión' } }
  }

  const [orders, products] = await Promise.all([
    lepraDb.orders.toArray(),
    lepraDb.products.toArray(),
  ])

  return { data: aggregateSalesStatsFromLocal(orders, products, params) }
}
