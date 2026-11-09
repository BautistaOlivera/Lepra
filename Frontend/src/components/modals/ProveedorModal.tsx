import { useEffect, useState } from 'react'
import { Modal, Form, Button } from 'react-bootstrap'
import { LepraModal, ModalDismissButton } from '@/components/LepraModal'
import { ModalBusyFrame } from '@/components/LoadingOverlay'
import { createSupplier, updateSupplier } from '@/api/supplier'
import type { Supplier } from '@/types'
import toast from 'react-hot-toast'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { nextTempId } from '@/offline/ids'

interface ProveedorModalProps {
  show: boolean
  onClose: (refresh?: boolean) => void
  editing: Supplier | null
}

export function ProveedorModal({ show, onClose, editing }: ProveedorModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const isEditing = !!editing

  useEffect(() => {
    setName(editing?.name || '')
  }, [editing, show])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('El nombre es obligatorio')
      return
    }
    setLoading(true)
    if (isEditing) {
      if (!isOnlineNow()) {
        await enqueueCommand('SUPPLIER_UPDATE', { id: editing!.id, name: trimmed })
        await lepraDb.suppliers.update(editing!.id, { name: trimmed })
        toast.success('Cambio guardado (pendiente de sincronizar)')
        setLoading(false)
        onClose(true)
        return
      }
      const { error } = await updateSupplier({ id: editing!.id, name: trimmed })
      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }
      toast.success('Proveedor actualizado')
      setLoading(false)
      onClose(true)
      return
    }

    if (!isOnlineNow()) {
      const tempId = nextTempId()
      await enqueueCommand('SUPPLIER_CREATE', { tempId, data: { name: trimmed } })
      await lepraDb.suppliers.put({ id: tempId, name: trimmed, active: true })
      toast.success('Proveedor creado (pendiente de sincronizar)')
      setLoading(false)
      onClose(true)
      return
    }

    const { data, error } = await createSupplier({ name: trimmed })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    if (data?.supplier) await lepraDb.suppliers.put(data.supplier)
    toast.success('Proveedor creado')
    setLoading(false)
    onClose(true)
  }

  return (
    <LepraModal show={show} onClose={() => onClose()} busy={loading}>
      <Modal.Header closeButton={!loading} className="border-dark">
        <Modal.Title>{isEditing ? 'Editar proveedor' : 'Agregar proveedor'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ModalBusyFrame busy={loading} message={isEditing ? 'Guardando cambios...' : 'Creando proveedor...'}>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              <ModalDismissButton />
              <Button type="submit" className="btn-lepra" disabled={loading}>
                Guardar
              </Button>
            </div>
          </Form>
        </ModalBusyFrame>
      </Modal.Body>
    </LepraModal>
  )
}
