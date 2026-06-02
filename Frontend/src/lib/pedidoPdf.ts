import { jsPDF } from 'jspdf'
import { __createTable, __drawTable } from 'jspdf-autotable'
import type { Order } from '@/types'
import { getImageUrl } from '@/api/client'
import { parseUtcFromApi } from '@/lib/dateApi'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'

const STATUS_ES: Record<string, string> = {
  PENDING: 'Pendiente',
  FULFILLED: 'Cumplido',
  CANCELED: 'Cancelado',
}

/** Opacidad del logo como marca de agua (0 = invisible, 1 = opaco). */
const LOGO_WATERMARK_ALPHA = 0.50

/** 1 unidad de usuario PDF (pt) → mm (72 pt = 1 in). */
const PDF_PT_TO_MM = 25.4 / 72

const LOGO_PNG_NAME = 'lepra-logo-watermark.png'

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
  const faded = document.createElement('canvas')
  faded.width = src.width
  faded.height = src.height
  const fctx = faded.getContext('2d', { alpha: true })
  if (!fctx) return null
  fctx.clearRect(0, 0, faded.width, faded.height)
  fctx.globalAlpha = LOGO_WATERMARK_ALPHA
  fctx.drawImage(src, 0, 0)
  fctx.globalAlpha = 1
  return {
    dataUrl: faded.toDataURL('image/png'),
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

/** Marca de agua PNG (sin pdf.js: evita fallos del worker .mjs en producción). */
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
  doc.addImage(wm.dataUrl, 'PNG', x, y, drawW, drawH)
}

/** PDF del comprobante (una sola fuente de verdad para vista previa, imprimir y compartir). */
export async function buildPedidoPdfBlob(order: Order, productNameById: Record<number, string>): Promise<Blob> {
  const wm = await loadCompanyLogoWatermark()

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
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
  metaLine('Cliente', (order.user_name && order.user_name.trim()) || `Usuario #${order.id_user}`)
  const when = order.created_at
    ? parseUtcFromApi(order.created_at)
    : order.date
      ? parseUtcFromApi(order.date)
      : null
  metaLine('Fecha', when ? when.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
  metaLine('Estado', STATUS_ES[order.status] || order.status)
  if (order.payment?.trim()) metaLine('Notas de pago', String(order.payment).trim())

  const lines = order.lines || []
  const body = lines.map((l) => {
    const nm = (productNameById[l.id_product] && productNameById[l.id_product].trim()) || `Producto #${l.id_product}`
    const sub = l.quantity * l.unit_price
    return [nm, String(l.quantity), formatMoneyWithSymbol(l.unit_price), formatMoneyWithSymbol(sub)]
  })

  const tableW = pageW - margin * 2

  const table = __createTable(doc, {
    startY: y + 4,
    head: [['Producto', 'Cant.', 'P. unit.', 'Subtotal']],
    body: body.length ? body : [['(Sin líneas registradas)', '—', '—', '—']],
    tableWidth: tableW,
    didParseCell: (data) => {
      if (data.section === 'body') {
        data.cell.styles.fillColor = false
      }
      const ci = data.column.index
      if (ci === 1) data.cell.styles.halign = 'center'
      else if (ci === 3) data.cell.styles.halign = 'right'
      else data.cell.styles.halign = 'left'
    },
    styles: {
      fontSize: 9,
      cellPadding: 2,
      overflow: 'linebreak',
      textColor: [22, 22, 22],
    },
    headStyles: {
      fillColor: [26, 26, 26],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 80, halign: 'left' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 39, halign: 'left' },
      3: { cellWidth: 39, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })
  __drawTable(doc, table)

  const finalY = table.finalY ?? y + 40
  const totalBoxY = finalY + 2
  const totalBoxH = 9
  const padX = 2.5

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.45)
  doc.rect(margin, totalBoxY, tableW, totalBoxH, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(26, 26, 26)
  const textBaseline = totalBoxY + totalBoxH - 2.8
  doc.text('Total', margin + padX, textBaseline)
  doc.text(formatMoneyWithSymbol(order.total), margin + tableW - padX, textBaseline, { align: 'right' })

  return doc.output('blob')
}
