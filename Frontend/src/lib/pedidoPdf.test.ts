import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { pedidoPdfShareData, watermarkPixelSize } from './pedidoPdf'

function crc32(buf: Buffer): number {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
  }
  return ~c >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** PNG RGB de 8 bits, sin canal alfa. */
function opaquePng(width: number, height: number): Buffer {
  const stride = width * 3 + 1
  const raw = Buffer.alloc(stride * height, 255)
  for (let y = 0; y < height; y++) raw[y * stride] = 0
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

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
    const { width, height } = watermarkPixelSize(1758, 2552)
    const png = opaquePng(width, height)
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
