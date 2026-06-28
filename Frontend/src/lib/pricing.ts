import type { PriceTier, Product } from '@/types'

export function pieceWeightKg(product: Pick<Product, 'weight'>): number | null {
  const w = product.weight
  if (w == null || w <= 0) return null
  return w
}

export function isFixedWeightProduct(product: Pick<Product, 'fixed_weight'>): boolean {
  return !!product.fixed_weight
}

export function piecesFromWeight(product: Product, weightKg: number): number {
  const piece = pieceWeightKg(product)
  if (!isFixedWeightProduct(product) || !piece) return 0
  return Math.round(weightKg / piece)
}

/** Precio por kg (productos vendidos por peso). */
export function pricePerKgForWeight(product: Product, weightKg: number): number {
  if (weightKg <= 0) return product.price
  if (!product.has_tiered_pricing || !product.price_tiers?.length) return product.price
  const sorted = [...product.price_tiers].sort((a, b) => b.min_kg - a.min_kg)
  for (const tier of sorted) {
    if (weightKg >= tier.min_kg) return tier.price_per_kg
  }
  return product.price
}

/** Precio por pieza (productos fixed_weight). Tier min_kg = mínimo de piezas. */
export function pricePerPieceForWeight(product: Product, weightKg: number): number {
  if (!product.has_tiered_pricing || !product.price_tiers?.length) return product.price
  const pieces = piecesFromWeight(product, weightKg) || 1
  const sorted = [...product.price_tiers].sort((a, b) => b.min_kg - a.min_kg)
  for (const tier of sorted) {
    if (pieces >= tier.min_kg) return tier.price_per_kg
  }
  return product.price
}

/** Precio unitario de la línea: $/kg o $/pieza. */
export function lineUnitPrice(product: Product, weightKg: number): number {
  if (isFixedWeightProduct(product)) return pricePerPieceForWeight(product, weightKg)
  return pricePerKgForWeight(product, weightKg)
}

export function lineTotal(product: Product, weightKg: number, unitPrice: number): number {
  if (isFixedWeightProduct(product)) {
    const piece = pieceWeightKg(product)
    if (!piece) return 0
    const pieces = weightKg / piece
    return Math.round(pieces * unitPrice * 100) / 100
  }
  return Math.round(weightKg * unitPrice * 100) / 100
}

export function unitPriceLabel(product: Pick<Product, 'fixed_weight'>): string {
  return isFixedWeightProduct(product) ? 'Precio' : '$/kg'
}

export function weightColumnLabel(product: Pick<Product, 'fixed_weight'>): string {
  return isFixedWeightProduct(product) ? 'Piezas' : 'Peso (kg)'
}

export function minKgFromPieces(pieces: number, pieceWeight: number): number {
  return Math.round(pieces * pieceWeight * 1000) / 1000
}

export function piecesFromMinKg(minKg: number, pieceWeight: number): number {
  if (pieceWeight <= 0) return 0
  return Math.round((minKg / pieceWeight) * 1000) / 1000
}

export function defaultLineWeightKg(product: Product): number {
  const piece = pieceWeightKg(product)
  if (isFixedWeightProduct(product) && piece) return piece
  return piece ?? 1
}

export function validateLineWeightKg(
  product: Product,
  weightKg: number,
): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return { ok: false, message: 'El peso debe ser mayor a 0' }
  }
  if (isFixedWeightProduct(product)) {
    const piece = pieceWeightKg(product)
    if (!piece) return { ok: false, message: 'Producto con peso fijo mal configurado' }
    const pieces = weightKg / piece
    if (Math.abs(pieces - Math.round(pieces)) > 0.001) {
      return { ok: false, message: `El peso debe ser múltiplo de ${piece} kg` }
    }
  }
  return { ok: true }
}

export function tierLabel(tier: PriceTier, pieceWeight: number | null, fixedWeight: boolean): string {
  if (fixedWeight) {
    return `${tier.min_kg} piezas`
  }
  if (pieceWeight && pieceWeight > 0) {
    const pieces = piecesFromMinKg(tier.min_kg, pieceWeight)
    return `${pieces} piezas (${tier.min_kg} kg)`
  }
  return `${tier.min_kg} kg`
}

export function tierPriceLabel(fixedWeight: boolean): string {
  return fixedWeight ? '$/pieza' : '$/kg'
}

/** Calcula subtotal cuando no hay producto (fallback kg × precio). */
export function lineTotalFallback(weightKg: number, unitPrice: number): number {
  return Math.round(weightKg * unitPrice * 100) / 100
}

/** Subtotal con producto o flag sold_by_piece del pedido. */
export function orderLineSubtotal(
  weightKg: number,
  unitPrice: number,
  product?: Product | null,
  soldByPiece?: boolean,
): number {
  if (product) return lineTotal(product, weightKg, unitPrice)
  if (soldByPiece) {
    return Math.round(unitPrice * 100) / 100
  }
  return lineTotalFallback(weightKg, unitPrice)
}
