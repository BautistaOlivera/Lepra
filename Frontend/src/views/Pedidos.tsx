import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Badge, Form, InputGroup, Card } from 'react-bootstrap'
import { LoadingCenter } from '@/components/LoadingOverlay'
import { Plus, Search, Calendar, CheckCircle2, ClipboardList } from 'lucide-react'
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
import { orderCustomerLabel, orderLinesPreview, orderPaymentPreview } from '@/lib/orderDisplay'
import { DateInputAr } from '@/components/DateInputAr'
import { releaseBootstrapModalLock } from '@/lib/bootstrapModal'
import { AdminPageHero } from '@/components/AdminPageHero'
import { useConfirm } from '@/context/ConfirmContext'
import { hasPedidoDraft } from '@/lib/pedidoDraft'

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
  const [pedidoDraftActive, setPedidoDraftActive] = useState(() => hasPedidoDraft())
  const [pdfOrder, setPdfOrder] = useState<Order | null>(null)
  const [notasOrder, setNotasOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  // El filtro de estado puede venir preseteado por URL (?status=PENDING),
  // p. ej. desde el atajo "¡Revisar!" del dashboard.
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const [statusFilter, setStatusFilter] = useState<string | null>(
    statusParam && statusParam in STATUS_LABELS ? statusParam : null,
  )

  function changeStatusFilter(v: string | null) {
    setStatusFilter(v)
    setSearchParams(v ? { status: v } : {}, { replace: true })
  }
  const { orders: pendingOrders, refresh: refreshPending } = useOutboxPending()
  const confirm = useConfirm()

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

  async function requestFulfill(order: Order) {
    const customer = orderCustomerLabel(order)
    const ok = await confirm({
      title: 'Marcar como cumplido',
      message: `¿Confirmar que el pedido de ${customer} está cumplido?`,
      confirmLabel: 'Cumplir',
      cancelLabel: 'Volver',
      confirmVariant: 'primary',
    })
    if (!ok) return
    await handleStatusChange(order.id, 'FULFILLED')
  }

  async function requestCancel(order: Order) {
    const customer = orderCustomerLabel(order)
    const fromFulfilled = order.status === 'FULFILLED'
    const ok = await confirm({
      title: fromFulfilled ? 'Cancelar pedido cumplido' : 'Cancelar pedido',
      message: fromFulfilled
        ? `¿Cancelar el pedido cumplido de ${customer}? Solo usalo si se marcó cumplido por error.`
        : `¿Cancelar el pedido de ${customer}? Esta acción no se puede deshacer desde acá.`,
      confirmLabel: 'Sí, cancelar',
      cancelLabel: 'Volver',
    })
    if (!ok) return
    await handleStatusChange(order.id, 'CANCELED')
  }

  function onAddModalClose(refresh?: boolean) {
    setAddModalOpen(false)
    setPedidoDraftActive(hasPedidoDraft())
    releaseBootstrapModalLock()
    if (refresh) {
      refreshPending().catch(() => {})
      loadOrders()
    }
  }

  function onPdfClose() {
    setPdfOrder(null)
    releaseBootstrapModalLock()
  }

  function onNotasClose() {
    setNotasOrder(null)
    releaseBootstrapModalLock()
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
    changeStatusFilter(null)
  }

  const columns = [
    columnHelper.accessor('user_name', {
      header: 'Cliente',
      cell: ({ row }) => orderCustomerLabel(row.original),
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
      header: () => <span className="d-block text-center">Sincronización</span>,
      cell: ({ row }) => (
        <div className="text-center">
          <PedidoSyncBadge
            order={row.original}
            pending={pendingOrders.has(row.original.id)}
          />
        </div>
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
          onFulfill={() => requestFulfill(row.original)}
          onCancel={() => requestCancel(row.original)}
          layout="table"
        />
      ),
    }),
  ]

  return (
    <div className="admin-list-page">
      <AdminPageHero>
        <span className="d-inline-flex align-items-center gap-2">
          <ClipboardList size={28} aria-hidden />
          Pedidos
        </span>
      </AdminPageHero>

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
              onChange={(v) => changeStatusFilter(v || null)}
              placeholder="Estado"
              isSearchable={false}
            />
          </div>
          <AdminFilterResetButton onClick={clearFilters} />
        </div>

        <Button className="btn-lepra admin-list-add-btn" onClick={() => setAddModalOpen(true)}>
          <Plus size={18} className="me-1" aria-hidden />{' '}
          {pedidoDraftActive ? 'Continuar pedido' : 'Nuevo pedido'}
        </Button>
      </div>

      {loading && orders.length === 0 ? (
        <LoadingCenter message="Cargando pedidos..." />
      ) : (
        <>
          <div className="admin-list-mobile d-lg-none">
            {orders.length === 0 ? (
              <p className="text-muted text-center py-4 mb-0">No hay pedidos con estos filtros.</p>
            ) : (
              <div className="admin-list-pedido-grid">
                {orders.map((o) => {
                  const lineCount = o.lines?.length ?? 0
                  const idLabel = o.id < 0 ? 'Nuevo' : `#${o.id}`
                  const itemsLabel =
                    lineCount === 1 ? '1 ítem' : lineCount > 0 ? `${lineCount} ítems` : 'Sin ítems'
                  const paymentPreview = orderPaymentPreview(o.payment)

                  return (
                    <Card key={o.id} className="card-lepra admin-list-pedido-tile">
                      <Card.Body>
                        <div className="admin-list-pedido-tile-header">
                          <div className="admin-list-pedido-tile-chips">
                            <Badge bg={STATUS_BG[o.status] || 'secondary'}>
                              {STATUS_LABELS[o.status] || o.status}
                            </Badge>
                            <PedidoSyncBadge order={o} pending={pendingOrders.has(o.id)} />
                          </div>
                          <div className="admin-list-pedido-tile-total">
                            {formatMoneyWithSymbol(o.total)}
                          </div>
                        </div>

                        <div className="admin-list-pedido-tile-customer">
                          {orderCustomerLabel(o)}
                        </div>

                        <div className="admin-list-pedido-tile-meta">
                          <span>{idLabel}</span>
                          <span>{itemsLabel}</span>
                          <span>{formatDateFromApi(o.created_at || o.date)}</span>
                        </div>

                        <div className="admin-list-pedido-tile-products">
                          {orderLinesPreview(o)}
                        </div>

                        {paymentPreview ? (
                          <div className="admin-list-pedido-tile-payment" title={o.payment || undefined}>
                            {paymentPreview}
                          </div>
                        ) : (
                          <div className="admin-list-pedido-tile-payment admin-list-pedido-tile-payment--empty">
                            Sin notas de pago
                          </div>
                        )}

                        <div className="admin-list-pedido-tile-actions">
                          <PedidoRowActions
                            order={o}
                            onNotas={() => setNotasOrder(o)}
                            onPdf={() => setPdfOrder(o)}
                            onFulfill={() => requestFulfill(o)}
                            onCancel={() => requestCancel(o)}
                            layout="tile"
                          />
                        </div>
                      </Card.Body>
                    </Card>
                  )
                })}
              </div>
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

      {addModalOpen && (
        <PedidoModal show onClose={onAddModalClose} onDraftChange={setPedidoDraftActive} />
      )}
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
