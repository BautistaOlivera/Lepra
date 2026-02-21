import { api } from './client'
import { User, PaginatedRequest, PaginatedResponse } from '@/types'

export async function getUsersPaginated(params: PaginatedRequest) {
  return api<PaginatedResponse<User>>('/user/paginated', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function getUser(id: number) {
  return api<User>(`/user/${id}`)
}

export async function createUser(data: { email: string; password: string; name?: string; location?: string; rol: string }) {
  return api<{ message: string; user: User }>('/user/create', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateUser(data: { id: number; email?: string; password?: string; name?: string; location?: string; rol?: string; active?: boolean }) {
  return api<{ message: string }>('/user/update', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deactivateUser(id: number) {
  return api<{ message: string }>(`/user/${id}/deactivate`, { method: 'PUT' })
}
