import { parseUtcFromApi } from '@/lib/dateApi'
import { isCanceledStatus, normalizeOrderStatus } from '@/lib/orderStatus'
import type { Order, Product } from '@/types'
import type {
  DashboardDailyPoint,
  DashboardPeriodKey,
  DashboardPeriodStats,
  DashboardStats,
  DashboardTopProduct,
} from '@/types/dashboard'

const SERIES_DAYS = 30

type OrderRow = { at: Date; total: number; status: string }

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function periodWindows(now: Date) {
  const today = startOfDay(now)
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)

  const weekStart = new Date(today)
  weekStart.setUTCDate(weekStart.getUTCDate() - 6)
  const prevWeekEnd = new Date(weekStart)
  const prevWeekStart = new Date(weekStart)
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7)

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const prevMonthStart = new Date(monthStart)
  prevMonthStart.setUTCMonth(prevMonthStart.getUTCMonth() - 1)

  const end = new Date(now.getTime() + 1)
  return {
    day: { start: today, end, previous_start: yesterday, previous_end: today },
    week: { start: weekStart, end, previous_start: prevWeekStart, previous_end: prevWeekEnd },
    month: { start: monthStart, end, previous_start: prevMonthStart, previous_end: monthStart },
  } as const
}

function inRange(ts: Date, start: Date, end: Date): boolean {
  return ts >= start && ts < end
}

function countRevenue(rows: OrderRow[], start: Date, end: Date): { orders: number; revenue: number } {
  let orders = 0
  let revenue = 0
  for (const r of rows) {
    if (isCanceledStatus(r.status)) continue
    if (!inRange(r.at, start, end)) continue
    orders += 1
    revenue += r.total
  }
  return { orders, revenue }
}

function toRows(orders: Order[]): OrderRow[] {
  return orders
    .filter((o) => o.active && o.id > 0)
    .map((o) => ({
      at: parseUtcFromApi(o.created_at) ?? new Date(0),
      total: Number(o.total) || 0,
      status: normalizeOrderStatus(o.status),
    }))
    .filter((r) => r.at.getTime() > 0)
}

function buildPeriods(rows: OrderRow[], now: Date): Record<DashboardPeriodKey, DashboardPeriodStats> {
  const windows = periodWindows(now)
  const out = {} as Record<DashboardPeriodKey, DashboardPeriodStats>
  for (const key of ['day', 'week', 'month'] as const) {
    const w = windows[key]
    const cur = countRevenue(rows, w.start, w.end)
    const prev = countRevenue(rows, w.previous_start, w.previous_end)
    out[key] = {
      orders: cur.orders,
      revenue: Math.round(cur.revenue * 100) / 100,
      previous_orders: prev.orders,
      previous_revenue: Math.round(prev.revenue * 100) / 100,
    }
  }
  return out
}

function buildStatus(orders: Order[]): Record<string, number> {
  const counts: Record<string, number> = { PENDING: 0, FULFILLED: 0, CANCELED: 0 }
  for (const o of orders) {
    if (!o.active || o.id <= 0) continue
    counts[normalizeOrderStatus(o.status)] += 1
  }
  return counts
}

function buildDailySeries(rows: OrderRow[], now: Date): DashboardDailyPoint[] {
  const today = startOfDay(now)
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - (SERIES_DAYS - 1))

  const buckets = new Map<string, DashboardDailyPoint>()
  for (let i = 0; i < SERIES_DAYS; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    buckets.set(key, { date: key, orders: 0, revenue: 0 })
  }

  for (const r of rows) {
    if (isCanceledStatus(r.status)) continue
    const key = startOfDay(r.at).toISOString().slice(0, 10)
    const b = buckets.get(key)
    if (!b) continue
    b.orders += 1
    b.revenue = Math.round((b.revenue + r.total) * 100) / 100
  }

  return [...buckets.values()]
}

function buildTopProducts(orders: Order[], products: Product[]): DashboardTopProduct[] {
  const names = new Map(products.map((p) => [p.id, p.name]))
  const byId = new Map<number, DashboardTopProduct>()

  const seriesStart = startOfDay(new Date())
  seriesStart.setUTCDate(seriesStart.getUTCDate() - (SERIES_DAYS - 1))

  for (const o of orders) {
    if (!o.active || o.id <= 0 || isCanceledStatus(o.status) || !o.lines?.length) continue
    const at = parseUtcFromApi(o.created_at)
    if (!at || at < seriesStart) continue
    for (const line of o.lines) {
      const pid = line.id_product
      const qty = line.quantity || 0
      const rev = qty * (line.unit_price || 0)
      const cur = byId.get(pid) ?? {
        id_product: pid,
        name: names.get(pid) ?? `Producto #${pid}`,
        quantity: 0,
        revenue: 0,
      }
      cur.quantity += qty
      cur.revenue = Math.round((cur.revenue + rev) * 100) / 100
      byId.set(pid, cur)
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 5)
}

export function aggregateDashboardFromLocal(
  orders: Order[],
  products: Product[],
  users: { active: boolean }[]
): DashboardStats {
  const now = new Date()
  const rows = toRows(orders)
  const activeOrders = orders.filter((o) => o.active && o.id > 0)

  return {
    source: 'local',
    generated_at: now.toISOString(),
    counts: {
      products_active: products.filter((p) => p.active).length,
      users_active: users.filter((u) => u.active).length,
      orders_pending: activeOrders.filter((o) => o.status === 'PENDING').length,
    },
    periods: buildPeriods(rows, now),
    status_breakdown: buildStatus(activeOrders),
    daily_series: buildDailySeries(rows, now),
    top_products: buildTopProducts(activeOrders, products),
  }
}
