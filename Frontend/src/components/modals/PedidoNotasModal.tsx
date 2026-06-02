import { useEffect, useState } from 'react'
import { Modal, Form, Button, Spinner } from 'react-bootstrap'
import toast from 'react-hot-toast'
import { updateOrder } from '@/api/order'
import { Order } from '@/types'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'

interface PedidoNotasModalProps {
  show: boolean
  onClose: () => void
  order: Order
  onSaved?: (payment: string) => void
}

export function PedidoNotasModal({ show, onClose, order, onSaved }: PedidoNotasModalProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (show) {
      setText(order.payment?.trim() ? order.payment : '')
    }
  }, [show, order.id, order.payment])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (order.id < 0) {
      toast.error('Este pedido aún no está sincronizado; guardá las notas cuando tenga número definitivo')
      return
    }

    const payment = text.trim()
    setLoading(true)

    if (!isOnlineNow()) {
      await enqueueCommand('ORDER_PAYMENT_UPDATE', { id: order.id, payment })
      await lepraDb.orders.update(order.id, { payment: payment || null })
      toast.success('Notas guardadas (pendiente de sincronizar)')
      onSaved?.(payment)
      setLoading(false)
      onClose()
      return
    }

    const { error } = await updateOrder({ id: order.id, payment })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    await lepraDb.orders.update(order.id, { payment: payment || null }).catch(() => {})
    toast.success('Notas guardadas')
    onSaved?.(payment)
    onClose()
  }

  const clientLabel = (order.user_name && order.user_name.trim()) || `Cliente #${order.id_user}`

  return (
    <Modal show={show} onHide={onClose} centered scrollable>
      <Modal.Header closeButton className="border-dark">
        <Modal.Title className="h5 mb-0">Notas de pago — Pedido #{order.id}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSave}>
        <Modal.Body>
          <p className="text-muted small mb-3">
            {clientLabel} · Total {formatMoneyWithSymbol(order.total)}
          </p>
          <p className="small mb-2">
            Anotá cómo va pagando el pedido (montos, medios, pagos parciales). El cliente verá este texto en el
            comprobante.
          </p>
          <Form.Group>
            <Form.Label className="fw-semibold" htmlFor="pedido-notas-pago">
              Anotaciones
            </Form.Label>
            <Form.Control
              id="pedido-notas-pago"
              as="textarea"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Ej:\n15/03 — $5.000 efectivo\n20/03 — $3.200 transferencia\nSaldo pendiente: $1.800'}
              disabled={loading}
              autoFocus
            />
          </Form.Group>
          {order.id < 0 && (
            <p className="text-warning small mt-2 mb-0">
              Pedido en cola de sincronización: las notas se podrán guardar cuando el pedido tenga número en el
              servidor.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer className="border-dark">
          <Button variant="outline-dark" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" className="btn-lepra" disabled={loading || order.id < 0}>
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-1" /> Guardando…
              </>
            ) : (
              'Guardar notas'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
