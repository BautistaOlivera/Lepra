import { api } from './client'
import type { Order, Product, Purchase, Supplier, User } from '@/types'

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

export async function syncSuppliers(since: number) {
  return api<SyncResponse<Supplier>>(`/sync/suppliers?since=${encodeURIComponent(String(since || 0))}`)
}

export async function syncPurchases(since: number) {
  return api<SyncResponse<Purchase>>(`/sync/purchases?since=${encodeURIComponent(String(since || 0))}`)
}

