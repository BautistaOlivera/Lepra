import { describe, expect, it } from 'vitest'
import { buildQuickClientEmail, findUserByClientQuery, slugifyClientName } from './quickClient'

describe('quickClient', () => {
  it('slugifyClientName normalizes accents', () => {
    expect(slugifyClientName('José Pérez')).toBe('jose-perez')
  })

  it('buildQuickClientEmail uses slug and domain', () => {
    expect(buildQuickClientEmail('Ana')).toMatch(/^ana-[a-z0-9]+@pedido\.local$/)
  })

  it('findUserByClientQuery matches name or email', () => {
    const users = [{ id: 1, name: 'Ana', email: 'ana@test.com' }]
    expect(findUserByClientQuery(users, 'Ana')?.id).toBe(1)
    expect(findUserByClientQuery(users, 'ana@test.com')?.id).toBe(1)
    expect(findUserByClientQuery(users, 'Bob')).toBeUndefined()
  })
})
