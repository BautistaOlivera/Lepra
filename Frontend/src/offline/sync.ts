import { lepraDb } from './db'
import { isAdminUser } from './admin'
import { isOnlineNow } from './network'
import { syncOrders, syncProducts, syncUsers } from '@/api/sync'
import { mergeProductForCache } from '@/lib/productMerge'
import type { Product } from '@/types'
import { hasPendingOrderMutation } from './outbox'

const TTL_MS = 5 * 60 * 1000

export type AdminSyncResult = {
  usersUpserted: number
  productsUpserted: number
  ordersUpserted: number
  serverTime: number
  ran: boolean
}

async function getLastSync(key: 'users_lastSync' | 'products_lastSync' | 'orders_lastSync'): Promise<number> {
  const row = await lepraDb.meta.get(key)
  return row?.value ?? 0
}

async function setLastSync(key: 'users_lastSync' | 'products_lastSync' | 'orders_lastSync', value: number) {
  await lepraDb.meta.put({ key, value })
}

export async function getAdminLastSync(): Promise<{ users: number; products: number; orders: number }> {
  const [users, products, orders] = await Promise.all([
    getLastSync('users_lastSync'),
    getLastSync('products_lastSync'),
    getLastSync('orders_lastSync'),
  ])
  return { users, products, orders }
}

export async function runAdminIncrementalSync(opts?: { force?: boolean }): Promise<AdminSyncResult> {
  if (!isAdminUser() || !isOnlineNow()) {
    return { usersUpserted: 0, productsUpserted: 0, ordersUpserted: 0, serverTime: Date.now(), ran: false }
  }

  const force = Boolean(opts?.force)

  const [lu, lp, lo] = await Promise.all([
    getLastSync('users_lastSync'),
    getLastSync('products_lastSync'),
    getLastSync('orders_lastSync'),
  ])

  const now = Date.now()
  if (!force && now - Math.min(lu || now, lp || now, lo || now) < TTL_MS) {
    return { usersUpserted: 0, productsUpserted: 0, ordersUpserted: 0, serverTime: now, ran: false }
  }

  const [usersRes, productsRes, ordersRes] = await Promise.all([
    syncUsers(lu),
    syncProducts(lp),
    syncOrders(lo),
  ])

  let usersUpserted = 0
  let productsUpserted = 0
  let ordersUpserted = 0
  let serverTime = Date.now()

  if (usersRes.data) {
    await lepraDb.users.bulkPut(usersRes.data.items)
    await setLastSync('users_lastSync', usersRes.data.serverTime)
    usersUpserted = usersRes.data.items.length
    serverTime = Math.max(serverTime, usersRes.data.serverTime)
  }
  if (productsRes.data) {
    for (const item of productsRes.data.items) {
      const existing = await lepraDb.products.get(item.id)
      const merged = mergeProductForCache(existing, item as Product)
      await lepraDb.products.put(merged)
    }
    await setLastSync('products_lastSync', productsRes.data.serverTime)
    productsUpserted = productsRes.data.items.length
    serverTime = Math.max(serverTime, productsRes.data.serverTime)
  }
  if (ordersRes.data) {
    let putCount = 0
    for (const item of ordersRes.data.items) {
      // No pisar cambios locales todavía no enviados (edición / notas / estado).
      if (await hasPendingOrderMutation(item.id)) {
        continue
      }
      const existing = await lepraDb.orders.get(item.id)
      const merged =
        existing?.lines?.length && !item.lines?.length
          ? { ...item, lines: existing.lines, user_name: item.user_name ?? existing.user_name }
          : item
      await lepraDb.orders.put(merged)
      putCount++
    }
    await setLastSync('orders_lastSync', ordersRes.data.serverTime)
    ordersUpserted = putCount
    serverTime = Math.max(serverTime, ordersRes.data.serverTime)
  }

  return { usersUpserted, productsUpserted, ordersUpserted, serverTime, ran: true }
}

