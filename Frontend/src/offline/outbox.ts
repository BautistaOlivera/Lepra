import { lepraDb, type OutboxCommandType, type OutboxRow } from './db'
import { isAdminUser } from './admin'
import { isOnlineNow } from './network'
import { createUser, updateUser, deactivateUser } from '@/api/user'
import { createProduct, updateProduct, deactivateProduct } from '@/api/product'
import { applyTierDiffOnline } from '@/lib/productTiers'
import { applyTierDiffToLocal } from '@/lib/productMerge'
import type { PriceTier } from '@/types'
import { createOrder, setOrderStatus, updateOrder } from '@/api/order'

function uuid(): string {
  // Suficiente para cola local (no criptográfico)
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

class DependencyNotReadyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DependencyNotReadyError'
  }
}

/** Se dispara cuando la cola local cambia (offline u online). La navbar y badges escuchan esto. */
export const OUTBOX_CHANGED_EVENT = 'lepra-outbox-changed'

export function notifyOutboxChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT))
  }
}

export async function enqueueCommand(type: OutboxCommandType, payload: unknown): Promise<string> {
  const row: OutboxRow = {
    id: uuid(),
    type,
    payload,
    createdAt: Date.now(),
    status: 'pending',
    retries: 0,
    nextAttemptAt: Date.now(),
  }
  await lepraDb.outbox.put(row)
  notifyOutboxChanged()
  return row.id
}

export async function getPendingCount(): Promise<number> {
  return lepraDb.outbox.where('status').equals('pending').count()
}

export type OutboxStats = {
  pending: number
  failed: number
  total: number
  /** Pendientes + fallidos (lo que suele requerir revisión). */
  actionable: number
}

export async function getOutboxStats(): Promise<OutboxStats> {
  const [pending, failed, total] = await Promise.all([
    lepraDb.outbox.where('status').equals('pending').count(),
    lepraDb.outbox.where('status').equals('failed').count(),
    lepraDb.outbox.count(),
  ])
  return { pending, failed, total, actionable: pending + failed }
}

export async function listOutbox(): Promise<OutboxRow[]> {
  return lepraDb.outbox.orderBy('createdAt').reverse().toArray()
}

export async function retryFailed(): Promise<void> {
  const failed = await lepraDb.outbox.where('status').equals('failed').toArray()
  await Promise.all(
    failed.map((r) => lepraDb.outbox.update(r.id, { status: 'pending', nextAttemptAt: Date.now(), lastError: undefined }))
  )
  notifyOutboxChanged()
}

export async function retryOne(id: string): Promise<void> {
  await lepraDb.outbox.update(id, { status: 'pending', nextAttemptAt: Date.now(), lastError: undefined })
  notifyOutboxChanged()
}

export async function clearDone(): Promise<void> {
  const done = await lepraDb.outbox.where('status').equals('done').toArray()
  await Promise.all(done.map((r) => lepraDb.outbox.delete(r.id)))
  notifyOutboxChanged()
}

export async function deleteOne(id: string): Promise<void> {
  await lepraDb.outbox.delete(id)
  notifyOutboxChanged()
}

type ProcessResult = {
  processed: number
  succeeded: number
  failed: number
}

async function mapTempId(entity: 'user' | 'product' | 'order', tempId: number, realId: number) {
  await lepraDb.idmap.put({ entity, tempId, realId, createdAt: Date.now() })
}

async function resolveId(entity: 'user' | 'product' | 'order', id: number): Promise<number> {
  if (id >= 0) return id
  const row = await lepraDb.idmap.get([entity, id])
  const entityLabel = { user: 'cliente', product: 'producto', order: 'pedido' }[entity]
  if (!row?.realId) throw new DependencyNotReadyError(`Esperando sincronización de ${entityLabel} (${id})`)
  return row.realId
}

async function replaceRowId<T extends { id: number }>(
  table: {
    get: (id: number) => Promise<T | undefined>
    delete: (id: number) => Promise<void>
    put: (obj: T) => Promise<any>
  },
  tempId: number,
  newId: number,
  patch?: Partial<T>
) {
  const existing = await table.get(tempId)
  if (!existing) return
  await table.delete(tempId)
  await table.put({ ...existing, ...patch, id: newId } as T)
}

