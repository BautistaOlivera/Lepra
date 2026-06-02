import { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Table, Badge } from 'react-bootstrap'
import type { OutboxRow } from '@/offline/db'
import { clearDone, deleteOne, listOutbox, processOutbox, retryFailed, retryOne } from '@/offline/outbox'
import { formatDateTimeAR } from '@/lib/formatDate'

interface OutboxModalProps {
  show: boolean
  onClose: () => void
}

function statusBadge(status: OutboxRow['status']) {
  switch (status) {
    case 'pending':
      return <Badge bg="warning" className="text-dark">Pendiente</Badge>
    case 'running':
      return <Badge bg="info">Enviando</Badge>
    case 'failed':
      return <Badge bg="danger">Falló</Badge>
    case 'done':
      return <Badge bg="success">OK</Badge>
    default:
      return <Badge bg="secondary">{status}</Badge>
  }
}

function isBlockedByDependency(r: OutboxRow): boolean {
  return r.status === 'pending' && (r.lastError || '').toLowerCase().startsWith('esperando sync')
}

function statusBadgeEnhanced(r: OutboxRow) {
  if (isBlockedByDependency(r)) {
    return <Badge bg="secondary">Bloqueado</Badge>
  }
  return statusBadge(r.status)
}

function payloadSummary(r: OutboxRow): string {
  const p: any = r.payload
  if (!p) return ''
  switch (r.type) {
    case 'USER_CREATE':
      return p?.data?.email ? `email=${p.data.email}` : ''
    case 'USER_UPDATE':
      return p?.id ? `id=${p.id}` : ''
    case 'USER_DEACTIVATE':
      return p?.id ? `id=${p.id}` : ''
    case 'PRODUCT_CREATE':
      return p?.data?.name ? `name=${p.data.name}` : ''
    case 'PRODUCT_UPDATE':
    case 'PRODUCT_DEACTIVATE':
      return p?.id ? `id=${p.id}` : ''
    case 'ORDER_CREATE_ADMIN':
      return p?.data?.id_user ? `user=${p.data.id_user} lines=${p?.data?.lines?.length || 0}` : ''
    case 'ORDER_STATUS_SET':
      return p?.id ? `id=${p.id} → ${p.status}` : ''
    case 'ORDER_PAYMENT_UPDATE':
      return p?.id ? `id=${p.id} (notas de pago)` : ''
    default:
      return ''
  }
}

export function OutboxModal({ show, onClose }: OutboxModalProps) {
  const [rows, setRows] = useState<OutboxRow[]>([])
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const r = await listOutbox()
      setRows(r)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!show) return
    refresh().catch(() => {})
  }, [show])

  const counts = useMemo(() => {
    const c = { pending: 0, running: 0, failed: 0, done: 0 }
    for (const r of rows) (c as any)[r.status] = ((c as any)[r.status] || 0) + 1
    return c
  }, [rows])

  async function onRetryFailed() {
    await retryFailed()
    await refresh()
  }

  async function onClearDone() {
    await clearDone()
    await refresh()
  }

  async function onRetryRow(id: string) {
    await retryOne(id)
    await refresh()
  }

  async function onDeleteRow(id: string) {
    await deleteOne(id)
    await refresh()
  }

  async function onProcessQueue() {
    setLoading(true)
    try {
      await processOutbox({ max: 100 })
    } finally {
      await refresh()
    }
  }

  return (
    <Modal show={show} onHide={onClose} size="lg">
      <Modal.Header closeButton className="border-dark">
        <Modal.Title>Cambios pendientes</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex gap-2 align-items-center mb-3 flex-wrap">
          <span className="text-muted small">
            Pendientes: {counts.pending} · Enviando: {counts.running} · Fallidos: {counts.failed} · OK: {counts.done}
          </span>
          <div className="ms-auto d-flex gap-2">
            <Button variant="dark" size="sm" onClick={onProcessQueue} disabled={loading}>
              Procesar cola
            </Button>
            <Button variant="outline-dark" size="sm" onClick={refresh} disabled={loading}>
              Actualizar
            </Button>
            <Button variant="outline-danger" size="sm" onClick={onRetryFailed} disabled={loading || counts.failed === 0}>
              Reintentar fallidos
            </Button>
            <Button variant="outline-secondary" size="sm" onClick={onClearDone} disabled={loading || counts.done === 0}>
              Limpiar OK
            </Button>
          </div>
        </div>

        <div className="table-responsive">
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Resumen</th>
                <th>Estado</th>
                <th>Error</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="text-muted">Sin cambios pendientes</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTimeAR(new Date(r.createdAt))}</td>
                    <td><code>{r.type}</code></td>
                    <td className="text-muted small">{payloadSummary(r)}</td>
                    <td>{statusBadgeEnhanced(r)}</td>
                    <td className="text-muted small">{r.lastError || ''}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.status === 'failed' && (
                        <Button variant="outline-danger" size="sm" className="me-2" onClick={() => onRetryRow(r.id)} disabled={loading}>
                          Reintentar
                        </Button>
                      )}
                      <Button variant="outline-secondary" size="sm" onClick={() => onDeleteRow(r.id)} disabled={loading}>
                        Borrar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-dark" onClick={onClose}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  )
}

