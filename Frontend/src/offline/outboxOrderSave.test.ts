import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./db', () => {
  const outboxRows: any[] = []
  const idmapRows: any[] = []

  return {
    lepraDb: {
      outbox: {
        put: vi.fn(async (row: any) => {
          const i = outboxRows.findIndex((r) => r.id === row.id)
          if (i >= 0) outboxRows[i] = row
          else outboxRows.push(row)
        }),
        update: vi.fn(async (id: string, patch: any) => {
          const row = outboxRows.find((r) => r.id === id)
          if (row) Object.assign(row, patch)
        }),
        toArray: vi.fn(async () => [...outboxRows]),
        where: vi.fn(() => ({
          equals: () => ({
            count: async () => outboxRows.filter((r) => r.status === 'pending').length,
            toArray: async () => outboxRows.filter((r) => r.status === 'pending'),
            sortBy: async () => outboxRows.filter((r) => r.status === 'pending'),
          }),
        })),
        orderBy: vi.fn(() => ({
          reverse: () => ({
            toArray: async () => [...outboxRows].reverse(),
          }),
        })),
        delete: vi.fn(async (id: string) => {
          const i = outboxRows.findIndex((r) => r.id === id)
          if (i >= 0) outboxRows.splice(i, 1)
        }),
        _rows: outboxRows,
      },
      idmap: {
        get: vi.fn(async ([entity, tempId]: [string, number]) =>
          idmapRows.find((r) => r.entity === entity && r.tempId === tempId),
        ),
        put: vi.fn(async (row: any) => {
          idmapRows.push(row)
        }),
        _rows: idmapRows,
      },
    },
  }
})

vi.mock('./admin', () => ({ isAdminUser: () => true }))
vi.mock('./network', () => ({ isOnlineNow: () => false }))
vi.mock('@/api/user', () => ({}))
vi.mock('@/api/product', () => ({}))
vi.mock('@/api/order', () => ({}))
vi.mock('@/lib/productTiers', () => ({}))
vi.mock('@/lib/productMerge', () => ({}))

import { lepraDb } from './db'
import {
  enqueueCommand,
  enqueueOfflineOrderSave,
  hasPendingOrderMutation,
  resolveLocalOrderId,
} from './outbox'

describe('offline order save', () => {
  beforeEach(() => {
    ;(lepraDb.outbox as any)._rows.length = 0
    ;(lepraDb.idmap as any)._rows.length = 0
  })

  it('resolveLocalOrderId returns mapped real id', async () => {
    await lepraDb.idmap.put({ entity: 'order', tempId: -3, realId: 99, createdAt: Date.now() })
    expect(await resolveLocalOrderId(-3)).toBe(99)
    expect(await resolveLocalOrderId(12)).toBe(12)
  })

  it('patches pending ORDER_CREATE_ADMIN instead of enqueueing UPDATE', async () => {
    await enqueueCommand('ORDER_CREATE_ADMIN', {
      tempId: -5,
      data: { id_user: 1, lines: [{ id_product: 1, weight: null }] },
    })
    const result = await enqueueOfflineOrderSave({
      orderId: -5,
      data: {
        id_user: 1,
        lines: [
          { id_product: 1, weight: 2 },
          { id_product: 2, weight: null },
        ],
      },
    })
    expect(result.mode).toBe('create')
    const rows = await lepraDb.outbox.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('ORDER_CREATE_ADMIN')
    expect((rows[0].payload as any).data.lines).toHaveLength(2)
  })

  it('coalesces multiple ORDER_UPDATE into one', async () => {
    await enqueueOfflineOrderSave({
      orderId: 10,
      data: { id: 10, lines: [{ id_product: 1, weight: null }] },
    })
    await enqueueOfflineOrderSave({
      orderId: 10,
      data: { id: 10, lines: [{ id_product: 1, weight: 4.5 }] },
    })
    const rows = await lepraDb.outbox.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('ORDER_UPDATE')
    expect((rows[0].payload as any).data.lines[0].weight).toBe(4.5)
  })

  it('detects pending mutation by mapped temp id', async () => {
    await enqueueOfflineOrderSave({
      orderId: -7,
      data: { lines: [{ id_product: 1, weight: null }] },
    })
    // Sin CREATE previo, cae en UPDATE con id temp
    expect(await hasPendingOrderMutation(-7)).toBe(true)
    await lepraDb.idmap.put({ entity: 'order', tempId: -7, realId: 55, createdAt: Date.now() })
    expect(await hasPendingOrderMutation(55)).toBe(true)
  })
})
