import type { Product } from '@/types'

export type ProductStatus = 'active' | 'sin_stock' | 'inactive'

/** Normaliza estado (cache offline legacy con solo active / in_stock). */
export function productStatus(p: Pick<Product, 'status' | 'active' | 'in_stock'>): ProductStatus {
  if (p.status === 'active' || p.status === 'sin_stock' || p.status === 'inactive') {
    return p.status
  }
  if (p.active === false) return 'inactive'
  if (p.in_stock === false) return 'sin_stock'
  return 'active'
}

export function isProductInactive(p: Pick<Product, 'status' | 'active' | 'in_stock'>): boolean {
  return productStatus(p) === 'inactive'
}

export function isProductInCatalog(p: Pick<Product, 'status' | 'active' | 'in_stock'>): boolean {
  return productStatus(p) === 'active'
}

export type ProductAdminStatusFilter = 'all' | 'active' | 'sin_stock' | 'inactive'

export const PRODUCT_ADMIN_STATUS_FILTER_LABELS: Record<ProductAdminStatusFilter, string> = {
  all: 'Todos',
  active: 'En catálogo',
  sin_stock: 'Sin stock',
  inactive: 'Inactivos',
}

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Activo',
  sin_stock: 'Sin stock',
  inactive: 'Inactivo',
}
