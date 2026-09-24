import { jsPDF } from 'jspdf'
import { __createTable, __drawTable } from 'jspdf-autotable'
import type { Order } from '@/types'
import { orderCustomerLabel, orderDisplayPaid, orderBalance, paymentMethodLabel } from '@/lib/orderDisplay'
import { getContactConfig } from '@/lib/contactConfig'
import { getImageUrl } from '@/api/client'
import { parseUtcFromApi } from '@/lib/dateApi'
import { formatDateFromApi, formatDateTimeAR } from '@/lib/formatDate'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { formatWeight } from '@/lib/formatWeight'
import { lineTotal, lineTotalFallback } from '@/lib/pricing'
import type { Product } from '@/types'

const STATUS_ES: Record<string, string> = {
  PENDING: 'Pendiente',
  FULFILLED: 'Cumplido',
  CANCELED: 'Cancelado',
}

/** Opacidad del logo como marca de agua (0 = invisible, 1 = opaco). */
const LOGO_WATERMARK_ALPHA = 0.50

/** Tope del lado largo. El logo actual entra entero; el JPEG (no el recorte) es lo que mantiene el PDF liviano. */
const LOGO_WATERMARK_MAX_PX = 2552

const LOGO_WATERMARK_JPEG_QUALITY = 0.9

export function watermarkPixelSize(srcW: number, srcH: number, maxPx = LOGO_WATERMARK_MAX_PX): { width: number; height: number } {
  const longSide = Math.max(srcW, srcH)
  const scale = longSide > maxPx ? maxPx / longSide : 1
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  }
}

/** Solo el archivo: en Android, title/text hacen que WhatsApp no arme la miniatura del PDF. */
export function pedidoPdfShareData(file: File): ShareData {
  return { files: [file] }
}

const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

/**
 * El JPEG del canvas (Chrome/Android) pone la tabla Huffman (DHT) antes del SOF.
 * jsPDF toma el tamaño de ese marcador y embebe una imagen corrupta: Android no
 * genera la preview de WhatsApp. El SOF tiene que ir antes del primer DHT.
 */
export function jpegWithSofBeforeDht(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes
  const segs: Uint8Array[] = []
  let i = 2
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) return bytes
    const marker = bytes[i + 1]
    if (marker === 0xda || marker === 0xd9) {
      segs.push(bytes.slice(i))
      break
    }
    if ((marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) {
      segs.push(bytes.slice(i, i + 2))
      i += 2
      continue
    }
    if (i + 3 >= bytes.length) return bytes
    const len = (bytes[i + 2] << 8) | bytes[i + 3]
    if (len < 2 || i + 2 + len > bytes.length) return bytes
    segs.push(bytes.slice(i, i + 2 + len))
    i += 2 + len
  }
  const sofIdx = segs.findIndex((s) => JPEG_SOF.has(s[1]))
  const dhtIdx = segs.findIndex((s) => s[1] === 0xc4)
  if (sofIdx < 0 || dhtIdx < 0 || dhtIdx > sofIdx) return bytes
  const next = segs.slice()
  const [sof] = next.splice(sofIdx, 1)
  next.splice(next.findIndex((s) => s[1] === 0xc4), 0, sof)
  const out = new Uint8Array(2 + next.reduce((n, s) => n + s.length, 0))
  out[0] = 0xff
  out[1] = 0xd8
  let offset = 2
  for (const seg of next) {
    out.set(seg, offset)
    offset += seg.length
  }
  return out
}

function jpegDataUrlWithSofBeforeDht(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return dataUrl
  const raw = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  const fixed = jpegWithSofBeforeDht(bytes)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < fixed.length; i += chunk) {
    binary += String.fromCharCode(...fixed.subarray(i, i + chunk))
  }
  return `data:image/jpeg;base64,${btoa(binary)}`
}

/** 1 unidad de usuario PDF (pt) → mm (72 pt = 1 in). */
const PDF_PT_TO_MM = 25.4 / 72

