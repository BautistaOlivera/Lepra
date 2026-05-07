import { describe, it, expect, vi, afterEach } from 'vitest'
import { isOnlineNow } from './network'

describe('isOnlineNow', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when navigator is undefined', () => {
    vi.stubGlobal('navigator', undefined)
    expect(isOnlineNow()).toBe(true)
  })

  it('reflects navigator.onLine when defined', () => {
    vi.stubGlobal('navigator', { onLine: false } as Navigator)
    expect(isOnlineNow()).toBe(false)
    vi.stubGlobal('navigator', { onLine: true } as Navigator)
    expect(isOnlineNow()).toBe(true)
  })
})
