import { describe, expect, it } from 'vitest'
import { pedidoPdfShareData } from './pedidoPdf'

describe('pedidoPdfShareData', () => {
  it('comparte solo el archivo, sin título ni texto', () => {
    const file = new File(['%PDF'], 'El-Lepra-pedido-1.pdf', { type: 'application/pdf' })
    const data = pedidoPdfShareData(file)
    expect(data.files).toEqual([file])
    expect(data.title).toBeUndefined()
    expect(data.text).toBeUndefined()
  })
})
