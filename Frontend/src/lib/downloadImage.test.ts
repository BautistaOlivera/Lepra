import { describe, it, expect } from 'vitest'
import { sanitizeDownloadFilename } from './downloadImage'

describe('sanitizeDownloadFilename', () => {
  it('replaces unsafe characters', () => {
    expect(sanitizeDownloadFilename('Queso Cremoso 500g')).toBe('Queso-Cremoso-500g')
  })

  it('uses fallback when empty', () => {
    expect(sanitizeDownloadFilename('   ', 'producto')).toBe('producto')
  })
})
