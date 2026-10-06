import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { PNG } from 'pngjs'
import { pedidoPdfShareData, watermarkPixelSize } from './pedidoPdf'

describe('watermarkPixelSize', () => {
  it('acota el logo real a 800 px del lado largo', () => {
    expect(watermarkPixelSize(1758, 2552)).toEqual({ width: 551, height: 800 })
  })

  it('no agranda un logo que ya entra', () => {
    expect(watermarkPixelSize(200, 100)).toEqual({ width: 200, height: 100 })
  })
})

describe('marca de agua en el PDF', () => {
  it('queda opaca, sin predictor, y lejos de los 18 MB', () => {
    const src = PNG.sync.read(readFileSync('public/branding/lepra-logo-watermark.png'))
    const { width, height } = watermarkPixelSize(src.width, src.height)
    const out = new PNG({ width, height, colorType: 2 })
    const scaleX = src.width / width
    const scaleY = src.height / height
    for (let y = 0; y < height; y++) {
      const sy = Math.min(src.height - 1, Math.floor(y * scaleY))
      for (let x = 0; x < width; x++) {
        const sx = Math.min(src.width - 1, Math.floor(x * scaleX))
        const si = (sy * src.width + sx) << 2
        const di = (y * width + x) << 2
        const a = src.data[si + 3] / 255
        const blend = a * 0.5
        out.data[di] = Math.round(255 * (1 - blend) + src.data[si] * blend)
        out.data[di + 1] = Math.round(255 * (1 - blend) + src.data[si + 1] * blend)
        out.data[di + 2] = Math.round(255 * (1 - blend) + src.data[si + 2] * blend)
        out.data[di + 3] = 255
      }
    }
    const png = PNG.sync.write(out, { colorType: 2 })
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`
    const doc = new jsPDF({ unit: 'mm', format: 'a4', putOnlyUsedFonts: true, compress: true })
    doc.addImage(dataUrl, 'PNG', 6, 6, 180, 250, undefined, 'NONE')
    doc.text('El Lepra', 20, 20)
    const pdf = Buffer.from(doc.output('arraybuffer'))
    const latin = pdf.toString('latin1')
    expect(latin).toContain(`/Width ${width}`)
    expect(latin).toContain(`/Height ${height}`)
    expect(latin).not.toContain('/SMask')
    expect(latin).not.toContain('/Predictor')
    expect(pdf.length).toBeLessThan(1_500_000)
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
