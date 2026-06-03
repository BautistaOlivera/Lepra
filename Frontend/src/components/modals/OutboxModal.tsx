import { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Table, Badge } from 'react-bootstrap'
import { LepraModal } from '@/components/LepraModal'
import { ModalBusyFrame } from '@/components/LoadingOverlay'
import type { OutboxRow } from '@/offline/db'
import {
  clearDone,
  deleteOne,
  listOutbox,
  OUTBOX_CHANGED_EVENT,
  processOutbox,
  retryFailed,
  retryOne,
} from '@/offline/outbox'
import { formatDateTimeAR } from '@/lib/formatDate'
import { outboxTypeLabel, outboxPayloadSummary } from '@/lib/outboxLabels'
import { syncButtonProps } from '@/lib/syncButton'
import { esErrorDependenciaSincronizacion, formatErrorParaUsuario } from '@/lib/connectionLabels'
import { useConfirm } from '@/context/ConfirmContext'

interface OutboxModalProps {
  show: boolean
  onClose: () => void
}

function statusBadge(status: OutboxRow['status']) {
  switch (status) {
    case 'pending':
      return <Badge bg="warning">Pendiente</Badge>
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
  return r.status === 'pending' && esErrorDependenciaSincronizacion(r.lastError)
}

function statusBadgeEnhanced(r: OutboxRow) {
  if (isBlockedByDependency(r)) {
    return <Badge bg="secondary">Bloqueado</Badge>
  }
  return statusBadge(r.status)
}

export function OutboxModal({ show, onClose }: OutboxModalProps) {
  const confirm = useConfirm()
  const [rows, setRows] = useState<OutboxRow[]>([])
  const [busyMessage, setBusyMessage] = useState<string | null>(null)
  const loading = busyMessage !== null

  async function refresh(message = 'Actualizando...') {
    setBusyMessage(message)
    try {
      const r = await listOutbox()
      setRows(r)
    } finally {
      setBusyMessage(null)
    }
  }

  useEffect(() => {
    if (!show) return
    refresh('Cargando...').catch(() => {})
    const onOutboxChanged = () => refresh().catch(() => {})
    window.addEventListener(OUTBOX_CHANGED_EVENT, onOutboxChanged)
    return () => window.removeEventListener(OUTBOX_CHANGED_EVENT, onOutboxChanged)
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
    if (counts.done === 0) return
    const ok = await confirm({
      title: 'Limpiar envíos OK',
      message: `¿Quitar ${counts.done} registro(s) ya sincronizados de la lista?`,
      confirmLabel: 'Limpiar',
    })
    if (!ok) return
    await clearDone()
    await refresh()
  }

  async function onRetryRow(id: string) {
    await retryOne(id)
    await refresh()
  }

  async function onDeleteRow(id: string) {
    const row = rows.find((r) => r.id === id)
    const ok = await confirm({
      title: 'Borrar de la cola',
      message: row
        ? `¿Borrar este cambio (${outboxTypeLabel(row.type)})? No se enviará al servidor.`
        : '¿Borrar este cambio de la cola? No se enviará al servidor.',
      confirmLabel: 'Borrar',
    })
    if (!ok) return
    await deleteOne(id)
    await refresh()
  }

  async function onProcessQueue() {
    setBusyMessage('Procesando cola...')
    try {
      await processOutbox({ max: 100 })
    } finally {
      await refresh()
    }
  }

  return (
    <LepraModal show={show} onClose={onClose} busy={loading} size="lg">
      <Modal.Header closeButton={!loading} className="border-dark">
        <Modal.Title>Cambios pendientes</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ModalBusyFrame busy={loading} message={busyMessage ?? 'Procesando...'}>
        <div className="d-flex gap-2 align-items-center mb-3 flex-wrap">
          <span className="text-muted small">
            Pendientes: {counts.pending} · Enviando: {counts.running} · Fallidos: {counts.failed} · OK: {counts.done}
          </span>
          <div className="ms-auto d-flex flex-wrap gap-2 lepra-outbox-modal-actions">
            <Button
              size="sm"
              onClick={() => void onProcessQueue()}
              disabled={loading || counts.pending === 0}
              {...syncButtonProps('pending')}
            >
              Procesar cola
            </Button>
            <Button
              size="sm"
              onClick={() => void refresh()}
              disabled={loading || rows.length === 0}
              {...syncButtonProps('ok')}
            >
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={() => void onRetryFailed()}
              disabled={loading || counts.failed === 0}
              {...syncButtonProps('error')}
            >
              Reintentar fallidos
            </Button>
            <Button
              size="sm"
              onClick={() => void onClearDone()}
              disabled={loading || counts.done === 0}
              {...syncButtonProps('ok')}
            >
              Limpiar OK
            </Button>
          </div>
        </div>

        <div className="table-responsive">
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo / acción</th>
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
                    <td className="small" style={{ maxWidth: 220 }}>
                      <span className="fw-semibold d-block">{outboxTypeLabel(r.type)}</span>
                      <span className="text-muted">{r.type}</span>
                    </td>
                    <td className="text-muted small">{outboxPayloadSummary(r)}</td>
                    <td>{statusBadgeEnhanced(r)}</td>
                    <td className="text-muted small">{formatErrorParaUsuario(r.lastError) || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.status === 'failed' && (
                        <Button
                          size="sm"
                          disabled={loading}
                          onClick={() => void onRetryRow(r.id)}
                          {...syncButtonProps('error', 'me-2')}
                        >
                          Reintentar
                        </Button>
                      )}
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => void onDeleteRow(r.id)}
                        disabled={loading}
                      >
                        Borrar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
        </ModalBusyFrame>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-dark" onClick={onClose} disabled={loading}>
          Cerrar
        </Button>
      </Modal.Footer>
    </LepraModal>
  )
}

