import { lepraDb } from './db'
import { isAdminUser } from './admin'
import { isOnlineNow } from './network'
import { syncOrders, syncProducts, syncPurchases, syncSuppliers, syncUsers } from '@/api/sync'
import { mergeProductForCache } from '@/lib/productMerge'
import type { Product } from '@/types'
import { hasPendingOrderMutation, hasPendingPurchaseMutation, hasPendingSupplierMutation } from './outbox'

const TTL_MS = 5 * 60 * 1000

export type AdminSyncResult = {
  usersUpserted: number
  productsUpserted: number
  ordersUpserted: number
  suppliersUpserted: number
  purchasesUpserted: number
  serverTime: number
  ran: boolean
}

type SyncKey = 'users_lastSync' | 'products_lastSync' | 'orders_lastSync' | 'suppliers_lastSync' | 'purchases_lastSync'

async function getLastSync(key: SyncKey): Promise<number> {
  const row = await lepraDb.meta.get(key)
  return row?.value ?? 0
}

async function setLastSync(key: SyncKey, value: number) {
  await lepraDb.meta.put({ key, value })
}

export async function getAdminLastSync(): Promise<{
  users: number
  products: number
  orders: number
  suppliers: number
  purchases: number
}> {
  const [users, products, orders, suppliers, purchases] = await Promise.all([
    getLastSync('users_lastSync'),
    getLastSync('products_lastSync'),
    getLastSync('orders_lastSync'),
    getLastSync('suppliers_lastSync'),
    getLastSync('purchases_lastSync'),
  ])
  return { users, products, orders, suppliers, purchases }
}

const EMPTY_SYNC: AdminSyncResult = {
  usersUpserted: 0,
  productsUpserted: 0,
  ordersUpserted: 0,
  suppliersUpserted: 0,
  purchasesUpserted: 0,
  serverTime: 0,
  ran: false,
}

export async function runAdminIncrementalSync(opts?: { force?: boolean }): Promise<AdminSyncResult> {
  if (!isAdminUser() || !isOnlineNow()) {
    return { ...EMPTY_SYNC, serverTime: Date.now() }
  }

  const force = Boolean(opts?.force)

  const [lu, lp, lo, ls, lpu] = await Promise.all([
    getLastSync('users_lastSync'),
    getLastSync('products_lastSync'),
    getLastSync('orders_lastSync'),
    getLastSync('suppliers_lastSync'),
    getLastSync('purchases_lastSync'),
  ])

  const now = Date.now()
  const oldest = Math.min(lu || now, lp || now, lo || now, ls || now, lpu || now)
  if (!force && now - oldest < TTL_MS) {
    return { ...EMPTY_SYNC, serverTime: now }
  }

  const [usersRes, productsRes, ordersRes, suppliersRes, purchasesRes] = await Promise.all([
    syncUsers(lu),
    syncProducts(lp),
    syncOrders(lo),
    syncSuppliers(ls),
    syncPurchases(lpu),
  ])

  let usersUpserted = 0
  let productsUpserted = 0
  let ordersUpserted = 0
  let suppliersUpserted = 0
  let purchasesUpserted = 0
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
  if (suppliersRes.data) {
    let putCount = 0
    for (const item of suppliersRes.data.items) {
      if (await hasPendingSupplierMutation(item.id)) continue
      await lepraDb.suppliers.put(item)
      putCount++
    }
    await setLastSync('suppliers_lastSync', suppliersRes.data.serverTime)
    suppliersUpserted = putCount
    serverTime = Math.max(serverTime, suppliersRes.data.serverTime)
  }
  if (purchasesRes.data) {
    let putCount = 0
    for (const item of purchasesRes.data.items) {
      if (await hasPendingPurchaseMutation(item.id)) continue
      const existing = await lepraDb.purchases.get(item.id)
      const merged =
        existing?.lines?.length && !item.lines?.length
          ? { ...item, lines: existing.lines, supplier_name: item.supplier_name ?? existing.supplier_name }
          : item
      await lepraDb.purchases.put(merged)
      putCount++
    }
    await setLastSync('purchases_lastSync', purchasesRes.data.serverTime)
    purchasesUpserted = putCount
    serverTime = Math.max(serverTime, purchasesRes.data.serverTime)
  }

  return {
    usersUpserted,
    productsUpserted,
    ordersUpserted,
    suppliersUpserted,
    purchasesUpserted,
    serverTime,
    ran: true,
  }
}

