import { api } from './client'
import { AuthUser } from '@/types'

export interface LoginResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export async function login(email: string, password: string) {
  return api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function me() {
  return api<AuthUser>('/auth/me', { method: 'GET' })
}
