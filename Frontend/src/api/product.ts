import { api, apiUpload, getImageUrl } from './client'
import { Product, PaginatedRequest, PaginatedResponse } from '@/types'

export { getImageUrl }

export async function uploadProductImage(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiUpload<{ url: string }>('/product/upload', form)
}

export async function getProductsPaginated(params: PaginatedRequest) {
  return api<PaginatedResponse<Product>>('/product/paginated', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getProduct(id: number) {
  return api<Product>(`/product/${id}`)
}

export async function createProduct(data: { name: string; price: number; brand?: string; category?: string; has_tiered_pricing?: boolean; img?: string }) {
  return api<{ message: string; id: number }>('/product/create', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateProduct(data: { id: number; name?: string; price?: number; brand?: string; category?: string; has_tiered_pricing?: boolean; img?: string; active?: boolean }) {
  return api<{ message: string }>('/product/update', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deactivateProduct(id: number) {
  return api<{ message: string }>(`/product/${id}/deactivate`, { method: 'PUT' })
}
