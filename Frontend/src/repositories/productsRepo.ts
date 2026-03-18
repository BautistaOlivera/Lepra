import type { PaginatedRequest, PaginatedResponse, Product } from '@/types'
import { getProductsPaginated } from '@/api/product'
import { lepraDb } from '@/offline/db'
import { isAdminUser } from '@/offline/admin'
import { isOnlineNow } from '@/offline/network'
import { clampLimit, toOfflinePage } from './pagination'

function filterProducts(all: Product[], filters: Record<string, unknown> = {}): Product[] {
  let items = all
  const search = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : ''
  if (search) {
    items = items.filter((p) =>
      [p.name, p.brand ?? ''].some((x) => String(x).toLowerCase().includes(search))
    )
  }
  const category = typeof filters.category === 'string' ? filters.category.trim().toLowerCase() : ''
  if (category) items = items.filter((p) => String(p.category ?? '').toLowerCase() === category)

  if (typeof filters.active === 'boolean') {
    items = items.filter((p) => p.active === filters.active)
  }
  return items
}

export async function getProductsPaginatedOfflineFirst(
  params: PaginatedRequest
): Promise<{ data?: PaginatedResponse<Product>; error?: { status: number; message: string } }> {
  const limit = clampLimit(params.limit, 20)
  const filters = (params.filters ?? {}) as Record<string, unknown>

  if (isOnlineNow()) {
    const res = await getProductsPaginated({ ...params, limit })
    if (res.data?.items?.length) {
      await lepraDb.products.bulkPut(res.data.items)
    }
    return res
  }

  if (!isAdminUser()) {
    return { error: { status: 0, message: 'Offline' } }
  }

  const all = await lepraDb.products.toArray()
  const filtered = filterProducts(all, filters)
  const page = toOfflinePage(filtered, { ...params, limit }, (p) => p.id)
  return { data: page }
}

