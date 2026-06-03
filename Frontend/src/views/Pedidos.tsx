import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Spinner, Form, InputGroup, Card } from 'react-bootstrap'
import { Plus, Search, Calendar, CheckCircle2 } from 'lucide-react'
import { PedidoRowActions } from '@/components/PedidoRowActions'
import { createColumnHelper } from '@tanstack/react-table'
import { setOrderStatus } from '@/api/order'
import { getOrdersPaginatedOfflineFirst } from '@/repositories/ordersRepo'
import { Order } from '@/types'
import toast from 'react-hot-toast'
import { PedidoModal } from '@/components/modals/PedidoModal'
import { PedidoPdfModal } from '@/components/modals/PedidoPdfModal'
import { PedidoNotasModal } from '@/components/modals/PedidoNotasModal'
import { DataTable } from '@/components/DataTable'
import { Select } from '@/components/Select'
import { AdminFilterResetButton } from '@/components/AdminFilterResetButton'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { useOutboxPending } from '@/offline/useOutboxPending'
import { formatDateFromApi } from '@/lib/formatDate'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { DateInputAr } from '@/components/DateInputAr'

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

function PedidoSyncBadge({ order, pending }: { order: Order; pending: boolean }) {
  if (order.id < 0 || pending) {
    return <Badge bg="warning">Pendiente</Badge>
  }
  return <CheckCircle2 size={18} className="text-success" aria-label="Sincronizado" />
}

