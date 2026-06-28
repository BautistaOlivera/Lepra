import type { Product, PriceTier } from '@/types'

/** Conserva precios por volumen en cache si el payload entrante no los trae (sync parcial legacy). */
export function mergeProductForCache(existing: Product | undefined, incoming: Product): Product {
  const base = { ...existing, ...incoming } as Product
  if (incoming.price_tiers !== undefined) return base
  if (existing?.price_tiers?.length) {
    return { ...base, price_tiers: existing.price_tiers }
  }
  return base
}

export function tiersFromPayload(
  tiers: { min_kg: number; price_per_kg: number; id?: number }[]
): PriceTier[] {
  return tiers.map((t, i) => ({
    id: t.id ?? -(i + 1),
    min_kg: t.min_kg,
    price_per_kg: t.price_per_kg,
  }))
}

export function applyTierDiffToLocal(
  tiers: PriceTier[] | undefined,
  diff: { create: { min_kg: number; price_per_kg: number }[]; update: { id: number; min_kg: number; price_per_kg: number }[]; delete: number[] }
): PriceTier[] {
  let next = [...(tiers || [])]
  for (const id of diff.delete) next = next.filter((t) => t.id !== id)
  for (const u of diff.update) {
    next = next.map((t) =>
      t.id === u.id ? { id: u.id, min_kg: u.min_kg, price_per_kg: u.price_per_kg } : t
    )
  }
  let temp = -1
  for (const c of diff.create) {
    while (next.some((t) => t.id === temp)) temp -= 1
    next.push({ id: temp, min_kg: c.min_kg, price_per_kg: c.price_per_kg })
  }
  return next.sort((a, b) => a.min_kg - b.min_kg)
}
