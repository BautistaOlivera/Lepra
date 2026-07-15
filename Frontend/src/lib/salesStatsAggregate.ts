import { parseUtcFromApi } from '@/lib/dateApi'
import { isCanceledStatus, normalizeOrderStatus } from '@/lib/orderStatus'
import { orderCustomerLabel } from '@/lib/orderDisplay'
import { lineTotal } from '@/lib/pricing'
import type { Order, Product } from '@/types'
import type {
  SalesByCategory,
  SalesByCustomer,
  SalesByProduct,
  SalesGranularity,
  SalesPlanilla,
  SalesProductByCustomer,
  SalesStats,
  SalesStatsParams,
  SalesSummary,
  SalesTimePoint,
} from '@/types/salesStats'
import { isFixedWeightProduct, piecesFromWeight } from '@/lib/pricing'

type SalesLine = {
  orderId: number
  at: Date
  status: string
  customerKey: string
  customerLabel: string
  idProduct: number
  productName: string
  category: string | null
  total_kg: number
  lineRevenue: number
  soldByPiece: boolean
  qty: number
}

type SalesFilters = {
  dateFrom: string
  dateTo: string
  productId: number | null
  category: string | null
  granularity: SalesGranularity
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function defaultSalesDateRange(): { from: string; to: string } {
  const to = startOfDayUtc(new Date())
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 29)
  return { from: isoDate(from), to: isoDate(to) }
}

function resolveFilters(params: SalesStatsParams): SalesFilters {
  const defaults = defaultSalesDateRange()
  return {
    dateFrom: params.date_from || defaults.from,
    dateTo: params.date_to || defaults.to,
    productId: params.product_id ?? null,
    category: params.category ?? null,
    granularity: params.granularity ?? 'day',
  }
}

function inDateRange(at: Date, from: string, to: string): boolean {
  const day = isoDate(startOfDayUtc(at))
  return day >= from && day <= to
}

function periodLengthDays(from: string, to: string): number {
  const a = parseIsoDate(from)
  const b = parseIsoDate(to)
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

function previousRange(from: string, to: string): { from: string; to: string } {
  const days = periodLengthDays(from, to)
  const prevEnd = new Date(parseIsoDate(from))
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1))
  return { from: isoDate(prevStart), to: isoDate(prevEnd) }
}

function bucketKey(at: Date, granularity: SalesGranularity): string {
  const d = startOfDayUtc(at)
  if (granularity === 'day') return isoDate(d)
  if (granularity === 'week') {
    const monday = new Date(d)
    monday.setUTCDate(monday.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    return isoDate(monday)
  }
  if (granularity === 'month') {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  return String(d.getUTCFullYear())
}

function advanceCursor(cur: Date, granularity: SalesGranularity): Date {
  if (granularity === 'day' || granularity === 'week') {
    const next = new Date(cur)
    next.setUTCDate(next.getUTCDate() + (granularity === 'day' ? 1 : 7))
    return next
  }
  // Mes/año: avanzar al día 1 del período siguiente (evita el desborde de
  // setUTCMonth desde días 29-31, que saltearía meses vacíos), igual que el backend.
  if (granularity === 'month') {
    return new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1))
  }
  return new Date(Date.UTC(cur.getUTCFullYear() + 1, 0, 1))
}

function customerKey(order: Order): string {
  if (order.id_user != null && order.id_user > 0) return `user:${order.id_user}`
  const name = (order.customer_name || '').trim().toLowerCase()
  if (name) return `name:${name}`
  return 'none'
}

function toLines(orders: Order[], products: Product[]): SalesLine[] {
  const names = new Map(products.map((p) => [p.id, p]))
  const lines: SalesLine[] = []

  for (const o of orders) {
    if (!o.active || o.id <= 0 || !o.lines?.length) continue
    const at = parseUtcFromApi(o.created_at)
    if (!at) continue
    const status = normalizeOrderStatus(o.status)
    const label = orderCustomerLabel(o)
    const ck = customerKey(o)

    for (const line of o.lines) {
      const prod = names.get(line.id_product)
      const kg = line.weight || 0
      const soldByPiece = !!(prod?.fixed_weight || line.sold_by_piece)
      let qty = Math.round(kg * 1000) / 1000
      if (soldByPiece && prod) {
        const pieces = piecesFromWeight(prod, kg)
        qty = pieces > 0 ? pieces : qty
      }
      const rev = prod
        ? lineTotal(prod, kg, line.price_per_kg || 0)
        : Math.round(kg * (line.price_per_kg || 0) * 100) / 100
      lines.push({
        orderId: o.id,
        at,
        status,
        customerKey: ck,
        customerLabel: label,
        idProduct: line.id_product,
        productName: prod?.name ?? `Producto #${line.id_product}`,
        category: prod?.category ?? null,
        total_kg: kg,
        lineRevenue: rev,
        soldByPiece: soldByPiece || isFixedWeightProduct(prod ?? { fixed_weight: false }),
        qty,
      })
    }
  }
  return lines
}

