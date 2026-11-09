import type { PaginatedRequest, PaginatedResponse, Purchase } from '@/types'
import { getPurchasesPaginated } from '@/api/purchase'
import { lepraDb } from '@/offline/db'
import { isAdminUser } from '@/offline/admin'
import { isOnlineNow } from '@/offline/network'
import { hasPendingPurchaseMutation } from '@/offline/outbox'
import { clampLimit, toOfflinePage } from './pagination'

function filterPurchases(all: Purchase[], filters: Record<string, unknown> = {}): Purchase[] {
  let items = all
  const search = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : ''
  if (search) {
    items = items.filter((p) =>
      [p.supplier_name ?? '', p.note ?? ''].some((x) => x.toLowerCase().includes(search)),
    )
  }
  const supplierId = filters.id_supplier
  if (supplierId != null && supplierId !== '') {
    const id = Number(supplierId)
    if (Number.isFinite(id)) items = items.filter((p) => p.id_supplier === id)
  }
  const dateFrom = typeof filters.date_from === 'string' ? filters.date_from : ''
  const dateTo = typeof filters.date_to === 'string' ? filters.date_to : ''
  if (dateFrom) items = items.filter((p) => (p.date || '') >= dateFrom)
  if (dateTo) items = items.filter((p) => (p.date || '') <= dateTo)
  if (typeof filters.active === 'boolean') {
    items = items.filter((p) => p.active === filters.active)
  }
  return items
}

async function preferLocalIfPending(serverItem: Purchase): Promise<Purchase> {
  if (!(await hasPendingPurchaseMutation(serverItem.id))) return serverItem
  const local = await lepraDb.purchases.get(serverItem.id)
  return local ?? serverItem
}

export async function getPurchasesPaginatedOfflineFirst(
  params: PaginatedRequest,
): Promise<{ data?: PaginatedResponse<Purchase>; error?: { status: number; message: string } }> {
  const limit = clampLimit(params.limit, 20)
  const filters = (params.filters ?? {}) as Record<string, unknown>

  if (isOnlineNow()) {
    const res = await getPurchasesPaginated({ ...params, limit })
    if (res.data?.items?.length) {
      const merged: Purchase[] = []
      for (const item of res.data.items) {
        const preferred = await preferLocalIfPending(item)
        merged.push(preferred)
        if (preferred === item) await lepraDb.purchases.put(item)
      }
      return { data: { ...res.data, items: merged } }
    }
    return res
  }

  if (!isAdminUser()) {
    return { error: { status: 0, message: 'Sin conexión' } }
  }

  const all = await lepraDb.purchases.toArray()
  const filtered = filterPurchases(all, filters)
  return { data: toOfflinePage(filtered, { ...params, limit }, (p) => p.id) }
}
