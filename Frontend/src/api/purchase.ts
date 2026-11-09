import { api } from './client'
import type { PaginatedRequest, PaginatedResponse, Purchase } from '@/types'

export type PurchaseWrite = {
  id_supplier: number
  date?: string | null
  unitemized_amount: number
  note?: string | null
  lines: { id_product: number; weight: number; price_per_kg: number }[]
}

export async function getPurchasesPaginated(params: PaginatedRequest) {
  return api<PaginatedResponse<Purchase>>('/purchase/paginated', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function createPurchase(data: PurchaseWrite) {
  return api<{ message: string; id: number; total: number; purchase: Purchase }>('/purchase/create', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updatePurchase(data: PurchaseWrite & { id: number }) {
  return api<{ message: string; id: number; total: number; purchase: Purchase }>('/purchase/update', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deactivatePurchase(id: number) {
  return api<{ message: string; purchase: Purchase }>(`/purchase/${id}/deactivate`, {
    method: 'PUT',
  })
}
