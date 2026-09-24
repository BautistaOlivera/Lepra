import { describe, expect, it } from 'vitest'
import { pedidoPdfShareData, watermarkPixelSize } from './pedidoPdf'

describe('watermarkPixelSize', () => {
  it('baja el logo real al lado largo de 600 px', () => {
    expect(watermarkPixelSize(1758, 2552)).toEqual({ width: 413, height: 600 })
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
