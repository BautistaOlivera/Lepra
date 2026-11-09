import { api } from './client'
import type { PaginatedRequest, PaginatedResponse, Supplier } from '@/types'

export async function getSuppliersPaginated(params: PaginatedRequest) {
  return api<PaginatedResponse<Supplier>>('/supplier/paginated', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function createSupplier(data: { name: string }) {
  return api<{ message: string; supplier: Supplier }>('/supplier/create', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSupplier(data: { id: number; name?: string; active?: boolean }) {
  return api<{ message: string; supplier: Supplier }>('/supplier/update', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deactivateSupplier(id: number) {
  return api<{ message: string; supplier: Supplier }>(`/supplier/${id}/deactivate`, {
    method: 'PUT',
  })
}
