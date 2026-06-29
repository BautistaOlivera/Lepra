import { api, apiUpload, getImageUrl } from './client'
import { Product, PaginatedRequest, PaginatedResponse, ProductStatus } from '@/types'

export { getImageUrl }

export async function uploadProductImage(file: File, productName: string, productBrand?: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('name', productName.trim())
  const brand = productBrand?.trim()
  if (brand) form.append('brand', brand)
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

export async function createProduct(data: { name: string; price: number; weight?: number | null; fixed_weight?: boolean; brand?: string; category?: string; has_tiered_pricing?: boolean; img?: string }) {
  return api<{ message: string; id: number }>('/product/create', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateProduct(data: { id: number; name?: string; price?: number; weight?: number | null; fixed_weight?: boolean; brand?: string; category?: string; has_tiered_pricing?: boolean; img?: string; active?: boolean; status?: ProductStatus }) {
  return api<{ message: string }>('/product/update', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function setProductVisibility(id: number, status: 'active' | 'sin_stock') {
  return api<{ message: string; status: string }>(`/product/${id}/visibility`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export async function deactivateProduct(id: number) {
  return api<{ message: string }>(`/product/${id}/deactivate`, { method: 'PUT' })
}
