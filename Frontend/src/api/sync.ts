import { api } from './client'
import type { Order, Product, User } from '@/types'

export type SyncResponse<T> = {
  serverTime: number
  items: T[]
}

export async function syncUsers(since: number) {
  return api<SyncResponse<User>>(`/sync/users?since=${encodeURIComponent(String(since || 0))}`)
}

export async function syncProducts(since: number) {
  return api<SyncResponse<Product>>(`/sync/products?since=${encodeURIComponent(String(since || 0))}`)
}

export async function syncOrders(since: number) {
  return api<SyncResponse<Order>>(`/sync/orders?since=${encodeURIComponent(String(since || 0))}`)
}

