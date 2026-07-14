import { Button } from 'react-bootstrap'
import { Check, FileText, NotebookPen, X } from 'lucide-react'
import type { Order } from '@/types'

type PedidoRowActionsProps = {
  order: Order
  onNotas: () => void
  onPdf: () => void
  onFulfill: () => void
  onCancel: () => void
  layout?: 'table' | 'card' | 'tile'
}

export function PedidoRowActions({
  order,
  onNotas,
  onPdf,
  onFulfill,
  onCancel,
  layout = 'table',
}: PedidoRowActionsProps) {
  const isPending = order.status === 'PENDING'
  const syncDisabled = order.id < 0
  const hasNotas = Boolean(order.payment?.trim())
  const notasLabel = hasNotas ? 'Editar notas de pago' : 'Agregar notas de pago'
  const pdfLabel = 'Ver o imprimir pedido'
  const isTile = layout === 'tile'
  const isCard = layout === 'card'
  const iconSize = isTile ? 18 : isCard ? 18 : 16
  const textBtnClass = isCard || isTile ? 'admin-list-action-btn' : 'admin-list-table-action-btn'
  const iconBtnClass = `${textBtnClass} admin-list-pedido-action-icon-btn`

  return (
    <div
      className={
        isTile
          ? 'admin-list-pedido-actions admin-list-pedido-actions--tile'
          : isCard
            ? 'admin-list-pedido-actions admin-list-pedido-actions--card'
            : 'admin-list-pedido-actions'
      }
    >
      <Button
        variant={hasNotas ? 'dark' : 'outline-dark'}
        size={isCard || isTile ? undefined : 'sm'}
        className={iconBtnClass}
        onClick={onNotas}
        aria-label={notasLabel}
        title={notasLabel}
      >
        <NotebookPen size={iconSize} aria-hidden />
      </Button>
      <Button
        variant="outline-dark"
        size={isCard || isTile ? undefined : 'sm'}
        className={iconBtnClass}
        onClick={onPdf}
        aria-label={pdfLabel}
        title={pdfLabel}
      >
        <FileText size={iconSize} aria-hidden />
      </Button>
      {isPending && (
        <>
          {isTile ? (
            <>
              <Button
                variant="outline-success"
                className={iconBtnClass}
                onClick={onFulfill}
                disabled={syncDisabled}
                aria-label="Marcar como cumplido"
                title={syncDisabled ? 'Sincronizá el pedido antes de cumplir' : 'Marcar como cumplido'}
              >
                <Check size={iconSize} aria-hidden />
              </Button>
              <Button
                variant="outline-danger"
                className={iconBtnClass}
                onClick={onCancel}
                disabled={syncDisabled}
                aria-label="Cancelar pedido"
                title={syncDisabled ? 'Sincronizá el pedido antes de cancelar' : 'Cancelar pedido'}
              >
                <X size={iconSize} aria-hidden />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline-success"
                size={isCard ? undefined : 'sm'}
                className={textBtnClass}
                onClick={onFulfill}
                disabled={syncDisabled}
                title={syncDisabled ? 'Sincronizá el pedido antes de cumplir' : 'Marcar como cumplido'}
              >
                Cumplir
              </Button>
              <Button
                variant="outline-danger"
                size={isCard ? undefined : 'sm'}
                className={textBtnClass}
                onClick={onCancel}
                disabled={syncDisabled}
                title={syncDisabled ? 'Sincronizá el pedido antes de cancelar' : 'Cancelar pedido'}
              >
                Cancelar
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}
