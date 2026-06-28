import type { PriceTier } from '@/types'
import { minKgFromPieces } from '@/lib/pricing'

export type TierDraft = {
  key: string
  id?: number
  min_kg: string
  price_per_kg: string
}

export type TierPayload = { min_kg: number; price_per_kg: number; id?: number }

export type TierProductContext = {
  pieceWeightKg?: number | null
  fixedWeight?: boolean
}

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

export function tierDraftsFromProduct(tiers?: PriceTier[], ctx: TierProductContext = {}): TierDraft[] {
  if (!tiers?.length) return []
  const piece = ctx.pieceWeightKg != null && ctx.pieceWeightKg > 0 ? ctx.pieceWeightKg : null
  const fixed = !!ctx.fixedWeight
  return [...tiers]
    .sort((a, b) => a.min_kg - b.min_kg)
    .map((t) => ({
      key: `tier-${t.id}`,
      id: t.id,
      min_kg: fixed ? String(t.min_kg) : piece ? String(Math.round(t.min_kg / piece)) : String(t.min_kg),
      price_per_kg: String(t.price_per_kg),
    }))
}

export function newTierDraft(): TierDraft {
  return { key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, min_kg: '', price_per_kg: '' }
}

export function validateTierDrafts(
  rows: TierDraft[],
  ctx: TierProductContext = {},
): { ok: true; tiers: TierPayload[] } | { ok: false; message: string } {
  const piece = ctx.pieceWeightKg != null && ctx.pieceWeightKg > 0 ? ctx.pieceWeightKg : null
  const fixed = !!ctx.fixedWeight
  const filled = rows.filter((r) => r.min_kg.trim() !== '' || r.price_per_kg.trim() !== '')
  if (filled.length === 0) {
    return { ok: false, message: 'Agregá al menos un precio por volumen' }
  }

  const parsed: TierPayload[] = []
  const seen = new Set<number>()

  for (const row of filled) {
    const minRaw = row.min_kg.trim()
    let min_kg: number
    let seenKey: number

    if (fixed || piece) {
      if (!/^\d+$/.test(minRaw)) {
        return { ok: false, message: 'La cantidad mínima debe ser un número entero de piezas' }
      }
      const pieces = parseInt(minRaw, 10)
      if (pieces < 2) {
        return { ok: false, message: 'La cantidad mínima debe ser 2 piezas o más' }
      }
      min_kg = fixed ? pieces : minKgFromPieces(pieces, piece!)
      seenKey = fixed ? pieces : Math.round(min_kg * 1000)
    } else {
      const trimmed = minRaw.replace(',', '.')
      if (!/^\d+(\.\d+)?$/.test(trimmed)) {
        return { ok: false, message: 'El kg mínimo debe ser un número' }
      }
      min_kg = parseFloat(trimmed)
      if (!Number.isFinite(min_kg) || min_kg < 2) {
        return { ok: false, message: 'El kg mínimo debe ser 2 o más' }
      }
      seenKey = Math.round(min_kg * 1000)
    }

    if (seen.has(seenKey)) {
      return {
        ok: false,
        message: `Ya existe un precio por volumen desde ${minRaw}${fixed || piece ? ' piezas' : ' kg'}`,
      }
    }
    seen.add(seenKey)

    const priceParsed = parseUnitPriceInput(row.price_per_kg)
    if (!priceParsed.ok) return { ok: false, message: priceParsed.message }

    parsed.push({
      id: row.id,
      min_kg,
      price_per_kg: priceParsed.value,
    })
  }

  return { ok: true, tiers: parsed.sort((a, b) => a.min_kg - b.min_kg) }
}

export function snapshotTiers(tiers: PriceTier[]): PriceTier[] {
  return [...tiers].sort((a, b) => a.min_kg - b.min_kg)
}

export function tiersChanged(initial: PriceTier[], current: TierPayload[]): boolean {
  if (initial.length !== current.length) return true
  const sortedInit = snapshotTiers(initial)
  const sortedCur = [...current].sort((a, b) => a.min_kg - b.min_kg)
  for (let i = 0; i < sortedInit.length; i++) {
    const a = sortedInit[i]
    const b = sortedCur[i]
    if (a.id !== b.id || a.min_kg !== b.min_kg || a.price_per_kg !== b.price_per_kg) return true
  }
  return false
}

export type TierDiff = {
  create: { min_kg: number; price_per_kg: number }[]
  update: { id: number; min_kg: number; price_per_kg: number }[]
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
      create.push({ min_kg: t.min_kg, price_per_kg: t.price_per_kg })
      continue
    }
    const prev = initialById.get(t.id)
    if (!prev) {
      create.push({ min_kg: t.min_kg, price_per_kg: t.price_per_kg })
      continue
    }
    if (prev.min_kg !== t.min_kg || prev.price_per_kg !== t.price_per_kg) {
      update.push({ id: t.id, min_kg: t.min_kg, price_per_kg: t.price_per_kg })
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
      min_kg: row.min_kg,
      price_per_kg: row.price_per_kg,
    })
    if (res.error) return res.error.message
  }
  for (const row of diff.create) {
    const res = await createProductPriceTier({
      id_product: productId,
      min_kg: row.min_kg,
      price_per_kg: row.price_per_kg,
    })
    if (res.error) return res.error.message
  }
  return null
}
