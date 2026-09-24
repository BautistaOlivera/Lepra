import { describe, expect, it } from 'vitest'
import { pedidoPdfShareData, watermarkPixelSize } from './pedidoPdf'

describe('watermarkPixelSize', () => {
  it('mantiene la resolución del logo real', () => {
    expect(watermarkPixelSize(1758, 2552)).toEqual({ width: 1758, height: 2552 })
  })

  it('acota un logo más grande que el tope', () => {
    expect(watermarkPixelSize(3516, 5104)).toEqual({ width: 1758, height: 2552 })
  })

  it('no agranda un logo que ya entra', () => {
    expect(watermarkPixelSize(200, 100)).toEqual({ width: 200, height: 100 })
  })
})

describe('pedidoPdfShareData', () => {
  it('comparte solo el archivo, sin título ni texto', () => {
    const file = new File(['%PDF'], 'El-Lepra-pedido-1.pdf', { type: 'application/pdf' })
    const data = pedidoPdfShareData(file)
    expect(data.files).toEqual([file])
    expect(data.title).toBeUndefined()
    expect(data.text).toBeUndefined()
  })
})
