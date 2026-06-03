import { api } from './client'

export async function createProductPriceTier(data: {
  id_product: number
  min_quantity: number
  unit_price: number
}) {
  return api<{ message: string; id: number }>('/product-price-tier/create', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateProductPriceTier(data: {
  id: number
  min_quantity?: number
  unit_price?: number
}) {
  return api<{ message: string }>('/product-price-tier/update', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteProductPriceTier(id: number) {
  return api<{ message: string }>(`/product-price-tier/${id}`, { method: 'DELETE' })
}
