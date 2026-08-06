import { api } from './client'
import { Order, OrderPayment, OrderPaymentMethod, PaginatedRequest, PaginatedResponse } from '@/types'

export async function getOrdersPaginated(params: PaginatedRequest) {
  return api<PaginatedResponse<Order>>('/order/paginated', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getOrder(id: number) {
  return api<Order>(`/order/${id}`)
}

export async function createOrderClient(data: { date?: string; payment?: string; lines: { id_product: number; weight: number }[] }) {
  return api<{ message: string; id: number; total: number }>('/order/create-client', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function createOrder(data: {
  id_user?: number | null
  customer_name?: string | null
  date?: string
  payment?: string
  extra_amount?: number
  extra_note?: string | null
  lines: { id_product: number; weight: number | null; price_per_kg?: number }[]
}) {
  return api<{ message: string; id: number; total: number }>('/order/create-admin', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateOrder(data: {
  id: number
  id_user?: number | null
  customer_name?: string | null
  date?: string
  payment?: string
  status?: string
  active?: boolean
  extra_amount?: number
  extra_note?: string | null
  lines?: { id_product: number; weight: number | null; price_per_kg?: number }[]
}) {
  return api<{ message: string; total?: number }>('/order/update', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function setOrderStatus(id: number, status: string) {
  return api<{ message: string }>(`/order/${id}/status?status=${status}`, { method: 'PUT' })
}

export async function addOrderPayment(
  orderId: number,
  data: {
    amount: number
    method: OrderPaymentMethod | string
    paid_at?: string | null
    note?: string | null
  }
) {
  return api<{
    message: string
    payment: OrderPayment
    payments: OrderPayment[]
    amount_paid: number
    balance: number
    total: number
  }>(`/order/${orderId}/payments`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteOrderPayment(orderId: number, paymentId: number) {
  return api<{
    message: string
    payments: OrderPayment[]
    amount_paid: number
    balance: number
    total: number
  }>(`/order/${orderId}/payments/${paymentId}`, { method: 'DELETE' })
}
