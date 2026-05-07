import { describe, it, expect, beforeEach } from 'vitest'
import { getStoredUser, isAdminUser } from './admin'

describe('offline admin helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('getStoredUser returns null when empty', () => {
    expect(getStoredUser()).toBeNull()
  })

  it('getStoredUser returns null on invalid JSON', () => {
    localStorage.setItem('lepra_user', '{')
    expect(getStoredUser()).toBeNull()
  })

  it('isAdminUser is false without user', () => {
    expect(isAdminUser()).toBe(false)
  })

  it('isAdminUser is true when rol is ADMIN', () => {
    localStorage.setItem(
      'lepra_user',
      JSON.stringify({
        id: 1,
        email: 'a@b.c',
        rol: 'ADMIN',
        active: true,
      })
    )
    expect(isAdminUser()).toBe(true)
  })

  it('isAdminUser is true for admin case-insensitive', () => {
    localStorage.setItem(
      'lepra_user',
      JSON.stringify({
        id: 1,
        email: 'a@b.c',
        rol: 'admin',
        active: true,
      })
    )
    expect(isAdminUser()).toBe(true)
  })

  it('isAdminUser is false for non-admin', () => {
    localStorage.setItem(
      'lepra_user',
      JSON.stringify({
        id: 1,
        email: 'a@b.c',
        rol: 'CLIENT',
        active: true,
      })
    )
    expect(isAdminUser()).toBe(false)
  })
})
