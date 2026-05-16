import { getDashboardStats } from '@/api/stats'
import { aggregateDashboardFromLocal } from '@/lib/dashboardAggregate'
import { lepraDb } from '@/offline/db'
import { isAdminUser } from '@/offline/admin'
import { isOnlineNow } from '@/offline/network'
import type { DashboardStats } from '@/types/dashboard'

export async function getDashboardStatsHybrid(): Promise<{
  data?: DashboardStats
  error?: { status: number; message: string }
}> {
  if (isOnlineNow()) {
    const res = await getDashboardStats()
    if (res.data) return res
    if (!isAdminUser()) return res
  }

  if (!isAdminUser()) {
    return { error: { status: 0, message: 'Sin datos offline' } }
  }

  const [orders, products, users] = await Promise.all([
    lepraDb.orders.toArray(),
    lepraDb.products.toArray(),
    lepraDb.users.toArray(),
  ])

  return { data: aggregateDashboardFromLocal(orders, products, users) }
}
