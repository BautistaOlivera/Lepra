import { useEffect, useId, useRef, useState } from 'react'
import { Badge, Button } from 'react-bootstrap'
import { AlertCircle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { formatDateTimeAR } from '@/lib/formatDate'
import { CONEXION_EN_LINEA, CONEXION_SIN } from '@/lib/connectionLabels'
import {
  getSyncVisualState,
  stateToButtonVariant,
  syncButtonClassName,
  type SyncVisualState,
} from '@/lib/syncButton'

export type { SyncVisualState } from '@/lib/syncButton'
export { getSyncVisualState } from '@/lib/syncButton'

export type AdminSyncToolbarProps = {
  online: boolean
  syncing: boolean
  authRequired: boolean
  lastSync: number
  pendingOutbox: number
  outboxFailed: number
  outboxActionable: number
  hasOutboxItems: boolean
  onSync: () => void
  onOpenOutbox: () => void
  /** Solo icono de estado (+ panel al tocar). Para topbar mobile. */
  compact?: boolean
}

function MainStatusIcon({ state, size = 24 }: { state: SyncVisualState; size?: number }) {
  switch (state) {
    case 'error':
      return <XCircle size={size} className="lepra-sync-main-icon lepra-sync-main-icon--error" aria-hidden />
    case 'pending':
      return (
        <AlertCircle size={size} className="lepra-sync-main-icon lepra-sync-main-icon--pending" aria-hidden />
      )
    default:
      return (
        <CheckCircle2 size={size} className="lepra-sync-main-icon lepra-sync-main-icon--ok" aria-hidden />
      )
  }
}

export function AdminSyncToolbar({
  online,
  syncing,
  authRequired,
  lastSync,
  pendingOutbox,
  outboxFailed,
  outboxActionable,
  hasOutboxItems,
  onSync,
  onOpenOutbox,
  compact = false,
}: AdminSyncToolbarProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  const mainState = getSyncVisualState(pendingOutbox, outboxFailed, authRequired)
  const pendientesState = hasOutboxItems
    ? getSyncVisualState(pendingOutbox, outboxFailed, false)
    : 'ok'
  const syncQueueOk = mainState === 'ok' && !syncing
  const isFullySynced = syncQueueOk
  const hasPendingSync = pendingOutbox > 0

  const mainToggleTitle =
    authRequired
      ? 'Sesión expirada · requiere login'
      : outboxFailed > 0
        ? `${outboxFailed} envío(s) fallido(s)`
        : pendingOutbox > 0
          ? `${pendingOutbox} cambio(s) pendiente(s) de enviar`
          : 'Todo sincronizado'

  const syncBtnVariant = syncing ? 'warning' : stateToButtonVariant(isFullySynced ? 'ok' : mainState)
  const pendientesBtnVariant = stateToButtonVariant(pendientesState)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const syncTitle = [
    isFullySynced
      ? lastSync
        ? `Sincronizado · ${formatDateTimeAR(new Date(lastSync))}`
        : 'Sincronizado'
      : lastSync
        ? `Última sincronización: ${formatDateTimeAR(new Date(lastSync))}`
        : 'Nunca sincronizado',
    hasPendingSync ? `${pendingOutbox} cambio(s) por enviar` : null,
    !online ? 'Sin conexión' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const pendientesTitle = hasOutboxItems
    ? outboxActionable > 0
      ? `${outboxActionable} cambio(s) por revisar`
      : 'Ver historial de envíos en cola'
    : 'Sin cambios pendientes'

  return (
    <div
      ref={rootRef}
      className={`lepra-sync-toolbar${compact ? ' lepra-sync-toolbar--compact' : ''}`}
    >
      <div className="lepra-sync-toolbar-status d-flex align-items-center gap-2">
        {!compact ? (
          <Badge bg={online ? 'success' : 'secondary'}>
            {online ? CONEXION_EN_LINEA : CONEXION_SIN}
          </Badge>
        ) : null}
        <button
          type="button"
          className={`lepra-sync-toolbar-toggle lepra-sync-toolbar-toggle--${mainState} btn btn-link p-0 border-0`}
          aria-expanded={open}
          aria-controls={panelId}
          title={
            open
              ? 'Ocultar opciones de sincronización'
              : `${mainToggleTitle}. Tocá para ver Sincronizar y Pendientes`
          }
          onClick={() => setOpen((v) => !v)}
        >
          <MainStatusIcon state={mainState} size={compact ? 26 : 24} />
          <span className="visually-hidden">{mainToggleTitle}</span>
        </button>
      </div>

      {open ? (
        <div id={panelId} className="lepra-sync-toolbar-panel d-flex flex-wrap gap-2">
          <Button
            variant={syncBtnVariant}
            size="sm"
            className={syncButtonClassName(syncing ? 'pending' : isFullySynced ? 'ok' : mainState)}
            onClick={() => onSync()}
            disabled={!online || syncing || isFullySynced}
            title={syncTitle}
          >
            {syncing ? (
              <>
                <RefreshCw size={16} className="me-1 lepra-icon-spin" aria-hidden />
                Sincronizando…
              </>
            ) : isFullySynced ? (
              'Sincronizado'
            ) : (
              <>Sincronizar{hasPendingSync ? ` (${pendingOutbox})` : ''}</>
            )}
          </Button>

          {hasOutboxItems ? (
            <Button
              variant={pendientesBtnVariant}
              size="sm"
              className={syncButtonClassName(pendientesState)}
              onClick={() => {
                setOpen(false)
                onOpenOutbox()
              }}
              title={pendientesTitle}
            >
              Pendientes
              {outboxActionable > 0 ? ` (${outboxActionable})` : ''}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