function filterLines(lines: SalesLine[], filters: SalesFilters): SalesLine[] {
  return lines.filter((l) => {
    if (isCanceledStatus(l.status)) return false
    if (!inDateRange(l.at, filters.dateFrom, filters.dateTo)) return false
    if (filters.productId != null && l.idProduct !== filters.productId) return false
    if (filters.category && (l.category || '') !== filters.category) return false
    return true
  })
}

function buildSummary(allLines: SalesLine[], filters: SalesFilters): SalesSummary {
  const current = filterLines(allLines, filters)
  const prev = previousRange(filters.dateFrom, filters.dateTo)
  const prevFilters = { ...filters, dateFrom: prev.from, dateTo: prev.to }
  const previous = filterLines(allLines, prevFilters)

  const curOrders = new Set(current.map((l) => l.orderId)).size
  const prevOrders = new Set(previous.map((l) => l.orderId)).size
  const curRevenue = Math.round(current.reduce((s, l) => s + l.lineRevenue, 0) * 100) / 100
  const prevRevenue = Math.round(previous.reduce((s, l) => s + l.lineRevenue, 0) * 100) / 100
  const curKg = Math.round(current.reduce((s, l) => s + l.total_kg, 0) * 1000) / 1000

  return {
    orders: curOrders,
    revenue: curRevenue,
    total_kg: curKg,
    avg_ticket: curOrders ? Math.round((curRevenue / curOrders) * 100) / 100 : 0,
    previous_orders: prevOrders,
    previous_revenue: prevRevenue,
  }
}

function buildTimeSeries(allLines: SalesLine[], filters: SalesFilters): SalesTimePoint[] {
  const filtered = filterLines(allLines, filters)
  const buckets = new Map<string, { period: string; orderIds: Set<number>; revenue: number; total_kg: number }>()

  let cur = parseIsoDate(filters.dateFrom)
  const end = parseIsoDate(filters.dateTo)
  while (cur <= end) {
    const key = bucketKey(cur, filters.granularity)
    if (!buckets.has(key)) {
      buckets.set(key, { period: key, orderIds: new Set(), revenue: 0, total_kg: 0 })
    }
    cur = advanceCursor(cur, filters.granularity)
  }

  for (const line of filtered) {
    const key = bucketKey(line.at, filters.granularity)
    if (!buckets.has(key)) {
      buckets.set(key, { period: key, orderIds: new Set(), revenue: 0, total_kg: 0 })
    }
    const b = buckets.get(key)!
    b.orderIds.add(line.orderId)
    b.revenue += line.lineRevenue
    b.total_kg += line.total_kg
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, b]) => ({
      period: b.period,
      orders: b.orderIds.size,
      revenue: Math.round(b.revenue * 100) / 100,
      total_kg: Math.round(b.total_kg * 1000) / 1000,
    }))
}

function buildByProduct(allLines: SalesLine[], filters: SalesFilters): SalesByProduct[] {
  const filtered = filterLines(allLines, filters)
  const byId = new Map<number, SalesByProduct & { orderIds: Set<number> }>()

  for (const line of filtered) {
    const cur = byId.get(line.idProduct) ?? {
      id_product: line.idProduct,
      name: line.productName,
      category: line.category,
      total_kg: 0,
      revenue: 0,
      orders: 0,
      orderIds: new Set<number>(),
    }
    cur.total_kg = Math.round((cur.total_kg + line.total_kg) * 1000) / 1000
    cur.revenue = Math.round((cur.revenue + line.lineRevenue) * 100) / 100
    cur.orderIds.add(line.orderId)
    byId.set(line.idProduct, cur)
  }

  return [...byId.values()]
    .map(({ orderIds, ...row }) => ({ ...row, orders: orderIds.size }))
    .sort((a, b) => b.total_kg - a.total_kg || b.revenue - a.revenue)
}