const LOGO_PNG_NAME = 'lepra-logo-watermark.png'

export type PedidoPdfProductById = Record<
  number,
  { name: string; brand?: string | null; fixed_weight?: boolean; weight?: number | null }
>

function productName(info: PedidoPdfProductById[number] | undefined, id: number): string {
  return (info?.name && String(info.name).trim()) || `Producto #${id}`
}

function productBrand(info: PedidoPdfProductById[number] | undefined): string {
  return (info?.brand && String(info.brand).trim()) || ''
}

function pdfLineSubtotal(
  weightKg: number,
  unitPrice: number,
  info: PedidoPdfProductById[number] | undefined,
): number {
  if (info?.fixed_weight) {
    const stub = {
      fixed_weight: true,
      weight: info.weight,
      price: unitPrice,
      has_tiered_pricing: false,
    } as Product
    return lineTotal(stub, weightKg, unitPrice)
  }
  if (info) {
    return lineTotal(
      { fixed_weight: false, price: unitPrice, has_tiered_pricing: false } as Product,
      weightKg,
      unitPrice,
    )
  }
  return lineTotalFallback(weightKg, unitPrice)
}

function distributeColumnWidths(showBrandCol: boolean, tableW: number): number[] {
  const weights: number[] = []
  if (showBrandCol) {
    weights.push(52, 28)
  } else {
    weights.push(58)
  }
  weights.push(22, 35, 35)
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => (w / sum) * tableW)
}

function tableCellAt(
  row: { cells: Record<string | number, { x: number; width: number }> },
  index: number,
) {
  return row.cells[index] ?? row.cells[String(index)]
}

export function pedidoPdfFilename(order: Order): string {
  const safeId = order.id < 0 ? `temp-${Math.abs(order.id)}` : String(order.id)
  return `El-Lepra-pedido-${safeId}.pdf`
}

type LogoWatermark = {
  dataUrl: string
  widthMm: number
  heightMm: number
}

