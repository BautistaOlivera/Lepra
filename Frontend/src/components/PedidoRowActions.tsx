import { Button } from 'react-bootstrap'
import { FileText, NotebookPen } from 'lucide-react'
import type { Order } from '@/types'

type PedidoRowActionsProps = {
  order: Order
  onNotas: () => void
  onPdf: () => void
  onFulfill: () => void
  onCancel: () => void
  layout?: 'table' | 'card'
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
  const iconSize = layout === 'card' ? 18 : 16
  const isCard = layout === 'card'
  const textBtnClass = isCard ? 'admin-list-action-btn' : 'admin-list-table-action-btn'
  const iconBtnClass = `${textBtnClass} admin-list-pedido-action-icon-btn`

  return (
    <div className={isCard ? 'admin-list-pedido-actions admin-list-pedido-actions--card' : 'admin-list-pedido-actions'}>
      <Button
        variant={hasNotas ? 'dark' : 'outline-dark'}
        size={isCard ? undefined : 'sm'}
        className={iconBtnClass}
        onClick={onNotas}
        aria-label={notasLabel}
        title={notasLabel}
      >
        <NotebookPen size={iconSize} aria-hidden />
      </Button>
      <Button
        variant="outline-dark"
        size={isCard ? undefined : 'sm'}
        className={iconBtnClass}
        onClick={onPdf}
        aria-label={pdfLabel}
        title={pdfLabel}
      >
        <FileText size={iconSize} aria-hidden />
      </Button>
      {isPending && (
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
    </div>
  )
}