function buildByCategory(allLines: SalesLine[], filters: SalesFilters): SalesByCategory[] {
  const filtered = filterLines(allLines, filters)
  const byCat = new Map<string, SalesByCategory & { orderIds: Set<number> }>()

  for (const line of filtered) {
    const cat = (line.category || 'Sin categoría').trim() || 'Sin categoría'
    const cur = byCat.get(cat) ?? {
      category: cat,
      total_kg: 0,
      revenue: 0,
      orders: 0,
      orderIds: new Set<number>(),
    }
    cur.total_kg = Math.round((cur.total_kg + line.total_kg) * 1000) / 1000
    cur.revenue = Math.round((cur.revenue + line.lineRevenue) * 100) / 100
    cur.orderIds.add(line.orderId)
    byCat.set(cat, cur)
  }

  return [...byCat.values()]
    .map(({ orderIds, ...row }) => ({ ...row, orders: orderIds.size }))
    .sort((a, b) => b.revenue - a.revenue)
}

function buildByCustomer(allLines: SalesLine[], filters: SalesFilters): SalesByCustomer[] {
  const filtered = filterLines(allLines, filters)
  const byKey = new Map<string, SalesByCustomer & { orderIds: Set<number> }>()

  for (const line of filtered) {
    const cur = byKey.get(line.customerKey) ?? {
      label: line.customerLabel,
      total_kg: 0,
      revenue: 0,
      orders: 0,
      orderIds: new Set<number>(),
    }
    cur.total_kg = Math.round((cur.total_kg + line.total_kg) * 1000) / 1000
    cur.revenue = Math.round((cur.revenue + line.lineRevenue) * 100) / 100
    cur.orderIds.add(line.orderId)
    byKey.set(line.customerKey, cur)
  }

  return [...byKey.values()]
    .map(({ orderIds, ...row }) => ({ ...row, orders: orderIds.size }))
    .sort((a, b) => b.revenue - a.revenue)
}

function buildProductByCustomer(allLines: SalesLine[], filters: SalesFilters): SalesProductByCustomer[] {
  const filtered = filterLines(allLines, filters)
  const byProduct = new Map<
    number,
    {
      id_product: number
      name: string
      category: string | null
      sold_by_piece: boolean
      unit: string
      total_kg: number
      total_qty: number
      customers: Map<string, { label: string; total_kg: number; qty: number }>
    }
  >()

  for (const line of filtered) {
    const cur = byProduct.get(line.idProduct) ?? {
      id_product: line.idProduct,
      name: line.productName,
      category: line.category,
      sold_by_piece: line.soldByPiece,
      unit: line.soldByPiece ? 'u.' : 'kg',
      total_kg: 0,
      total_qty: 0,
      customers: new Map(),
    }
    cur.total_kg = Math.round((cur.total_kg + line.total_kg) * 1000) / 1000
    cur.total_qty = Math.round((cur.total_qty + line.qty) * 1000) / 1000
    const cell = cur.customers.get(line.customerKey) ?? {
      label: line.customerLabel,
      total_kg: 0,
      qty: 0,
    }
    cell.total_kg = Math.round((cell.total_kg + line.total_kg) * 1000) / 1000
    cell.qty = Math.round((cell.qty + line.qty) * 1000) / 1000
    cur.customers.set(line.customerKey, cell)
    byProduct.set(line.idProduct, cur)
  }

  return [...byProduct.values()]
    .map((row) => ({
      id_product: row.id_product,
      name: row.name,
      category: row.category,
      sold_by_piece: row.sold_by_piece,
      unit: row.unit,
      total_kg: row.total_kg,
      total_qty: row.total_qty,
      customers: [...row.customers.values()].sort((a, b) => b.qty - a.qty),
    }))
    .sort((a, b) => b.total_qty - a.total_qty)
}

function iterPeriodKeys(from: string, to: string, granularity: SalesGranularity): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  let cur = parseIsoDate(from)
  const end = parseIsoDate(to)
  while (cur <= end) {
    const key = bucketKey(cur, granularity)
    if (!seen.has(key)) {
      seen.add(key)
      keys.push(key)
    }
    cur = advanceCursor(cur, granularity)
  }
  return keys
}

