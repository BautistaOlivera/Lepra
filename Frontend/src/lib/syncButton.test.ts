import { describe, it, expect } from 'vitest'
import { getSyncVisualState, syncButtonProps } from './syncButton'

describe('getSyncVisualState', () => {
  it('returns error when failed or auth required', () => {
    expect(getSyncVisualState(0, 1, false)).toBe('error')
    expect(getSyncVisualState(3, 0, true)).toBe('error')
  })

  it('returns pending when only pending count', () => {
    expect(getSyncVisualState(2, 0, false)).toBe('pending')
  })

  it('returns ok when clear', () => {
    expect(getSyncVisualState(0, 0, false)).toBe('ok')
  })
})

describe('syncButtonProps', () => {
  it('maps states to bootstrap variants and classes', () => {
    expect(syncButtonProps('ok').variant).toBe('success')
    expect(syncButtonProps('pending').className).toContain('lepra-sync-btn--pending')
    expect(syncButtonProps('error').variant).toBe('danger')
  })
})