export function Pedidos() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [pdfOrder, setPdfOrder] = useState<Order | null>(null)
  const [notasOrder, setNotasOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const { orders: pendingOrders, refresh: refreshPending } = useOutboxPending()

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
    const { data } = await getOrdersPaginatedOfflineFirst({
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
    if (orderId < 0) {
      toast.error('Este pedido aún no está sincronizado')
      return
    }
    if (!isOnlineNow()) {
      await enqueueCommand('ORDER_STATUS_SET', { id: orderId, status: newStatus })
      await lepraDb.orders.update(orderId, { status: newStatus as Order['status'] })
      toast.success('Cambio guardado (pendiente de sincronizar)')
      refreshPending().catch(() => {})
      loadOrders()
      return
    }
    const { error } = await setOrderStatus(orderId, newStatus)
    if (error) toast.error(error.message)
    else {
      toast.success('Estado actualizado')
      loadOrders()
    }
  }

  function onAddModalClose(refresh?: boolean) {
    setAddModalOpen(false)
    if (refresh) {
      refreshPending().catch(() => {})
      loadOrders()
    }
  }

  function onPdfClose() {
    setPdfOrder(null)
  }

  function onNotasClose() {
    setNotasOrder(null)
  }

  function applyOrderPayment(orderId: number, payment: string) {
    const value = payment.trim() || null
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, payment: value } : o)))
    setPdfOrder((prev) => (prev?.id === orderId ? { ...prev, payment: value } : prev))
    setNotasOrder((prev) => (prev?.id === orderId ? { ...prev, payment: value } : prev))
  }

  function onNotasSaved(orderId: number, payment: string) {
    applyOrderPayment(orderId, payment)
    refreshPending().catch(() => {})
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
      cell: (info) => formatMoneyWithSymbol(info.getValue()),
    }),
    columnHelper.accessor('created_at', {
      header: 'Fecha',
      cell: (info) => formatDateFromApi(info.row.original.created_at || info.row.original.date),
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
      id: 'sync',
      header: 'Sincronización',
      cell: ({ row }) => (
        <PedidoSyncBadge
          order={row.original}
          pending={pendingOrders.has(row.original.id)}
        />
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Acciones',
      size: 260,
      cell: ({ row }) => (
        <PedidoRowActions
          order={row.original}
          onNotas={() => setNotasOrder(row.original)}
          onPdf={() => setPdfOrder(row.original)}
          onFulfill={() => handleStatusChange(row.original.id, 'FULFILLED')}
          onCancel={() => handleStatusChange(row.original.id, 'CANCELED')}
          layout="table"
        />
      ),
    }),
  ]

  return (
    <div className="admin-list-page">
      <h1 className="admin-list-title h3 text-dark mb-3">Pedidos</h1>

      <div className="admin-list-toolbar">
        <InputGroup className="admin-list-search">
          <InputGroup.Text>
            <Search size={18} aria-hidden />
          </InputGroup.Text>
          <Form.Control
            placeholder="Buscar por cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar pedidos"
          />
        </InputGroup>

        <div className="admin-list-dates-row">
          <InputGroup className="admin-list-date-field">
            <InputGroup.Text>
              <Calendar size={16} aria-hidden />
            </InputGroup.Text>
            <DateInputAr
              value={dateFrom}
              onChange={setDateFrom}
              aria-label="Fecha desde"
            />
          </InputGroup>
          <span className="admin-list-dates-sep" aria-hidden>–</span>
          <InputGroup className="admin-list-date-field">
            <InputGroup.Text>
              <Calendar size={16} aria-hidden />
            </InputGroup.Text>
            <DateInputAr
              value={dateTo}
              onChange={setDateTo}
              aria-label="Fecha hasta"
            />
          </InputGroup>
        </div>

        <div className="admin-list-filters-row">
          <div className="admin-list-filter admin-list-filter-wide">
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
          <AdminFilterResetButton onClick={clearFilters} />
        </div>

        <Button className="btn-lepra admin-list-add-btn" onClick={() => setAddModalOpen(true)}>
          <Plus size={18} className="me-1" aria-hidden /> Nuevo pedido
        </Button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <>
          <div className="admin-list-mobile d-lg-none">
            {orders.length === 0 ? (
              <p className="text-muted text-center py-4 mb-0">No hay pedidos con estos filtros.</p>
            ) : (
              orders.map((o) => (
                  <Card key={o.id} className="card-lepra admin-list-card mb-3">
                    <Card.Body className="p-3">
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="fw-semibold text-dark text-truncate">
                            {o.user_name || `Cliente #${o.id_user}`}
                          </div>
                          <div className="text-muted small mt-1">
                            {formatDateFromApi(o.created_at || o.date)}
                          </div>
                        </div>
                        <div className="fw-bold text-dark flex-shrink-0">
                          {formatMoneyWithSymbol(o.total)}
                        </div>
                      </div>

                      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                        <Badge bg={STATUS_BG[o.status] || 'secondary'}>
                          {STATUS_LABELS[o.status] || o.status}
                        </Badge>
                        <PedidoSyncBadge order={o} pending={pendingOrders.has(o.id)} />
                      </div>

                      <PedidoRowActions
                        order={o}
                        onNotas={() => setNotasOrder(o)}
                        onPdf={() => setPdfOrder(o)}
                        onFulfill={() => handleStatusChange(o.id, 'FULFILLED')}
                        onCancel={() => handleStatusChange(o.id, 'CANCELED')}
                        layout="card"
                      />
                    </Card.Body>
                  </Card>
              ))
            )}
          </div>

          <div className="admin-list-desktop d-none d-lg-block">
            <DataTable columns={columns} data={orders} getRowId={(row) => String(row.id)} />
          </div>
        </>
      )}

      {nextCursor && (
        <div className="text-center mt-3">
          <Button
            variant="outline-dark"
            className="admin-list-load-more"
            onClick={() => loadOrders(nextCursor)}
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Cargar más'}
          </Button>
        </div>
      )}

      <PedidoModal show={addModalOpen} onClose={onAddModalClose} />
      {notasOrder && (
        <PedidoNotasModal
          show
          order={notasOrder}
          onClose={onNotasClose}
          onSaved={(payment) => onNotasSaved(notasOrder.id, payment)}
        />
      )}
      {pdfOrder && <PedidoPdfModal order={pdfOrder} show onClose={onPdfClose} />}
    </div>
  )
}