function buildPlanilla(allLines: SalesLine[], filters: SalesFilters): SalesPlanilla {
  const filtered = filterLines(allLines, filters)
  const periodKeys = iterPeriodKeys(filters.dateFrom, filters.dateTo, filters.granularity)

  const productsMeta = new Map<
    number,
    { id_product: number; name: string; category: string | null; sold_by_piece: boolean; unit: string }
  >()
  const customersMeta = new Map<string, string>()
  const cells = new Map<string, Map<number, Map<string, number>>>()
  const byPeriodCells = new Map<number, Map<string, number>>()

  for (const line of filtered) {
    const period = bucketKey(line.at, filters.granularity)
    if (!productsMeta.has(line.idProduct)) {
      productsMeta.set(line.idProduct, {
        id_product: line.idProduct,
        name: line.productName,
        category: line.category,
        sold_by_piece: line.soldByPiece,
        unit: line.soldByPiece ? 'u.' : 'kg',
      })
    }
    customersMeta.set(line.customerKey, line.customerLabel)

    if (!cells.has(period)) cells.set(period, new Map())
    const periodMap = cells.get(period)!
    if (!periodMap.has(line.idProduct)) periodMap.set(line.idProduct, new Map())
    const prodMap = periodMap.get(line.idProduct)!
    prodMap.set(line.customerKey, Math.round(((prodMap.get(line.customerKey) || 0) + line.qty) * 1000) / 1000)

    if (!byPeriodCells.has(line.idProduct)) byPeriodCells.set(line.idProduct, new Map())
    const pmap = byPeriodCells.get(line.idProduct)!
    pmap.set(period, Math.round(((pmap.get(period) || 0) + line.qty) * 1000) / 1000)
  }

  const customerKeys = [...customersMeta.keys()].sort((a, b) =>
    (customersMeta.get(a) || '').localeCompare(customersMeta.get(b) || '', 'es')
  )
  const customers = customerKeys.map((k) => customersMeta.get(k)!)
  const productIds = [...productsMeta.keys()].sort((a, b) =>
    (productsMeta.get(a)?.name || '').localeCompare(productsMeta.get(b)?.name || '', 'es')
  )

  const blocks = periodKeys
    .filter((period) => cells.has(period))
    .map((period) => {
      const periodData = cells.get(period)!
      const colTotals = customerKeys.map(() => 0)
      let grand = 0
      const rows = productIds.map((pid) => {
        const meta = productsMeta.get(pid)!
        const custMap = periodData.get(pid) || new Map<string, number>()
        const qtys = customerKeys.map((ck) => Math.round((custMap.get(ck) || 0) * 1000) / 1000)
        const total = Math.round(qtys.reduce((s, q) => s + q, 0) * 1000) / 1000
        qtys.forEach((q, i) => {
          colTotals[i] = Math.round((colTotals[i] + q) * 1000) / 1000
        })
        grand = Math.round((grand + total) * 1000) / 1000
        return {
          id_product: pid,
          name: meta.name,
          unit: meta.unit,
          sold_by_piece: meta.sold_by_piece,
          qtys,
          total,
        }
      })
      return {
        period,
        rows,
        customer_totals: colTotals,
        grand_total: grand,
      }
    })

  const periodTotals = periodKeys.map(() => 0)
  const byPeriod = productIds.map((pid) => {
    const meta = productsMeta.get(pid)!
    const pmap = byPeriodCells.get(pid) || new Map<string, number>()
    const values = periodKeys.map((p) => Math.round((pmap.get(p) || 0) * 1000) / 1000)
    const total = Math.round(values.reduce((s, v) => s + v, 0) * 1000) / 1000
    values.forEach((v, i) => {
      periodTotals[i] = Math.round((periodTotals[i] + v) * 1000) / 1000
    })
    return {
      id_product: pid,
      name: meta.name,
      unit: meta.unit,
      sold_by_piece: meta.sold_by_piece,
      values,
      total,
    }
  })

  return {
    customers,
    customer_keys: customerKeys,
    products: productIds.map((pid) => productsMeta.get(pid)!),
    period_keys: periodKeys,
    blocks,
    by_period: byPeriod,
    period_totals: periodTotals,
    grand_total: Math.round(periodTotals.reduce((s, v) => s + v, 0) * 1000) / 1000,
  }
}

export function aggregateSalesStatsFromLocal(
  orders: Order[],
  products: Product[],
  params: SalesStatsParams
): SalesStats {
  const filters = resolveFilters(params)
  const allLines = toLines(orders, products)
  const now = new Date()

  return {
    source: 'local',
    generated_at: now.toISOString(),
    filters: {
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      product_id: filters.productId,
      category: filters.category,
      granularity: filters.granularity,
    },
    summary: buildSummary(allLines, filters),
    time_series: buildTimeSeries(allLines, filters),
    by_product: buildByProduct(allLines, filters),
    by_category: buildByCategory(allLines, filters),
    by_customer: buildByCustomer(allLines, filters),
    product_by_customer: buildProductByCustomer(allLines, filters),
    planilla: buildPlanilla(allLines, filters),
  }
}
