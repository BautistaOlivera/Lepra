import Dexie, { type Table } from 'dexie'
import type { Order, Product, User } from '@/types'

export type MetaRow = {
  key: 'users_lastSync' | 'products_lastSync' | 'orders_lastSync'
  value: number
}

export type OutboxCommandType =
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DEACTIVATE'
  | 'PRODUCT_CREATE'
  | 'PRODUCT_UPDATE'
  | 'PRODUCT_DEACTIVATE'
  | 'ORDER_CREATE_ADMIN'
  | 'ORDER_STATUS_SET'

export type OutboxRow = {
  id: string
  type: OutboxCommandType
  payload: unknown
  createdAt: number
  status: 'pending' | 'running' | 'failed' | 'done'
  retries: number
  lastError?: string
  nextAttemptAt?: number
}

export type IdMapRow = {
  entity: 'user' | 'product' | 'order'
  tempId: number
  realId: number
  createdAt: number
}

export class LepraDB extends Dexie {
  users!: Table<User, number>
  products!: Table<Product, number>
  orders!: Table<Order, number>
  meta!: Table<MetaRow, string>
  outbox!: Table<OutboxRow, string>
  idmap!: Table<IdMapRow, [string, number]>

  constructor() {
    super('lepra')

    this.version(1).stores({
      users: 'id, email, name, rol, active',
      products: 'id, name, brand, category, active, has_tiered_pricing',
      orders: 'id, id_user, user_name, status, active, created_at',
      meta: 'key',
    })

    this.version(2).stores({
      users: 'id, email, name, rol, active',
      products: 'id, name, brand, category, active, has_tiered_pricing',
      orders: 'id, id_user, user_name, status, active, created_at',
      meta: 'key',
      outbox: 'id, status, createdAt, type',
    })

    this.version(3).stores({
      users: 'id, email, name, rol, active',
      products: 'id, name, brand, category, active, has_tiered_pricing',
      orders: 'id, id_user, user_name, status, active, created_at',
      meta: 'key',
      outbox: 'id, status, createdAt, type',
      idmap: '[entity+tempId], realId, createdAt',
    })

    this.version(4).stores({
      users: 'id, email, name, rol, active',
      products: 'id, name, brand, category, active, has_tiered_pricing',
      orders: 'id, id_user, user_name, status, active, created_at',
      meta: 'key',
      outbox: 'id, status, nextAttemptAt, createdAt, type',
      idmap: '[entity+tempId], realId, createdAt',
    })
  }
}

export const lepraDb = new LepraDB()

