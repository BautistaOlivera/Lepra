import type { Order, PaginatedRequest, PaginatedResponse } from '@/types'
import { getOrdersPaginated } from '@/api/order'
import { lepraDb } from '@/offline/db'
import { parseUtcFromApi } from '@/lib/dateApi'
import { endOfIsoDayMs, startOfIsoDayMs } from '@/lib/formatDate'
import { isAdminUser } from '@/offline/admin'
import { isOnlineNow } from '@/offline/network'
import { hasPendingOrderMutation } from '@/offline/outbox'
import { clampLimit, toOfflinePage } from './pagination'

function filterOrders(all: Order[], filters: Record<string, unknown> = {}): Order[] {
  let items = all
  const search = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : ''
  if (search) {
    items = items.filter((o) =>
      [o.user_name ?? '', o.customer_name ?? '', String(o.id_user ?? '')].some((x) =>
        String(x).toLowerCase().includes(search)
      )
    )
  }
  const status = typeof filters.status === 'string' ? filters.status.trim().toUpperCase() : ''
  if (status) items = items.filter((o) => (o.status || '').toUpperCase() === status)

  const dateFrom = typeof filters.date_from === 'string' ? filters.date_from : ''
  const dateTo = typeof filters.date_to === 'string' ? filters.date_to : ''
  if (dateFrom || dateTo) {
    const from = dateFrom ? startOfIsoDayMs(dateFrom) : -Infinity
    const to = dateTo ? endOfIsoDayMs(dateTo) : Infinity
    items = items.filter((o) => {
      const t = o.created_at ? (parseUtcFromApi(o.created_at)?.getTime() ?? 0) : 0
      return t >= from && t <= to
    })
  }

  return items
}

async function preferLocalIfPending(serverItem: Order): Promise<Order> {
  if (!(await hasPendingOrderMutation(serverItem.id))) return serverItem
  const local = await lepraDb.orders.get(serverItem.id)
  return local ?? serverItem
}

export async function getOrdersPaginatedOfflineFirst(
  params: PaginatedRequest
): Promise<{ data?: PaginatedResponse<Order>; error?: { status: number; message: string } }> {
  const limit = clampLimit(params.limit, 20)
  const filters = (params.filters ?? {}) as Record<string, unknown>

  if (isOnlineNow()) {
    const res = await getOrdersPaginated({ ...params, limit })
    if (res.data?.items?.length) {
      const mergedItems: Order[] = []
      for (const item of res.data.items) {
        const preferred = await preferLocalIfPending(item)
        mergedItems.push(preferred)
        // Solo cachear servidor si no hay mutación local pendiente.
        if (preferred === item) {
          await lepraDb.orders.put(item)
        }
      }
      return { data: { ...res.data, items: mergedItems } }
    }
    return res
  }

  if (!isAdminUser()) {
    return { error: { status: 0, message: 'Sin conexión' } }
  }

  const all = await lepraDb.orders.toArray()
  const filtered = filterOrders(all, filters)
  const page = toOfflinePage(filtered, { ...params, limit }, (o) => o.id)
  return { data: page }
}
