import { describe, expect, it } from 'vitest'
import { formatMoney, formatMoneyAxis, formatMoneyCurrency, formatMoneyWithSymbol } from './formatMoney'

describe('formatMoney', () => {
  it('usa separador de miles con punto', () => {
    expect(formatMoney(1234)).toBe('1.234')
    expect(formatMoney(1000000)).toBe('1.000.000')
  })

  it('muestra decimales con coma cuando hace falta', () => {
    expect(formatMoney(1234.5)).toBe('1.234,5')
    expect(formatMoney(10.25)).toBe('10,25')
  })

  it('omite centavos en enteros', () => {
    expect(formatMoney(500)).toBe('500')
  })
})

describe('formatMoneyWithSymbol', () => {
  it('prefija $ sin cambiar el número', () => {
    expect(formatMoneyWithSymbol(3200)).toBe('$3.200')
  })
})

describe('formatMoneyCurrency', () => {
  it('formatea como moneda ARS', () => {
    expect(formatMoneyCurrency(1500)).toMatch(/1\.500/)
  })
})

describe('formatMoneyAxis', () => {
  it('abrevia miles', () => {
    expect(formatMoneyAxis(15000)).toBe('$15 mil')
  })

  it('deja valores chicos sin abreviar', () => {
    expect(formatMoneyAxis(800)).toBe('$800')
  })
})
