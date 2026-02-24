import { useState, useEffect } from 'react'
import { Table, Button, Badge, Spinner } from 'react-bootstrap'
import { Plus, FileText } from 'lucide-react'
import { getOrdersPaginated, setOrderStatus } from '@/api/order'
import { Order } from '@/types'
import toast from 'react-hot-toast'
import { PedidoModal } from '@/components/modals/PedidoModal'
import { PedidoPdfModal } from '@/components/modals/PedidoPdfModal'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  FULFILLED: 'Cumplido',
  CANCELED: 'Cancelado',
}

const STATUS_BG: Record<string, string> = {
  PENDING: 'warning',
  FULFILLED: 'success',
  CANCELED: 'secondary',
}

export function Pedidos() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [pdfOrder, setPdfOrder] = useState<Order | null>(null)

  async function loadOrders(lastId?: number) {
    setLoading(true)
    const { data } = await getOrdersPaginated({
      limit: 20,
      last_seen_id: lastId ?? null,
      filters: {},
    })
    if (data) {
      setOrders((prev) => (lastId ? [...prev, ...data.items] : data.items))
      setNextCursor(data.next_cursor)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [])

  async function handleStatusChange(orderId: number, newStatus: string) {
    const { error } = await setOrderStatus(orderId, newStatus)
    if (error) toast.error(error.message)
    else {
      toast.success('Estado actualizado')
      loadOrders()
    }
  }

  function onAddModalClose(refresh?: boolean) {
    setAddModalOpen(false)
    if (refresh) loadOrders()
  }

  function onPdfClose() {
    setPdfOrder(null)
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-dark mb-0">Pedidos</h2>
        <Button className="btn-lepra" onClick={() => setAddModalOpen(true)}>
          <Plus size={18} className="me-1" /> Nuevo pedido
        </Button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <Table responsive hover>
          <thead className="table-dark">
            <tr>
              <th>Cliente</th>
              <th>Total</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.user_name || o.id_user}</td>
                <td>${o.total.toFixed(2)}</td>
                <td>{o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}</td>
                <td>
                  <Badge bg={STATUS_BG[o.status] || 'secondary'}>{STATUS_LABELS[o.status] || o.status}</Badge>
                </td>
                <td>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-dark p-0 me-2"
                    onClick={() => setPdfOrder(o)}
                  >
                    <FileText size={16} /> Ver / Imprimir
                  </Button>
                  {o.status === 'PENDING' && (
                    <>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-success p-0 me-1"
                        onClick={() => handleStatusChange(o.id, 'FULFILLED')}
                      >
                        Cumplir
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-danger p-0"
                        onClick={() => handleStatusChange(o.id, 'CANCELED')}
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {nextCursor && (
        <div className="text-center mt-3">
          <Button variant="outline-dark" size="sm" onClick={() => loadOrders(nextCursor)} disabled={loading}>
            Cargar más
          </Button>
        </div>
      )}

      <PedidoModal show={addModalOpen} onClose={onAddModalClose} />
      {pdfOrder && <PedidoPdfModal order={pdfOrder} show onClose={onPdfClose} />}
    </>
  )
}
