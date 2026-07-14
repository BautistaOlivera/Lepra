import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { Button, Modal, type ButtonProps, type ModalProps } from 'react-bootstrap'
import { releaseBootstrapModalLock } from '@/lib/bootstrapModal'
import { useConfirm } from '@/context/ConfirmContext'

type LepraModalProps = Omit<ModalProps, 'show' | 'onHide'> & {
  show: boolean
  onClose: () => void
  busy?: boolean
  /**
   * Si true (default), pide confirmación antes de cerrar (backdrop, Esc, X o ModalDismissButton).
   * Usar false en el propio diálogo de confirmación.
   */
  confirmClose?: boolean
  closeConfirmTitle?: string
  closeConfirmMessage?: string
  closeConfirmLabel?: string
  closeConfirmCancelLabel?: string
}

const ModalDismissContext = createContext<(() => void) | null>(null)

/** Cierre con la misma confirmación que backdrop / Esc / X. Usar dentro de LepraModal. */
export function useModalDismiss(): () => void {
  const dismiss = useContext(ModalDismissContext)
  if (!dismiss) {
    throw new Error('useModalDismiss must be used within LepraModal')
  }
  return dismiss
}

type ModalDismissButtonProps = Omit<ButtonProps, 'onClick'> & {
  children?: ReactNode
}

/** Botón Cancelar/Cerrar que dispara el cierre confirmado del LepraModal padre. */
export function ModalDismissButton({
  children = 'Cancelar',
  variant = 'outline-dark',
  ...rest
}: ModalDismissButtonProps) {
  const dismiss = useModalDismiss()
  return (
    <Button variant={variant} onClick={() => dismiss()} {...rest}>
      {children}
    </Button>
  )
}

export function LepraModal({
  show,
  onClose,
  busy = false,
  confirmClose = true,
  closeConfirmTitle = '¿Cerrar?',
  closeConfirmMessage = '¿Seguro que querés cerrar esta ventana?',
  closeConfirmLabel = 'Cerrar',
  closeConfirmCancelLabel = 'Volver',
  children,
  ...rest
}: LepraModalProps) {
  const confirm = useConfirm()
  const confirmingRef = useRef(false)

  useEffect(() => {
    if (!show) {
      const t = window.setTimeout(releaseBootstrapModalLock, 400)
      return () => window.clearTimeout(t)
    }
  }, [show])

  const requestClose = useCallback(() => {
    if (busy) return
    if (!confirmClose) {
      onClose()
      return
    }
    if (confirmingRef.current) return
    confirmingRef.current = true
    void (async () => {
      try {
        const ok = await confirm({
          title: closeConfirmTitle,
          message: closeConfirmMessage,
          confirmLabel: closeConfirmLabel,
          cancelLabel: closeConfirmCancelLabel,
          confirmVariant: 'primary',
        })
        if (ok) onClose()
      } finally {
        confirmingRef.current = false
      }
    })()
  }, [
    busy,
    confirm,
    confirmClose,
    closeConfirmCancelLabel,
    closeConfirmLabel,
    closeConfirmMessage,
    closeConfirmTitle,
    onClose,
  ])

  return (
    <ModalDismissContext.Provider value={requestClose}>
      <Modal
        show={show}
        onHide={requestClose}
        backdrop={busy ? 'static' : true}
        keyboard={!busy}
        enforceFocus={!busy}
        restoreFocus={!busy}
        {...rest}
      >
        {children}
      </Modal>
    </ModalDismissContext.Provider>
  )
}
