import { describe, expect, it } from 'vitest'
import { orderCustomerLabel } from './orderDisplay'

describe('orderCustomerLabel', () => {
  it('prefers user_name then customer_name', () => {
    expect(orderCustomerLabel({ user_name: 'Ana', customer_name: 'Bob', id_user: 1 })).toBe('Ana')
    expect(orderCustomerLabel({ user_name: null, customer_name: '  Mostrador  ', id_user: null })).toBe('Mostrador')
  })

  it('falls back to id or sin cliente', () => {
    expect(orderCustomerLabel({ user_name: null, customer_name: null, id_user: 5 })).toBe('Cliente #5')
    expect(orderCustomerLabel({ user_name: null, customer_name: null, id_user: null })).toBe('Sin cliente')
  })
})
