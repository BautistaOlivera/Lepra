import { useEffect } from 'react'
import { Modal, type ModalProps } from 'react-bootstrap'
import { releaseBootstrapModalLock } from '@/lib/bootstrapModal'

type LepraModalProps = Omit<ModalProps, 'show' | 'onHide'> & {
  show: boolean
  onClose: () => void
  busy?: boolean
}

export function LepraModal({ show, onClose, busy = false, children, ...rest }: LepraModalProps) {
  useEffect(() => {
    if (!show) {
      const t = window.setTimeout(releaseBootstrapModalLock, 400)
      return () => window.clearTimeout(t)
    }
  }, [show])

  return (
    <Modal
      show={show}
      onHide={onClose}
      backdrop={busy ? 'static' : true}
      keyboard={!busy}
      enforceFocus={!busy}
      restoreFocus={!busy}
      {...rest}
    >
      {children}
    </Modal>
  )
}
