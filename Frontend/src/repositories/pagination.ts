import type { PaginatedRequest, PaginatedResponse } from '@/types'

export function clampLimit(limit: number | undefined, fallback = 20, max = 200): number {
  const n = typeof limit === 'number' && Number.isFinite(limit) ? limit : fallback
  return Math.max(1, Math.min(max, n))
}

export function toOfflinePage<T>(
  items: T[],
  params: PaginatedRequest,
  getId: (item: T) => number
): PaginatedResponse<T> {
  const limit = clampLimit(params.limit, 20)
  const last = params.last_seen_id ?? null
  const sorted = [...items].sort((a, b) => getId(b) - getId(a))
  const startIndex = last == null ? 0 : sorted.findIndex((x) => getId(x) === last) + 1
  const slice = sorted.slice(Math.max(0, startIndex), Math.max(0, startIndex) + limit)
  const next = slice.length === limit ? getId(slice[slice.length - 1]) : null
  return { items: slice, next_cursor: next }
}

