import { useEffect, useRef, useState } from 'react'
import { Modal, Button, Spinner } from 'react-bootstrap'
import { Printer, Share2, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { Order } from '@/types'
import { buildPedidoPdfBlob, pedidoPdfFilename } from '@/lib/pedidoPdf'
import { lepraDb } from '@/offline/db'

interface PedidoPdfModalProps {
  show: boolean
  onClose: () => void
  order: Order
}

export function PedidoPdfModal({ show, onClose, order }: PedidoPdfModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!show) {
      setLoading(true)
      setPdfUrl(null)
      setPdfBlob(null)
      return
    }

    let cancelled = false

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setPdfUrl(null)
    setPdfBlob(null)
    setLoading(true)

    ;(async () => {
      const lines = order.lines || []
      const ids = [...new Set(lines.map((l) => l.id_product))]
      const nameById: Record<number, string> = {}
      await Promise.all(
        ids.map(async (id) => {
          try {
            const p = await lepraDb.products.get(id)
            nameById[id] = (p?.name && String(p.name).trim()) || ''
          } catch {
            nameById[id] = ''
          }
        }),
      )
      if (cancelled) return
      let blob: Blob
      try {
        blob = await buildPedidoPdfBlob(order, nameById)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setLoading(false)
          toast.error('No se pudo generar el PDF')
        }
        return
      }
      if (cancelled) return
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      setPdfUrl(url)
      setPdfBlob(blob)
      setLoading(false)
    })()

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [show, order, order.payment])

  function handlePrint() {
    const win = iframeRef.current?.contentWindow
    if (!win || loading || !pdfUrl) {
      toast.error('Esperá a que termine de cargar el PDF')
      return
    }
    try {
      win.focus()
      win.print()
    } catch {
      toast.error('No se pudo abrir el cuadro de impresión')
    }
  }

  function handleDownload() {
    if (!pdfBlob && !pdfUrl) return
    const url = pdfUrl ?? URL.createObjectURL(pdfBlob!)
    const a = document.createElement('a')
    a.href = url
    a.download = pedidoPdfFilename(order)
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    if (!pdfUrl && pdfBlob) URL.revokeObjectURL(url)
  }

  async function handleShare() {
    if (!pdfBlob) {
      toast.error('PDF no listo')
      return
    }
    const name = pedidoPdfFilename(order)
    const file = new File([pdfBlob], name, { type: 'application/pdf' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Pedido #${order.id}`,
          text: `Pedido #${order.id} — Total $${order.total.toFixed(2)}`,
        })
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      console.error(e)
    }
    handleDownload()
    toast('Este dispositivo o navegador no comparte el PDF directamente; se descargó para que lo adjuntes en WhatsApp u otra app.', {
      duration: 5000,
    })
  }

  return (
    <Modal show={show} onHide={onClose} size="xl" fullscreen="lg-down" centered scrollable>
      <Modal.Header closeButton className="border-dark">
        <Modal.Title className="d-flex flex-column flex-sm-row align-items-sm-center gap-2">
          <span>Pedido #{order.id}</span>
          <span className="text-muted small fw-normal">Vista previa del comprobante</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0 d-flex flex-column bg-body-secondary" style={{ minHeight: 'min(72vh, 600px)' }}>
        {loading ? (
          <div className="d-flex flex-column align-items-center justify-content-center gap-2 flex-grow-1 py-5">
            <Spinner animation="border" variant="dark" />
            <span className="text-muted small">Generando PDF…</span>
          </div>
        ) : pdfUrl ? (
          <iframe
            ref={iframeRef}
            title={`Comprobante pedido ${order.id}`}
            src={pdfUrl}
            className="w-100 border-0 flex-grow-1 bg-white"
            style={{ minHeight: 'min(62vh, 520px)', height: '62vh' }}
          />
        ) : (
          <div className="text-center text-muted py-5 flex-grow-1">No se pudo mostrar el PDF.</div>
        )}

        <div className="border-top bg-body p-3 d-flex flex-wrap gap-2 justify-content-end align-items-center">
          <Button variant="outline-dark" onClick={onClose}>
            Cerrar
          </Button>
          <Button variant="outline-dark" onClick={handleDownload} disabled={loading || !pdfBlob}>
            <Download size={18} className="me-1" /> Descargar PDF
          </Button>
          <Button variant="outline-dark" onClick={handleShare} disabled={loading || !pdfBlob}>
            <Share2 size={18} className="me-1" /> Compartir
          </Button>
          <Button className="btn-lepra" onClick={handlePrint} disabled={loading || !pdfUrl}>
            <Printer size={18} className="me-1" /> Imprimir
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  )
}
