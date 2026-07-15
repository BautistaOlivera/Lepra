import type { PaginatedRequest, PaginatedResponse, Product } from '@/types'
import { getProductsPaginated } from '@/api/product'
import { lepraDb } from '@/offline/db'
import { isAdminUser } from '@/offline/admin'
import { isOnlineNow } from '@/offline/network'
import { clampLimit, toOfflinePage } from './pagination'
import { mergeProductForCache } from '@/lib/productMerge'
import { isProductInCatalog, isProductInactive, productStatus } from '@/lib/productStatus'

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

  const adminList = filters.admin_list === true
  const statusFilter = typeof filters.status === 'string' ? filters.status : null
  if (adminList) {
    if (statusFilter === 'inactive' || filters.active === false) {
      items = items.filter((p) => isProductInactive(p))
    } else if (statusFilter === 'sin_stock') {
      items = items.filter((p) => productStatus(p) === 'sin_stock')
    } else if (statusFilter === 'active' || filters.active === true) {
      items = items.filter((p) => isProductInCatalog(p))
    } else {
      items = items.filter((p) => !isProductInactive(p))
    }
  } else if (typeof filters.active === 'boolean') {
    items = items.filter((p) => p.active === filters.active)
    if (filters.active) items = items.filter((p) => isProductInCatalog(p))
  } else {
    items = items.filter((p) => isProductInCatalog(p))
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
      for (const item of res.data.items) {
        const existing = await lepraDb.products.get(item.id)
        await lepraDb.products.put(mergeProductForCache(existing, item))
      }
    }
    return res
  }

  if (!isAdminUser()) {
    return { error: { status: 0, message: 'Sin conexión' } }
  }

  const all = await lepraDb.products.toArray()
  const filtered = filterProducts(all, filters)
  const page = toOfflinePage(filtered, { ...params, limit }, (p) => p.id)
  return { data: page }
}

/** Marcas únicas desde el cache local (para sugerencias al crear productos). */
export async function getExistingProductBrands(): Promise<string[]> {
  const all = await lepraDb.products.toArray()
  const set = new Map<string, string>()
  for (const p of all) {
    if (isProductInactive(p)) continue
    const brand = (p.brand || '').trim()
    if (!brand) continue
    const key = brand.toLowerCase()
    if (!set.has(key)) set.set(key, brand)
  }
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}

export { productStatus, isProductInCatalog, isProductInactive }
