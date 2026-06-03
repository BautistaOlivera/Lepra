import type { PriceTier } from '@/types'

export type TierDraft = {
  key: string
  id?: number
  min_quantity: string
  unit_price: string
}

export type TierPayload = { min_quantity: number; unit_price: number; id?: number }

const PRICE_DECIMALS_MSG = 'Solo 2 números después del punto'

export function parseUnitPriceInput(raw: string): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim().replace(',', '.')
  if (!trimmed) return { ok: false, message: 'Precio inválido' }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false, message: 'Precio inválido' }
  const [, decimals] = trimmed.split('.')
  if (decimals && decimals.length > 2) return { ok: false, message: PRICE_DECIMALS_MSG }
  const value = parseFloat(trimmed)
  if (!Number.isFinite(value) || value < 0) return { ok: false, message: 'Precio inválido' }
  return { ok: true, value }
}

export function tierDraftsFromProduct(tiers?: PriceTier[]): TierDraft[] {
  if (!tiers?.length) return []
  return [...tiers]
    .sort((a, b) => a.min_quantity - b.min_quantity)
    .map((t) => ({
      key: `tier-${t.id}`,
      id: t.id,
      min_quantity: String(t.min_quantity),
      unit_price: String(t.unit_price),
    }))
}

export function newTierDraft(): TierDraft {
  return { key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, min_quantity: '', unit_price: '' }
}

export function validateTierDrafts(rows: TierDraft[]): { ok: true; tiers: TierPayload[] } | { ok: false; message: string } {
  const filled = rows.filter((r) => r.min_quantity.trim() !== '' || r.unit_price.trim() !== '')
  if (filled.length === 0) {
    return { ok: false, message: 'Agregá al menos un precio por volumen' }
  }

  const parsed: TierPayload[] = []
  const seenQty = new Set<number>()

  for (const row of filled) {
    const qtyRaw = row.min_quantity.trim()
    if (!/^\d+$/.test(qtyRaw)) {
      return { ok: false, message: 'La cantidad mínima debe ser un número entero' }
    }
    const min_quantity = parseInt(qtyRaw, 10)
    if (min_quantity < 2) {
      return { ok: false, message: 'La cantidad mínima debe ser 2 o más' }
    }
    if (seenQty.has(min_quantity)) {
      return { ok: false, message: `Ya existe un precio por volumen desde ${min_quantity} unidades` }
    }
    seenQty.add(min_quantity)

    const priceParsed = parseUnitPriceInput(row.unit_price)
    if (!priceParsed.ok) return { ok: false, message: priceParsed.message }

    parsed.push({
      id: row.id,
      min_quantity,
      unit_price: priceParsed.value,
    })
  }

  return { ok: true, tiers: parsed.sort((a, b) => a.min_quantity - b.min_quantity) }
}

export function snapshotTiers(tiers: PriceTier[]): PriceTier[] {
  return [...tiers].sort((a, b) => a.min_quantity - b.min_quantity)
}

export function tiersChanged(initial: PriceTier[], current: TierPayload[]): boolean {
  if (initial.length !== current.length) return true
  const sortedInit = snapshotTiers(initial)
  const sortedCur = [...current].sort((a, b) => a.min_quantity - b.min_quantity)
  for (let i = 0; i < sortedInit.length; i++) {
    const a = sortedInit[i]
    const b = sortedCur[i]
    if (a.id !== b.id || a.min_quantity !== b.min_quantity || a.unit_price !== b.unit_price) return true
  }
  return false
}

export type TierDiff = {
  create: { min_quantity: number; unit_price: number }[]
  update: { id: number; min_quantity: number; unit_price: number }[]
  delete: number[]
}

export function computeTierDiff(initial: PriceTier[], current: TierPayload[]): TierDiff {
  const initialById = new Map(initial.map((t) => [t.id, t]))
  const currentIds = new Set(current.filter((t) => t.id != null).map((t) => t.id!))

  const create: TierDiff['create'] = []
  const update: TierDiff['update'] = []
  const deleteIds: number[] = []

  for (const t of current) {
    if (t.id == null) {
      create.push({ min_quantity: t.min_quantity, unit_price: t.unit_price })
      continue
    }
    const prev = initialById.get(t.id)
    if (!prev) {
      create.push({ min_quantity: t.min_quantity, unit_price: t.unit_price })
      continue
    }
    if (prev.min_quantity !== t.min_quantity || prev.unit_price !== t.unit_price) {
      update.push({ id: t.id, min_quantity: t.min_quantity, unit_price: t.unit_price })
    }
  }

  for (const t of initial) {
    if (!currentIds.has(t.id)) deleteIds.push(t.id)
  }

  return { create, update, delete: deleteIds }
}

export async function applyTierDiffOnline(productId: number, diff: TierDiff): Promise<string | null> {
  const { createProductPriceTier, updateProductPriceTier, deleteProductPriceTier } = await import(
    '@/api/productPriceTier'
  )

  for (const id of diff.delete) {
    const res = await deleteProductPriceTier(id)
    if (res.error) return res.error.message
  }
  for (const row of diff.update) {
    const res = await updateProductPriceTier({
      id: row.id,
      min_quantity: row.min_quantity,
      unit_price: row.unit_price,
    })
    if (res.error) return res.error.message
  }
  for (const row of diff.create) {
    const res = await createProductPriceTier({
      id_product: productId,
      min_quantity: row.min_quantity,
      unit_price: row.unit_price,
    })
    if (res.error) return res.error.message
  }
  return null
}
