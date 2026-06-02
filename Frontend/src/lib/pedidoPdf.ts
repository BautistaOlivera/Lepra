import { jsPDF } from 'jspdf'
import { __createTable, __drawTable } from 'jspdf-autotable'
import type { Order } from '@/types'
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

export function pedidoPdfFilename(order: Order): string {
  const safeId = order.id < 0 ? `temp-${Math.abs(order.id)}` : String(order.id)
  return `El-Lepra-pedido-${safeId}.pdf`
}

let pdfWorkerSetup: Promise<void> | null = null

function ensurePdfJsWorker(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (!pdfWorkerSetup) {
    pdfWorkerSetup = (async () => {
      const pdfjs = await import('pdfjs-dist')
      const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default
    })()
  }
  return pdfWorkerSetup
}

type LogoWatermark = {
  dataUrl: string
  /** Tamaño “real” del arte en la 1.ª página del PDF (mm). */
  widthMm: number
  heightMm: number
}

/**
 * Primera página del PDF de marca → PNG semitransparente + medidas en mm
 * (misma escala física que el PDF origen).
 */
async function loadCompanyLogoWatermark(): Promise<LogoWatermark | null> {
  if (typeof window === 'undefined') return null
  try {
    await ensurePdfJsWorker()
    const { getDocument } = await import('pdfjs-dist')
    const rawBase = import.meta.env.BASE_URL || '/'
    const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`
    const res = await fetch(`${base}branding/lepra-logo.pdf`)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const data = new Uint8Array(buf.slice(0))
    const pdf = await getDocument({ data }).promise
    const page = await pdf.getPage(1)

    const vp1 = page.getViewport({ scale: 1 })
    const widthMm = vp1.width * PDF_PT_TO_MM
    const heightMm = vp1.height * PDF_PT_TO_MM

    const renderScale = Math.min(3, Math.max(2, 900 / Math.max(vp1.width, vp1.height, 1)))
    const viewport = page.getViewport({ scale: renderScale })
    const w = Math.floor(viewport.width)
    const h = Math.floor(viewport.height)

    const src = document.createElement('canvas')
    src.width = w
    src.height = h
    const sctx = src.getContext('2d', { alpha: true })
    if (!sctx) return null
    sctx.clearRect(0, 0, w, h)
    const task = page.render({ canvas: src, canvasContext: sctx, viewport })
    await task.promise

    const faded = document.createElement('canvas')
    faded.width = w
    faded.height = h
    const fctx = faded.getContext('2d', { alpha: true })
    if (!fctx) return null
    fctx.clearRect(0, 0, w, h)
    fctx.globalAlpha = LOGO_WATERMARK_ALPHA
    fctx.drawImage(src, 0, 0)
    fctx.globalAlpha = 1

    return {
      dataUrl: faded.toDataURL('image/png'),
      widthMm,
      heightMm,
    }
  } catch (e) {
    console.warn('No se pudo cargar el logo (branding/lepra-logo.pdf):', e)
    return null
  }
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
