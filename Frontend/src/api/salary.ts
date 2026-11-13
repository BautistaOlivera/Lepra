import { api } from './client'
import type { SalaryMonth } from '@/types'

export type SalaryMonthInput = {
  id_user: number
  year: number
  month: number
  paid: boolean
  amount?: number | null
  paid_at?: string | null
  note?: string | null
}

export async function getSalaryYear(idUser: number, year: number) {
  const q = new URLSearchParams({ id_user: String(idUser), year: String(year) })
  return api<{ items: SalaryMonth[] }>(`/salary/year?${q.toString()}`)
}

export async function upsertSalaryMonth(data: SalaryMonthInput) {
  return api<{ month: SalaryMonth }>('/salary/month', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
