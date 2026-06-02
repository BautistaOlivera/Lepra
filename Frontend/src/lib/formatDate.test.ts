import { describe, expect, it } from 'vitest'
import {
  displayDateToIso,
  formatDateFromApi,
  isoDateToDisplay,
} from './formatDate'

describe('isoDateToDisplay / displayDateToIso', () => {
  it('convierte ISO a dd/mm/aaaa', () => {
    expect(isoDateToDisplay('2026-05-16')).toBe('16/05/2026')
  })

  it('convierte dd/mm/aaaa a ISO', () => {
    expect(displayDateToIso('16/05/2026')).toBe('2026-05-16')
    expect(displayDateToIso('6/5/2026')).toBe('2026-05-06')
  })

  it('rechaza fechas inválidas', () => {
    expect(displayDateToIso('31/02/2026')).toBeNull()
    expect(displayDateToIso('abc')).toBeNull()
  })
})

describe('formatDateFromApi', () => {
  it('formatea fecha solo ISO', () => {
    expect(formatDateFromApi('2026-05-16')).toBe('16/05/2026')
  })
})
