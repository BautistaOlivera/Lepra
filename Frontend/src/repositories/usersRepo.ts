import type { PaginatedRequest, PaginatedResponse, User } from '@/types'
import { getUsersPaginated } from '@/api/user'
import { lepraDb } from '@/offline/db'
import { isAdminUser } from '@/offline/admin'
import { isOnlineNow } from '@/offline/network'
import { clampLimit, toOfflinePage } from './pagination'

function filterUsers(all: User[], filters: Record<string, unknown> = {}): User[] {
  let items = all
  const search = typeof filters.search === 'string' ? filters.search.trim().toLowerCase() : ''
  if (search) {
    items = items.filter((u) =>
      [u.email, u.name ?? ''].some((x) => String(x).toLowerCase().includes(search))
    )
  }
  const rol = typeof filters.rol === 'string' ? filters.rol.trim().toUpperCase() : ''
  if (rol) items = items.filter((u) => (u.rol || '').toUpperCase() === rol)

  if (typeof filters.active === 'boolean') {
    items = items.filter((u) => u.active === filters.active)
  }
  return items
}

export async function getUsersPaginatedOfflineFirst(
  params: PaginatedRequest
): Promise<{ data?: PaginatedResponse<User>; error?: { status: number; message: string } }> {
  const limit = clampLimit(params.limit, 20)
  const filters = (params.filters ?? {}) as Record<string, unknown>

  if (isOnlineNow()) {
    const res = await getUsersPaginated({ ...params, limit })
    if (res.data?.items?.length) {
      await lepraDb.users.bulkPut(res.data.items)
    }
    return res
  }

  if (!isAdminUser()) {
    return { error: { status: 0, message: 'Offline' } }
  }

  const all = await lepraDb.users.toArray()
  const filtered = filterUsers(all, filters)
  const page = toOfflinePage(filtered, { ...params, limit }, (u) => u.id)
  return { data: page }
}