function bundledLogoUrl(): string {
  const rawBase = import.meta.env.BASE_URL || '/'
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`
  return `${base}branding/${LOGO_PNG_NAME}`
}

function resolveLogoImageSources(): string[] {
  const sources: string[] = []
  const configured = import.meta.env.VITE_PDF_LOGO_URL?.trim()
  if (configured) {
    const remote = getImageUrl(configured)
    if (!sources.includes(remote)) sources.push(remote)
  }
  const local = bundledLogoUrl()
  if (!sources.includes(local)) sources.push(local)
  return sources
}

function canvasToFadedWatermark(
  src: HTMLCanvasElement,
  widthMm: number,
  heightMm: number,
): LogoWatermark | null {
  const { width, height } = watermarkPixelSize(src.width, src.height)
  const faded = document.createElement('canvas')
  faded.width = width
  faded.height = height
  const fctx = faded.getContext('2d', { alpha: false })
  if (!fctx) return null
  fctx.fillStyle = '#ffffff'
  fctx.fillRect(0, 0, width, height)
  fctx.globalAlpha = LOGO_WATERMARK_ALPHA
  fctx.drawImage(src, 0, 0, width, height)
  fctx.globalAlpha = 1
  return {
    dataUrl: jpegDataUrlWithSofBeforeDht(faded.toDataURL('image/jpeg', LOGO_WATERMARK_JPEG_QUALITY)),
    widthMm,
    heightMm,
  }
}

function loadLogoWatermarkFromImage(url: string): Promise<LogoWatermark | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (!w || !h) {
        resolve(null)
        return
      }
      const widthMm = w * PDF_PT_TO_MM
      const heightMm = h * PDF_PT_TO_MM
      const src = document.createElement('canvas')
      src.width = w
      src.height = h
      const ctx = src.getContext('2d', { alpha: true })
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0)
      resolve(canvasToFadedWatermark(src, widthMm, heightMm))
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Marca de agua JPEG, achicada y sin alfa (sin pdf.js: evita fallos del worker .mjs en producción). */
async function loadCompanyLogoWatermark(): Promise<LogoWatermark | null> {
  if (typeof window === 'undefined') return null
  for (const url of resolveLogoImageSources()) {
    try {
      const wm = await loadLogoWatermarkFromImage(url)
      if (wm) return wm
    } catch (e) {
      console.warn('No se pudo cargar el logo del comprobante:', url, e)
    }
  }
  return null
}

function drawWatermarkBehind(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  wm: LogoWatermark,
): void {
  let drawW = wm.widthMm
  let drawH = wm.heightMm
  const pad = 6
  const maxW = pageW - pad * 2
  const maxH = pageH - pad * 2
  if (drawW > maxW || drawH > maxH) {
    const r = Math.min(maxW / drawW, maxH / drawH)
    drawW *= r
    drawH *= r
  }
  const x = (pageW - drawW) / 2
  const y = (pageH - drawH) / 2
  doc.addImage(wm.dataUrl, 'JPEG', x, y, drawW, drawH)
}

/** PDF del comprobante (una sola fuente de verdad para vista previa, imprimir y compartir). */
export async function buildPedidoPdfBlob(order: Order, productById: PedidoPdfProductById): Promise<Blob> {
  const wm = await loadCompanyLogoWatermark()

  // putOnlyUsedFonts evita un objeto PDF duplicado (jsPDF escribe las 14 fuentes
  // estándar y reutiliza el id 2). Android no repara eso y WhatsApp no arma la miniatura.
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    putOnlyUsedFonts: true,
    compress: true,
  })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14

  if (wm) {
    drawWatermarkBehind(doc, pageW, pageH, wm)
  }

  let y = 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(26, 26, 26)
  doc.text('El Lepra', pageW / 2, y + 4, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text('Comprobante de pedido', pageW / 2, y + 11, { align: 'center' })
  y = 34

  const contactPhone = (getContactConfig().phone || '').trim()
  const footerReserve = contactPhone ? 12 : 0
  const contentBottom = pageH - margin - footerReserve

  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  const metaLine = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, margin, y)
    doc.setFont('helvetica', 'normal')
    const wrapped = doc.splitTextToSize(value, pageW - margin - 48)
    doc.text(wrapped, margin + 42, y)
    y += Math.max(6, wrapped.length * 5)
  }

  metaLine('Nº pedido', `#${order.id}`)
  metaLine('Cliente', orderCustomerLabel(order))
  const when = order.created_at
    ? parseUtcFromApi(order.created_at)
    : order.date
      ? parseUtcFromApi(order.date)
      : null
  metaLine('Fecha', when ? formatDateTimeAR(when) : '—')
  metaLine('Estado', STATUS_ES[order.status] || order.status)

  const lines = order.lines || []
  const showBrandCol = lines.some((l) => productBrand(productById[l.id_product]))

  const head: string[] = ['Producto']
  if (showBrandCol) head.push('Marca')
  head.push('Cant./kg', 'Precio', 'Subtotal')

  const weightCol = 1 + (showBrandCol ? 1 : 0)
  const priceCol = weightCol + 1
  const subCol = priceCol + 1

  const body = lines.map((l) => {
    const info = productById[l.id_product]
    const fixed = info?.fixed_weight || l.sold_by_piece
    const missingWeight = l.weight == null
    const sub = missingWeight ? 0 : pdfLineSubtotal(l.weight || 0, l.price_per_kg || 0, info)
    const qtyCell = missingWeight
      ? 'Sin pesar'
      : fixed && info?.weight
        ? String(Math.max(1, Math.round((l.weight || 0) / info.weight)))
        : formatWeight(l.weight)
    const priceCell = fixed
      ? formatMoneyWithSymbol(l.price_per_kg)
      : `${formatMoneyWithSymbol(l.price_per_kg)}/kg`
    const row: string[] = [productName(info, l.id_product)]
    if (showBrandCol) row.push(productBrand(info))
    row.push(qtyCell, priceCell, missingWeight ? 'Sin pesar' : formatMoneyWithSymbol(sub))
    return row
  })

  const extraAmount = Number(order.extra_amount || 0)
  const extraNote = (order.extra_note || '').trim()
  const showExtra = extraAmount > 0 && !!extraNote

  const tableW = pageW - margin * 2
  const colWidths = distributeColumnWidths(showBrandCol, tableW)
  const emptyDash = '—'
  const emptyRow = head.map(() => emptyDash)
  if (emptyRow.length) emptyRow[0] = '(Sin líneas registradas)'

  const columnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {}
  colWidths.forEach((width, index) => {
    let halign: 'left' | 'center' | 'right' = 'left'
    if (index === weightCol || index === priceCol) halign = 'center'
    else if (index === subCol) halign = 'right'
    columnStyles[index] = { cellWidth: width, halign }
  })

  const cellPadding = 2

  const table = __createTable(doc, {
    startY: y + 4,
    head: [head],
    body: body.length ? body : [emptyRow],
    tableWidth: tableW,
    didParseCell: (data) => {
      if (data.section === 'body') {
        data.cell.styles.fillColor = false
      }
      const ci = data.column.index
      if (ci === weightCol || ci === priceCol) data.cell.styles.halign = 'center'
      else if (ci === subCol) data.cell.styles.halign = 'right'
      else data.cell.styles.halign = 'left'
    },
    styles: {
      fontSize: 9,
      cellPadding,
      overflow: 'linebreak',
      textColor: [22, 22, 22],
    },
    headStyles: {
      fillColor: [26, 26, 26],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles,
    margin: { left: margin, right: margin },
  })
  __drawTable(doc, table)

  const tableLeft = table.settings.margin.left
  const tableWidth = table.getWidth(pageW)
  let cursorY = table.finalY ?? y + 40

  if (showExtra) {
    cursorY += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(26, 26, 26)
    doc.text('Otros (fuera de catálogo)', tableLeft, cursorY)
    cursorY += 4

    const amountStr = formatMoneyWithSymbol(extraAmount)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    const amountW = doc.getTextWidth(amountStr)
    const noteMaxW = Math.max(40, tableWidth - amountW - cellPadding * 3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(22, 22, 22)
    const noteLines = doc.splitTextToSize(extraNote, noteMaxW) as string[]
    const noteBlockH = Math.max(8, noteLines.length * 4.2 + 4)
    const boxY = cursorY
    doc.setDrawColor(120, 120, 120)
    doc.setLineWidth(0.35)
    doc.rect(tableLeft, boxY, tableWidth, noteBlockH, 'S')
    doc.text(noteLines, tableLeft + cellPadding, boxY + 4.2)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(amountStr, tableLeft + tableWidth - cellPadding, boxY + 4.5, { align: 'right' })
    cursorY = boxY + noteBlockH
  }

  const totalBoxY = cursorY + 2
  const totalBoxH = 9

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.45)
  doc.rect(tableLeft, totalBoxY, tableWidth, totalBoxH, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(26, 26, 26)
  const textBaseline = totalBoxY + totalBoxH - 2.8
  doc.text('Total', tableLeft + cellPadding, textBaseline)

  const refRow = table.body[0] ?? table.head[0]
  const subCell = refRow ? tableCellAt(refRow, subCol) : undefined
  const totalX = subCell ? subCell.x + subCell.width - cellPadding : tableLeft + tableWidth - cellPadding
  doc.text(formatMoneyWithSymbol(order.total), totalX, textBaseline, { align: 'right' })

  cursorY = totalBoxY + totalBoxH

  const payments = [...(order.payments || [])].sort((a, b) => {
    const da = (a.paid_at || a.created_at || '').localeCompare(b.paid_at || b.created_at || '')
    if (da !== 0) return -da
    return (b.id || 0) - (a.id || 0)
  })
  const amountPaid = orderDisplayPaid(order)
  const balance = orderBalance(order)
  const showPaymentBlock = payments.length > 0 || (order.status || '').toUpperCase() === 'FULFILLED'

  const ensureSpace = (needed: number) => {
    if (cursorY + needed <= contentBottom) return
    doc.addPage()
    cursorY = margin
  }

  if (showPaymentBlock) {
    cursorY += 6
    ensureSpace(14)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(26, 26, 26)
    doc.text('Cobros', tableLeft, cursorY)
    cursorY += 3

    if (payments.length > 0) {
      for (const p of payments) {
        const when = formatDateFromApi(p.paid_at || p.created_at)
        const method = paymentMethodLabel(p.method)
        const noteBit = (p.note || '').trim() ? ` · ${String(p.note).trim()}` : ''
        const left = `${when} · ${method}${noteBit}`
        const right = formatMoneyWithSymbol(p.amount)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        const rightW = doc.getTextWidth(right)
        doc.setFont('helvetica', 'normal')
        const leftMax = Math.max(36, tableWidth - rightW - cellPadding * 4)
        const leftLines = doc.splitTextToSize(left, leftMax) as string[]
        const rowH = Math.max(8, leftLines.length * 4.2 + 3.5)
        ensureSpace(rowH + 1)

        const boxY = cursorY
        doc.setDrawColor(160, 160, 160)
        doc.setLineWidth(0.3)
        doc.rect(tableLeft, boxY, tableWidth, rowH, 'S')
        doc.setTextColor(22, 22, 22)
        doc.text(leftLines, tableLeft + cellPadding, boxY + 4.2)
        doc.setFont('helvetica', 'bold')
        doc.text(right, tableLeft + tableWidth - cellPadding, boxY + 4.5, { align: 'right' })
        cursorY = boxY + rowH
      }
      cursorY += 2
    }

    const summaryRows: { label: string; value: string }[] = [
      { label: 'Pagado', value: formatMoneyWithSymbol(amountPaid) },
      { label: 'Saldo restante', value: formatMoneyWithSymbol(balance) },
    ]
    const summaryRowH = 7.5
    const summaryH = summaryRows.length * summaryRowH
    ensureSpace(summaryH + 2)

    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.45)
    doc.rect(tableLeft, cursorY, tableWidth, summaryH, 'S')

    summaryRows.forEach((row, i) => {
      const rowY = cursorY + i * summaryRowH
      if (i > 0) {
        doc.setDrawColor(180, 180, 180)
        doc.setLineWidth(0.25)
        doc.line(tableLeft, rowY, tableLeft + tableWidth, rowY)
      }
      const baseline = rowY + summaryRowH - 2.4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(26, 26, 26)
      doc.text(row.label, tableLeft + cellPadding, baseline)
      doc.text(row.value, tableLeft + tableWidth - cellPadding, baseline, { align: 'right' })
    })
    cursorY += summaryH
  }

  const freeNote = (order.payment || '').trim()
  if (freeNote) {
    cursorY += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(26, 26, 26)
    const noteLines = doc.splitTextToSize(freeNote, tableWidth - cellPadding * 2) as string[]
    const noteBlockH = Math.max(10, noteLines.length * 4.2 + 8)
    ensureSpace(noteBlockH + 6)
    doc.text('Notas', tableLeft, cursorY)
    cursorY += 3
    const boxY = cursorY
    doc.setDrawColor(120, 120, 120)
    doc.setLineWidth(0.35)
    doc.rect(tableLeft, boxY, tableWidth, noteBlockH, 'S')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(22, 22, 22)
    doc.text(noteLines, tableLeft + cellPadding, boxY + 5)
    cursorY = boxY + noteBlockH
  }

  if (contactPhone) {
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(90, 90, 90)
      doc.text(`Contacto: ${contactPhone}`, pageW / 2, pageH - 8, { align: 'center' })
    }
  }

  return doc.output('blob')
}