type CommandResult = { ok: boolean; status?: number; message?: string }

function backoffMs(retries: number): number {
  const base = 5_000
  const ms = base * Math.pow(2, Math.min(6, Math.max(0, retries)))
  return Math.min(ms, 5 * 60_000)
}

async function runCommand(row: OutboxRow): Promise<CommandResult> {
  switch (row.type) {
    case 'USER_CREATE': {
      const payload = row.payload as any
      const tempId = Number(payload?.tempId)
      const data = payload?.data
      const res = await createUser(data)
      if (res.error) return { ok: false, status: res.error.status, message: res.error.message }
      const serverUser = res.data?.user
      if (serverUser?.id && Number.isFinite(tempId)) {
        await replaceRowId(lepraDb.users as any, tempId, serverUser.id, serverUser)
        await mapTempId('user', tempId, serverUser.id)
      }
      return { ok: true }
    }
    case 'USER_UPDATE': {
      const p = row.payload as any
      const id = await resolveId('user', Number(p?.id))
      const res = await updateUser({ ...p, id })
      return res.error ? { ok: false, status: res.error.status, message: res.error.message } : { ok: true }
    }
    case 'USER_DEACTIVATE': {
      const { id } = row.payload as any
      const realId = await resolveId('user', Number(id))
      const res = await deactivateUser(realId)
      return res.error ? { ok: false, status: res.error.status, message: res.error.message } : { ok: true }
    }
    case 'PRODUCT_CREATE': {
      const payload = row.payload as any
      const tempId = Number(payload?.tempId)
      const data = payload?.data
      const tiers = Array.isArray(payload?.tiers) ? payload.tiers : []
      const res = await createProduct(data)
      if (res.error) return { ok: false, status: res.error.status, message: res.error.message }
      const newId = Number(res.data?.id)
      if (Number.isFinite(newId) && Number.isFinite(tempId)) {
        let price_tiers: PriceTier[] | undefined
        if (tiers.length > 0) {
          const { createProductPriceTier } = await import('@/api/productPriceTier')
          const created: PriceTier[] = []
          for (const row of tiers) {
            const tierRes = await createProductPriceTier({
              id_product: newId,
              min_quantity: Number(row.min_quantity),
              unit_price: Number(row.unit_price),
            })
            if (tierRes.error) {
              return { ok: false, status: tierRes.error.status, message: tierRes.error.message }
            }
            const tierId = Number(tierRes.data?.id)
            created.push({
              id: tierId,
              min_quantity: Number(row.min_quantity),
              unit_price: Number(row.unit_price),
            })
          }
          price_tiers = created
        }
        await replaceRowId(lepraDb.products as any, tempId, newId, {
          ...data,
          id: newId,
          price_tiers,
        } as any)
        await mapTempId('product', tempId, newId)
      }
      return { ok: true }
    }
    case 'PRODUCT_TIERS_SYNC': {
      const p = row.payload as any
      const localProductId = Number(p?.id)
      const productId = await resolveId('product', localProductId)
      const diff = {
        create: Array.isArray(p?.create) ? p.create : [],
        update: Array.isArray(p?.update) ? p.update : [],
        delete: Array.isArray(p?.delete) ? p.delete : [],
      }
      const err = await applyTierDiffOnline(productId, diff)
      if (err) return { ok: false, message: err }

      const localKey = Number.isFinite(localProductId) ? localProductId : productId
      const existing = await lepraDb.products.get(localKey)
      if (existing) {
        const price_tiers = applyTierDiffToLocal(existing.price_tiers, diff)
        await lepraDb.products.put({ ...existing, price_tiers })
      }
      if (p?.has_tiered_pricing === false) {
        const row = await lepraDb.products.get(localKey)
        if (row) {
          await lepraDb.products.put({ ...row, has_tiered_pricing: false, price_tiers: [] })
        }
      }
      return { ok: true }
    }
    case 'PRODUCT_UPDATE': {
      const p = row.payload as any
      const id = await resolveId('product', Number(p?.id))
      const res = await updateProduct({ ...p, id })
      return res.error ? { ok: false, status: res.error.status, message: res.error.message } : { ok: true }
    }
    case 'PRODUCT_DEACTIVATE': {
      const { id } = row.payload as any
      const realId = await resolveId('product', Number(id))
      const res = await deactivateProduct(realId)
      return res.error ? { ok: false, status: res.error.status, message: res.error.message } : { ok: true }
    }
    case 'ORDER_STATUS_SET': {
      const { id, status } = row.payload as any
      const realId = await resolveId('order', Number(id))
      const res = await setOrderStatus(realId, String(status))
      return res.error ? { ok: false, status: res.error.status, message: res.error.message } : { ok: true }
    }
    case 'ORDER_PAYMENT_UPDATE': {
      const { id, payment } = row.payload as any
      const realId = await resolveId('order', Number(id))
      const res = await updateOrder({ id: realId, payment: payment ?? '' })
      return res.error ? { ok: false, status: res.error.status, message: res.error.message } : { ok: true }
    }
    case 'ORDER_CREATE_ADMIN': {
      const payload = row.payload as any
      const tempId = Number(payload?.tempId)
      const data = payload?.data
      // resolver dependencias si vienen IDs temporales
      const resolved = {
        ...data,
        id_user: await resolveId('user', Number(data?.id_user)),
        lines: Array.isArray(data?.lines)
          ? await Promise.all(
              data.lines.map(async (l: any) => ({
                ...l,
                id_product: await resolveId('product', Number(l?.id_product)),
              }))
            )
          : [],
      }
      const res = await createOrder(resolved as any)
      if (res.error) return { ok: false, status: res.error.status, message: res.error.message }
      const newId = Number(res.data?.id)
      if (Number.isFinite(newId) && Number.isFinite(tempId)) {
        await replaceRowId(lepraDb.orders as any, tempId, newId, {
          id: newId,
          total: Number(res.data?.total) || (data?.total ?? 0),
        } as any)
        await mapTempId('order', tempId, newId)
      }
      return { ok: true }
    }
    default:
      return { ok: false, message: 'Unknown command' }
  }
}

