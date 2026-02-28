import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Spinner, Form, InputGroup } from 'react-bootstrap'
import { Plus, FileText, Search, Calendar, RotateCcw } from 'lucide-react'
import { createColumnHelper } from '@tanstack/react-table'
import { getOrdersPaginated, setOrderStatus } from '@/api/order'
import { Order } from '@/types'
import toast from 'react-hot-toast'
import { PedidoModal } from '@/components/modals/PedidoModal'
import { PedidoPdfModal } from '@/components/modals/PedidoPdfModal'
import { DataTable } from '@/components/DataTable'
import { Select } from '@/components/Select'

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
const columnHelper = createColumnHelper<Order>()

export function Pedidos() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [pdfOrder, setPdfOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const loadOrders = useCallback(async (lastId?: number) => {
    setLoading(true)
    const filters: Record<string, unknown> = {}
    if (searchDebounced.trim()) filters.search = searchDebounced.trim()
    if (dateFrom) filters.date_from = dateFrom
    if (dateTo) filters.date_to = dateTo
    if (statusFilter) filters.status = statusFilter
    const { data } = await getOrdersPaginated({
      limit: 20,
      last_seen_id: lastId ?? null,
      filters,
    })
    if (data) {
      setOrders((prev) => (lastId ? [...prev, ...data.items] : data.items))
      setNextCursor(data.next_cursor)
    }
    setLoading(false)
  }, [searchDebounced, dateFrom, dateTo, statusFilter])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

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

  function clearFilters() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setStatusFilter(null)
  }

  const columns = [
    columnHelper.accessor('user_name', {
      header: 'Cliente',
      cell: (info) => info.getValue() || info.row.original.id_user,
    }),
    columnHelper.accessor('total', {
      header: 'Total',
      cell: (info) => `$${info.getValue().toFixed(2)}`,
    }),
    columnHelper.accessor('created_at', {
      header: 'Fecha',
      cell: (info) =>
        info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : '-',
    }),
    columnHelper.accessor('status', {
      header: 'Estado',
      cell: (info) => (
        <Badge bg={STATUS_BG[info.getValue()] || 'secondary'}>
          {STATUS_LABELS[info.getValue()] || info.getValue()}
        </Badge>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <>
          <Button
            variant="link"
            size="sm"
            className="text-dark p-0 me-2"
            onClick={() => setPdfOrder(row.original)}
          >
            <FileText size={16} /> Ver / Imprimir
          </Button>
          {row.original.status === 'PENDING' && (
            <>
              <Button
                variant="link"
                size="sm"
                className="text-success p-0 me-1"
                onClick={() => handleStatusChange(row.original.id, 'FULFILLED')}
              >
                Cumplir
              </Button>
              <Button
                variant="link"
                size="sm"
                className="text-danger p-0"
                onClick={() => handleStatusChange(row.original.id, 'CANCELED')}
              >
                Cancelar
              </Button>
            </>
          )}
        </>
      ),
    }),
  ]

  return (
    <>
      <h2 className="text-dark mb-3">Pedidos</h2>
      <div className="d-flex align-items-center gap-2 mb-4 flex-wrap" style={{ width: '100%' }}>
        <InputGroup className="flex-grow-1" style={{ minWidth: 200, maxWidth: 340 }}>
          <InputGroup.Text><Search size={18} /></InputGroup.Text>
          <Form.Control
            placeholder="Buscar pedidos por cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <InputGroup style={{ width: 190 }}>
          <InputGroup.Text><Calendar size={16} /></InputGroup.Text>
          <Form.Control
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </InputGroup>
        <span className="text-muted align-self-center" style={{ fontSize: '0.9rem' }}>–</span>
        <InputGroup style={{ width: 190 }}>
          <InputGroup.Text><Calendar size={16} /></InputGroup.Text>
          <Form.Control
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </InputGroup>
        <div style={{ width: 140 }}>
          <Select<string>
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'PENDING', label: 'Pendiente' },
              { value: 'FULFILLED', label: 'Cumplido' },
              { value: 'CANCELED', label: 'Cancelado' },
            ]}
            value={statusFilter ?? ''}
            onChange={(v) => setStatusFilter(v || null)}
            placeholder="Estado"
            isSearchable={false}
          />
        </div>
        <Button
          variant="outline-secondary"
          onClick={clearFilters}
          title="Limpiar filtros"
          className="d-flex align-items-center justify-content-center p-0 flex-shrink-0"
          style={{ height: 38, width: 38 }}
        >
          <RotateCcw size={18} />
        </Button>
        <Button className="btn-lepra flex-shrink-0 ms-auto" onClick={() => setAddModalOpen(true)}>
          <Plus size={18} className="me-1" /> Nuevo pedido
        </Button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <DataTable columns={columns} data={orders} getRowId={(row) => String(row.id)} />
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
