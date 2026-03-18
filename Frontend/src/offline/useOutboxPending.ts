import { useCallback, useEffect, useMemo, useState } from 'react'
import { listOutbox } from '@/offline/outbox'
import type { OutboxRow } from '@/offline/db'

type PendingSets = {
  users: Set<number>
  products: Set<number>
  orders: Set<number>
}

function isPendingStatus(status: OutboxRow['status']): boolean {
  return status === 'pending' || status === 'running' || status === 'failed'
}

function computeSets(rows: OutboxRow[]): PendingSets {
  const users = new Set<number>()
  const products = new Set<number>()
  const orders = new Set<number>()

  for (const r of rows) {
    if (!isPendingStatus(r.status)) continue
    const p: any = r.payload

    switch (r.type) {
      case 'USER_CREATE':
        if (Number.isFinite(Number(p?.tempId))) users.add(Number(p.tempId))
        break
      case 'USER_UPDATE':
      case 'USER_DEACTIVATE':
        if (Number.isFinite(Number(p?.id))) users.add(Number(p.id))
        break

      case 'PRODUCT_CREATE':
        if (Number.isFinite(Number(p?.tempId))) products.add(Number(p.tempId))
        break
      case 'PRODUCT_UPDATE':
      case 'PRODUCT_DEACTIVATE':
        if (Number.isFinite(Number(p?.id))) products.add(Number(p.id))
        break

      case 'ORDER_CREATE_ADMIN':
        if (Number.isFinite(Number(p?.tempId))) orders.add(Number(p.tempId))
        break
      case 'ORDER_STATUS_SET':
        if (Number.isFinite(Number(p?.id))) orders.add(Number(p.id))
        break
      default:
        break
    }
  }

  return { users, products, orders }
}

export function useOutboxPending() {
  const [rows, setRows] = useState<OutboxRow[]>([])

  const refresh = useCallback(async () => {
    const r = await listOutbox()
    setRows(r)
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const sets = useMemo(() => computeSets(rows), [rows])

  return { ...sets, refresh }
}

