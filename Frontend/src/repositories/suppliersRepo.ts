import type { PaginatedRequest, PaginatedResponse, Supplier } from '@/types'
import { getSuppliersPaginated } from '@/api/supplier'
import { lepraDb } from '@/offline/db'
import { isAdminUser } from '@/offline/admin'
import { isOnlineNow } from '@/offline/network'
import { hasPendingSupplierMutation } from '@/offline/outbox'
import { clampLimit, toOfflinePage } from './pagination'

function filterSuppliers(all: Supplier[], filters: Record<string, unknown> = {}): Supplier[] {
  let items = all
  const search = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : ''
  if (search) {
    items = items.filter((s) => s.name.toLowerCase().includes(search))
  }
  if (typeof filters.active === 'boolean') {
    items = items.filter((s) => s.active === filters.active)
  }
  return items
}

async function preferLocalIfPending(serverItem: Supplier): Promise<Supplier> {
  if (!(await hasPendingSupplierMutation(serverItem.id))) return serverItem
  const local = await lepraDb.suppliers.get(serverItem.id)
  return local ?? serverItem
}

export async function getSuppliersPaginatedOfflineFirst(
  params: PaginatedRequest,
): Promise<{ data?: PaginatedResponse<Supplier>; error?: { status: number; message: string } }> {
  const limit = clampLimit(params.limit, 20)
  const filters = (params.filters ?? {}) as Record<string, unknown>

  if (isOnlineNow()) {
    const res = await getSuppliersPaginated({ ...params, limit })
    if (res.data?.items?.length) {
      const merged: Supplier[] = []
      for (const item of res.data.items) {
        const preferred = await preferLocalIfPending(item)
        merged.push(preferred)
        if (preferred === item) await lepraDb.suppliers.put(item)
      }
      return { data: { ...res.data, items: merged } }
    }
    return res
  }

  if (!isAdminUser()) {
    return { error: { status: 0, message: 'Sin conexión' } }
  }

  const all = await lepraDb.suppliers.toArray()
  const filtered = filterSuppliers(all, filters)
  return { data: toOfflinePage(filtered, { ...params, limit }, (s) => s.id) }
}
