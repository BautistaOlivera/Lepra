import { api } from './client'
import type { DashboardStats } from '@/types/dashboard'

export async function getDashboardStats() {
  return api<DashboardStats>('/stats/dashboard')
}
