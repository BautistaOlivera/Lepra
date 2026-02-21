import { useRef } from 'react'
import { Modal, Button } from 'react-bootstrap'
import { Printer, Share2 } from 'lucide-react'
import { Order } from '@/types'

interface PedidoPdfModalProps {
  show: boolean
  onClose: () => void
  order: Order
}

export function PedidoPdfModal({ show, onClose, order }: PedidoPdfModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Pedido #${order.id}</title>
        <style>
          body{font-family:sans-serif;padding:20px;max-width:500px;margin:0 auto}
          .header{text-align:center;border-bottom:2px solid #e6b800;padding-bottom:12px}
          .row{display:flex;justify-content:space-between;margin:8px 0}
          .total{font-weight:bold;font-size:1.2em;margin-top:16px;border-top:1px solid #ddd;padding-top:12px}
        </style>
        </head>
        <body>${content}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
    printWindow.close()
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pedido #${order.id} - Lepra`,
          text: `Pedido #${order.id}. Total: $${order.total.toFixed(2)}`,
        })
      } catch (e) {
        if ((e as Error).name !== 'AbortError') console.error(e)
      }
    } else {
      navigator.clipboard?.writeText(`Pedido #${order.id} - Total: $${order.total.toFixed(2)}`)
    }
  }

  const lines = order.lines || []

  return (
    <Modal show={show} onHide={onClose} size="lg">
      <Modal.Header closeButton className="border-dark">
        <Modal.Title>Pedido #{order.id}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div ref={printRef} className="p-4 border rounded">
          <div className="header">
            <h4 className="mb-0">Lepra</h4>
            <p className="text-muted small mb-0">Resumen del pedido</p>
          </div>
          <div className="mt-3">
            <div className="row"><span>Nº pedido</span><span>#{order.id}</span></div>
            <div className="row"><span>Usuario</span><span>{order.id_user}</span></div>
            <div className="row"><span>Fecha</span><span>{order.created_at ? new Date(order.created_at).toLocaleString() : '-'}</span></div>
            <div className="row"><span>Estado</span><span>{order.status}</span></div>
          </div>
          <hr />
          <table className="table table-sm">
            <thead>
              <tr><th>Producto</th><th>Cant.</th><th>P. u.</th><th>Subtotal</th></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.id_product}</td>
                  <td>{l.quantity}</td>
                  <td>${l.unit_price.toFixed(2)}</td>
                  <td>${(l.quantity * l.unit_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row total">
            <span>Total</span><span>${order.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="d-flex gap-2 mt-3">
          <Button className="btn-lepra" onClick={handlePrint}>
            <Printer size={18} className="me-1" /> Imprimir
          </Button>
          <Button variant="outline-dark" onClick={handleShare}>
            <Share2 size={18} className="me-1" /> Compartir
          </Button>
          <Button variant="outline-dark" onClick={onClose}>Cerrar</Button>
        </div>
      </Modal.Body>
    </Modal>
  )
}
