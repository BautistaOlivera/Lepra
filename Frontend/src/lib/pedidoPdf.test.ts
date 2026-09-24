import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { jpegWithSofBeforeDht, pedidoPdfShareData, watermarkPixelSize } from './pedidoPdf'

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

describe('jpegWithSofBeforeDht', () => {
  it('pasa el SOF adelante del DHT, que es el orden que jsPDF lee bien', () => {
    const seg = (marker: number, payload: number[]) => {
      const len = payload.length + 2
      const out = new Uint8Array(4 + payload.length)
      out[0] = 0xff
      out[1] = marker
      out[2] = len >> 8
      out[3] = len & 0xff
      out.set(payload, 4)
      return out
    }
    const parts = [
      new Uint8Array([0xff, 0xd8]),
      seg(0xe0, [0, 0]),
      seg(0xc4, [1, 2, 3, 4]),
      seg(0xc0, [8, 0, 10, 0, 20, 3]),
      new Uint8Array([0xff, 0xda, 0x00, 0x02]),
    ]
    const input = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    let offset = 0
    for (const part of parts) {
      input.set(part, offset)
      offset += part.length
    }
    const out = jpegWithSofBeforeDht(input)
    const markers: number[] = []
    for (let i = 0; i < out.length - 1; i++) {
      if (out[i] === 0xff && (out[i + 1] === 0xc0 || out[i + 1] === 0xc4)) markers.push(out[i + 1])
    }
    expect(markers).toEqual([0xc0, 0xc4])
  })

  it('hace que jsPDF embeba el tamaño real cuando el DHT venía primero', () => {
    const jpgPath = `${process.env.TEMP}\\lepra-wm-full-q90.jpg`
    const fs = require('node:fs') as typeof import('node:fs')
    if (!fs.existsSync(jpgPath)) return
    const jpg = new Uint8Array(fs.readFileSync(jpgPath))
    const segs: Uint8Array[] = []
    let i = 2
    while (i + 1 < jpg.length) {
      const marker = jpg[i + 1]
      if (marker === 0xda) {
        segs.push(jpg.slice(i))
        break
      }
      const len = (jpg[i + 2] << 8) | jpg[i + 3]
      segs.push(jpg.slice(i, i + 2 + len))
      i += 2 + len
    }
    const take = (m: number) => segs.filter((s) => s[1] === m)
    const rest = segs.filter((s) => ![0xe0, 0xdb, 0xc4, 0xc0].includes(s[1]))
    const chrome = [new Uint8Array([0xff, 0xd8]), ...take(0xe0), ...take(0xdb), ...take(0xc4), ...take(0xc0), ...rest]
    const broken = new Uint8Array(chrome.reduce((n, p) => n + p.length, 0))
    let o = 0
    for (const part of chrome) {
      broken.set(part, o)
      o += part.length
    }
    const fixed = jpegWithSofBeforeDht(broken)
    const dataUrl = `data:image/jpeg;base64,${Buffer.from(fixed).toString('base64')}`
    const doc = new jsPDF({ putOnlyUsedFonts: true, compress: true })
    doc.addImage(dataUrl, 'JPEG', 0, 0, 10, 10)
    doc.text('El Lepra', 10, 10)
    const pdf = Buffer.from(doc.output('arraybuffer')).toString('latin1')
    expect(pdf).toContain('/Width 1758')
    expect(pdf).toContain('/Height 2552')
    expect(pdf).not.toContain('/Height 1\n')
    expect(pdf.split('2 0 obj').length - 1).toBe(1)
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
