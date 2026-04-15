import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '..', 'public', 'apple-touch-icon.png')
const W = 180
const H = 180
const png = new PNG({ width: W, height: H })

const BG = { r: 26, g: 26, b: 26 }
const FG = { r: 230, g: 184, b: 0 }

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (W * y + x) << 2
    let c = BG
    // Forma tipo "L" para coincidir con el branding (aprox. en 180px)
    const v = x >= 46 && x <= 76 && y >= 38 && y <= 148
    const h = x >= 46 && x <= 136 && y >= 118 && y <= 148
    if (v || h) c = FG
    png.data[i] = c.r
    png.data[i + 1] = c.g
    png.data[i + 2] = c.b
    png.data[i + 3] = 255
  }
}

fs.writeFileSync(outPath, PNG.sync.write(png))
console.log('Generado', path.relative(path.join(__dirname, '..'), outPath))