export async function processOutbox(opts?: { max?: number }): Promise<ProcessResult> {
  if (!isAdminUser() || !isOnlineNow()) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  const max = opts?.max ?? 50
  const now = Date.now()
  const pendingAll = await lepraDb.outbox.where('status').equals('pending').sortBy('createdAt')
  const pending = pendingAll.filter((r) => (r.nextAttemptAt ?? 0) <= now)

  const batch = pending.slice(0, max)
  let processed = 0
  let succeeded = 0
  let failed = 0

  for (const row of batch) {
    processed++
    await lepraDb.outbox.update(row.id, { status: 'running' })
    let res: CommandResult
    try {
      res = await runCommand(row)
    } catch (e: any) {
      if (e?.name === 'DependencyNotReadyError') {
        // Dependencia aún no sincronizada: no es un fallo real, lo dejamos pendiente.
        await lepraDb.outbox.update(row.id, { status: 'pending', lastError: e.message, nextAttemptAt: Date.now() + 2000 })
        processed--
        continue
      }
      res = { ok: false, message: e?.message || 'Error' }
    }
    if (res.ok) {
      succeeded++
      await lepraDb.outbox.update(row.id, { status: 'done', lastError: undefined })
    } else {
      if (res.status === 401 || res.status === 403) {
        await lepraDb.outbox.update(row.id, {
          status: 'failed',
          retries: row.retries + 1,
          lastError: 'Sesión expirada (vuelve a iniciar sesión)',
          nextAttemptAt: Date.now() + backoffMs(row.retries + 1),
        })
        failed++
        break
      }
      failed++
      await lepraDb.outbox.update(row.id, {
        status: 'failed',
        retries: row.retries + 1,
        lastError: res.message || 'Error',
        nextAttemptAt: Date.now() + backoffMs(row.retries + 1),
      })
    }
  }

  if (processed > 0) notifyOutboxChanged()
  return { processed, succeeded, failed }
}

