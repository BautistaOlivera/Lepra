import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Form, Button, ListGroup, Spinner } from 'react-bootstrap'
import { Trash2 } from 'lucide-react'
import { LepraModal, ModalDismissButton } from '@/components/LepraModal'
import toast from 'react-hot-toast'
import { addOrderPayment, deleteOrderPayment, updateOrder } from '@/api/order'
import { Order, OrderPayment, OrderPaymentMethod } from '@/types'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { formatDateFromApi } from '@/lib/formatDate'
import {
  orderBalance,
  orderCustomerLabel,
  orderDisplayPaid,
  paymentMethodLabel,
  withPaymentSummary,
} from '@/lib/orderDisplay'

const METHODS: { value: OrderPaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'otro', label: 'Otro' },
]

type BusyKind = 'add' | 'delete' | 'note' | null

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface PedidoNotasModalProps {
  show: boolean
  onClose: () => void
  order: Order
  onSaved?: (order: Order) => void
}

export function PedidoNotasModal({ show, onClose, order, onSaved }: PedidoNotasModalProps) {
  const [localOrder, setLocalOrder] = useState(order)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<OrderPaymentMethod>('efectivo')
  const [paidAt, setPaidAt] = useState(todayIsoDate())
  const [note, setNote] = useState('')
  const [legacyNote, setLegacyNote] = useState('')
  const [busy, setBusy] = useState<BusyKind>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [flashId, setFlashId] = useState<number | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const openedForId = useRef<number | null>(null)

  // Solo resetea al abrir / cambiar de pedido (no en cada update del padre).
  useEffect(() => {
    if (!show) {
      openedForId.current = null
      return
    }
    if (openedForId.current === order.id) return
    openedForId.current = order.id
    setLocalOrder(order)
    setAmount('')
    setMethod('efectivo')
    setPaidAt(todayIsoDate())
    setNote('')
    setLegacyNote(order.payment?.trim() ? order.payment : '')
    setBusy(null)
    setDeletingId(null)
    setFlashId(null)
    setStatusMsg(null)
    window.setTimeout(() => amountRef.current?.focus(), 50)
  }, [show, order])

  const payments = localOrder.payments || []
  const paid = orderDisplayPaid(localOrder)
  const balance = orderBalance(localOrder)
  const isFulfilled = (localOrder.status || '').toUpperCase() === 'FULFILLED'
  const clientLabel = orderCustomerLabel(localOrder)
  const isBusy = busy != null

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => {
      const da = (a.paid_at || a.created_at || '').localeCompare(b.paid_at || b.created_at || '')
      if (da !== 0) return -da
      return (b.id || 0) - (a.id || 0)
    })
  }, [payments])

  function applyLocal(next: Order, flashPaymentId?: number | null) {
    setLocalOrder(next)
    onSaved?.(next)
    if (flashPaymentId != null) {
      setFlashId(flashPaymentId)
      window.setTimeout(() => setFlashId((cur) => (cur === flashPaymentId ? null : cur)), 1600)
    }
  }

  async function persistOrderCache(next: Order) {
    await lepraDb.orders
      .update(next.id, {
        payments: next.payments,
        amount_paid: next.amount_paid,
        balance: next.balance,
        payment: next.payment ?? null,
      })
      .catch(() => {})
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    if (isBusy) return
    if (localOrder.id < 0) {
      toast.error('Este pedido aún no está sincronizado; registrá el pago cuando tenga número definitivo')
      return
    }

    const value = Number(String(amount).replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Indicá un monto mayor a 0')
      return
    }
    if (value > balance + 0.009) {
      toast.error(`El pago supera el saldo restante (${formatMoneyWithSymbol(balance)})`)
      return
    }

    const payload = {
      amount: Math.round(value * 100) / 100,
      method,
      paid_at: paidAt || null,
      note: note.trim() || null,
    }

    const tempId = -Date.now()
    const optimisticPayment: OrderPayment = {
      id: tempId,
      id_order: localOrder.id,
      amount: payload.amount,
      method,
      paid_at: payload.paid_at,
      note: payload.note,
      created_at: new Date().toISOString(),
    }
    const snapshot = localOrder
    const optimistic = withPaymentSummary(localOrder, [optimisticPayment, ...payments])

    setBusy('add')
    setStatusMsg('Guardando pago…')
    setAmount('')
    setNote('')
    applyLocal(optimistic, tempId)
    await persistOrderCache(optimistic)

    try {
      if (!isOnlineNow()) {
        await enqueueCommand('ORDER_PAYMENT_ADD', {
          order_id: localOrder.id,
          tempId,
          ...payload,
        })
        setStatusMsg('Pago agregado (pendiente de sincronizar)')
        toast.success('Pago agregado')
        return
      }

      const { data, error } = await addOrderPayment(localOrder.id, payload)
      if (error || !data) {
        applyLocal(snapshot)
        await persistOrderCache(snapshot)
        setStatusMsg(null)
        toast.error(error?.message || 'No se pudo guardar el pago')
        setAmount(String(payload.amount))
        setNote(payload.note || '')
        return
      }

      const next = withPaymentSummary(snapshot, data.payments, data.amount_paid, data.balance)
      const newId = data.payment?.id ?? data.payments[0]?.id ?? null
      applyLocal(next, newId)
      await persistOrderCache(next)
      setStatusMsg('Pago guardado')
      toast.success('Pago guardado')
    } finally {
      setBusy(null)
      window.setTimeout(() => amountRef.current?.focus(), 30)
    }
  }

  async function handleDeletePayment(payment: OrderPayment) {
    if (isBusy) return
    if (localOrder.id < 0) {
      toast.error('Este pedido aún no está sincronizado')
      return
    }

    const snapshot = localOrder
    const optimistic = withPaymentSummary(
      localOrder,
      payments.filter((p) => p.id !== payment.id)
    )

    setBusy('delete')
    setDeletingId(payment.id)
    setStatusMsg('Eliminando pago…')
    applyLocal(optimistic)
    await persistOrderCache(optimistic)

    try {
      if (!isOnlineNow()) {
        await enqueueCommand('ORDER_PAYMENT_DELETE', {
          order_id: localOrder.id,
          payment_id: payment.id,
        })
        setStatusMsg('Pago eliminado (pendiente de sincronizar)')
        toast.success('Pago eliminado')
        return
      }

      if (payment.id < 0) {
        setStatusMsg('Pago eliminado')
        toast.success('Pago eliminado')
        return
      }

      const { data, error } = await deleteOrderPayment(localOrder.id, payment.id)
      if (error || !data) {
        applyLocal(snapshot)
        await persistOrderCache(snapshot)
        setStatusMsg(null)
        toast.error(error?.message || 'No se pudo eliminar el pago')
        return
      }

      const next = withPaymentSummary(snapshot, data.payments, data.amount_paid, data.balance)
      applyLocal(next)
      await persistOrderCache(next)
      setStatusMsg('Pago eliminado')
      toast.success('Pago eliminado')
    } finally {
      setBusy(null)
      setDeletingId(null)
    }
  }

  async function handleSaveLegacyNote() {
    if (isBusy) return
    if (localOrder.id < 0) {
      toast.error('Este pedido aún no está sincronizado')
      return
    }
    const paymentText = legacyNote.trim()
    const snapshot = localOrder
    const optimistic = { ...localOrder, payment: paymentText || null }

    setBusy('note')
    setStatusMsg('Guardando nota…')
    applyLocal(optimistic)
    await persistOrderCache(optimistic)

    try {
      if (!isOnlineNow()) {
        await enqueueCommand('ORDER_PAYMENT_UPDATE', { id: localOrder.id, payment: paymentText })
        setStatusMsg('Nota guardada (pendiente de sincronizar)')
        toast.success('Nota guardada')
        return
      }

      const { error } = await updateOrder({ id: localOrder.id, payment: paymentText })
      if (error) {
        applyLocal(snapshot)
        await persistOrderCache(snapshot)
        setLegacyNote(snapshot.payment || '')
        setStatusMsg(null)
        toast.error(error.message)
        return
      }
      setStatusMsg('Nota guardada')
      toast.success('Nota guardada')
    } finally {
      setBusy(null)
    }
  }

  return (
    <LepraModal show={show} onClose={onClose} busy={isBusy} centered scrollable>
      <Modal.Header closeButton={!isBusy} className="border-dark">
        <Modal.Title className="h5 mb-0">Pagos — Pedido #{localOrder.id}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small mb-2">{clientLabel}</p>

        <div className="pedido-pagos-summary d-flex flex-wrap gap-3 mb-2 p-3 border rounded bg-light">
          <div>
            <div className="small text-muted">Total</div>
            <div className="fw-bold fs-5">{formatMoneyWithSymbol(localOrder.total)}</div>
          </div>
          <div>
            <div className="small text-muted">Pagado</div>
            <div className="fw-bold fs-5 text-success">{formatMoneyWithSymbol(paid)}</div>
          </div>
          <div>
            <div className="small text-muted">Saldo restante</div>
            <div className={`fw-bold fs-5 ${balance <= 0.009 ? 'text-success' : 'text-danger'}`}>
              {formatMoneyWithSymbol(balance)}
            </div>
          </div>
        </div>

        {statusMsg && (
          <p className="small mb-3 text-muted" role="status" aria-live="polite">
            {busy ? <Spinner animation="border" size="sm" className="me-2" aria-hidden /> : null}
            {statusMsg}
          </p>
        )}

        {isFulfilled && (
          <p className="small text-muted mb-3">
            Pedido cumplido: el saldo restante queda en cero (se considera cobrado).
          </p>
        )}

        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-semibold">Historial de pagos</div>
            <div className="small text-muted">
              {sortedPayments.length === 0
                ? 'Sin pagos'
                : `${sortedPayments.length} pago${sortedPayments.length === 1 ? '' : 's'}`}
            </div>
          </div>
          {sortedPayments.length === 0 ? (
            <p className="text-muted small mb-0 border rounded p-3 bg-light">
              Todavía no hay pagos. Agregá uno abajo y vas a ver el saldo restante actualizarse al instante.
            </p>
          ) : (
            <ListGroup variant="flush" className="border rounded">
              {sortedPayments.map((p) => {
                const isDeleting = deletingId === p.id
                const isNew = flashId === p.id
                return (
                  <ListGroup.Item
                    key={p.id}
                    className={`d-flex justify-content-between align-items-start gap-2 px-3 py-2${
                      isNew ? ' pedido-pago-item--flash' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="fw-semibold">
                        {formatMoneyWithSymbol(p.amount)} · {paymentMethodLabel(p.method)}
                      </div>
                      <div className="small text-muted">
                        {formatDateFromApi(p.paid_at || p.created_at) || '—'}
                        {p.note ? ` · ${p.note}` : ''}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline-danger"
                      size="sm"
                      className="flex-shrink-0"
                      aria-label="Eliminar pago"
                      title="Eliminar pago"
                      disabled={isBusy || isFulfilled}
                      onClick={() => handleDeletePayment(p)}
                    >
                      {isDeleting ? (
                        <Spinner animation="border" size="sm" aria-hidden />
                      ) : (
                        <Trash2 size={14} aria-hidden />
                      )}
                    </Button>
                  </ListGroup.Item>
                )
              })}
            </ListGroup>
          )}
        </div>

        <Form onSubmit={handleAddPayment} className="mb-4 p-3 border rounded">
          <div className="fw-semibold mb-2">Agregar pago</div>
          <p className="small text-muted mb-2">Se descuenta del saldo restante al guardar.</p>
          <div className="row g-2">
            <div className="col-6 col-sm-4">
              <Form.Group>
                <Form.Label className="small fw-semibold mb-1" htmlFor="pedido-pago-monto">
                  Monto
                </Form.Label>
                <Form.Control
                  id="pedido-pago-monto"
                  ref={amountRef}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isBusy || localOrder.id < 0 || isFulfilled || balance <= 0}
                  required
                />
              </Form.Group>
            </div>
            <div className="col-6 col-sm-4">
              <Form.Group>
                <Form.Label className="small fw-semibold mb-1" htmlFor="pedido-pago-medio">
                  Medio
                </Form.Label>
                <Form.Select
                  id="pedido-pago-medio"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as OrderPaymentMethod)}
                  disabled={isBusy || localOrder.id < 0 || isFulfilled || balance <= 0}
                >
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-12 col-sm-4">
              <Form.Group>
                <Form.Label className="small fw-semibold mb-1" htmlFor="pedido-pago-fecha">
                  Fecha
                </Form.Label>
                <Form.Control
                  id="pedido-pago-fecha"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  disabled={isBusy || localOrder.id < 0 || isFulfilled || balance <= 0}
                />
              </Form.Group>
            </div>
            <div className="col-12">
              <Form.Group>
                <Form.Label className="small fw-semibold mb-1" htmlFor="pedido-pago-nota">
                  Comentario (opcional)
                </Form.Label>
                <Form.Control
                  id="pedido-pago-nota"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isBusy || localOrder.id < 0 || isFulfilled || balance <= 0}
                  placeholder="Ej. transferencia Banco Nación"
                />
              </Form.Group>
            </div>
          </div>
          <div className="d-flex justify-content-end mt-3">
            <Button
              type="submit"
              className="btn-lepra"
              disabled={isBusy || localOrder.id < 0 || balance <= 0 || isFulfilled}
            >
              {busy === 'add' ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" aria-hidden />
                  Guardando…
                </>
              ) : (
                'Agregar pago'
              )}
            </Button>
          </div>
        </Form>

        <div className="pt-3 border-top">
          <Form.Group>
            <Form.Label className="fw-semibold" htmlFor="pedido-nota-libre">
              Nota libre (no descuenta del saldo restante)
            </Form.Label>
            <Form.Control
              id="pedido-nota-libre"
              as="textarea"
              rows={3}
              value={legacyNote}
              onChange={(e) => setLegacyNote(e.target.value)}
              disabled={isBusy || localOrder.id < 0}
              placeholder="Texto libre opcional para el comprobante"
            />
          </Form.Group>
          <div className="d-flex justify-content-end gap-2 mt-2">
            <Button
              type="button"
              variant="outline-dark"
              size="sm"
              disabled={isBusy || localOrder.id < 0}
              onClick={handleSaveLegacyNote}
            >
              {busy === 'note' ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" aria-hidden />
                  Guardando…
                </>
              ) : (
                'Guardar nota libre'
              )}
            </Button>
          </div>
        </div>

        {localOrder.id < 0 && (
          <p className="text-warning small mt-3 mb-0">
            Pedido en cola de sincronización: los pagos se podrán guardar cuando el pedido tenga número en el
            servidor.
          </p>
        )}

        <div className="d-flex justify-content-end mt-3 pt-3 border-top border-dark">
          <ModalDismissButton disabled={isBusy}>Cerrar</ModalDismissButton>
        </div>
      </Modal.Body>
    </LepraModal>
  )
}
