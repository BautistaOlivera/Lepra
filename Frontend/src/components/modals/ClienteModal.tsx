import { useState, useEffect } from 'react'
import { Modal, Form, Button } from 'react-bootstrap'
import { LepraModal } from '@/components/LepraModal'
import { ModalBusyFrame } from '@/components/LoadingOverlay'
import { createUser, updateUser } from '@/api/user'
import { User } from '@/types'
import toast from 'react-hot-toast'
import { Select } from '@/components/Select'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { nextTempId } from '@/offline/ids'

interface ClienteModalProps {
  show: boolean
  onClose: (refresh?: boolean) => void
  editingUser: User | null
}

export function ClienteModal({ show, onClose, editingUser }: ClienteModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [rol, setRol] = useState<'CLIENT' | 'ADMIN'>('CLIENT')
  const [loading, setLoading] = useState(false)

  const isEditing = !!editingUser

  const passwordMismatchCreate =
    !isEditing && passwordConfirm.length > 0 && password !== passwordConfirm
  const passwordMismatchEdit =
    isEditing &&
    (password.length > 0 || passwordConfirm.length > 0) &&
    (password !== passwordConfirm || password.length === 0)
  const cannotSubmitPassword =
    (!isEditing && (!password || password !== passwordConfirm)) || passwordMismatchEdit

  useEffect(() => {
    if (editingUser) {
      setEmail(editingUser.email)
      setPassword('')
      setPasswordConfirm('')
      setName(editingUser.name || '')
      setLocation(editingUser.location || '')
      setRol(editingUser.rol as 'CLIENT' | 'ADMIN')
    } else {
      setEmail('')
      setPassword('')
      setPasswordConfirm('')
      setName('')
      setLocation('')
      setRol('CLIENT')
    }
  }, [editingUser, show])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isEditing && password !== passwordConfirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    if (
      isEditing &&
      (password.length > 0 || passwordConfirm.length > 0) &&
      (password !== passwordConfirm || !password)
    ) {
      toast.error(
        password.length === 0
          ? 'Completá la nueva contraseña en ambos campos'
          : 'Las contraseñas no coinciden',
      )
      return
    }
    setLoading(true)
    if (isEditing) {
      if (!isOnlineNow()) {
        const patch = {
          id: editingUser!.id,
          email,
          password: password || undefined,
          name: name || undefined,
          location: location || undefined,
          rol,
        }
        await enqueueCommand('USER_UPDATE', patch)
        await lepraDb.users.update(editingUser!.id, {
          name: name || null,
          location: location || null,
          rol,
        })
        toast.success('Cambio guardado (pendiente de sincronizar)')
        setLoading(false)
        onClose(true)
        return
      }
      const { error } = await updateUser({
        id: editingUser!.id,
        email,
        password: password || undefined,
        name: name || undefined,
        location: location || undefined,
        rol,
      })
      if (error) toast.error(error.message)
      else {
        toast.success('Cliente actualizado')
        setLoading(false)
        onClose(true)
        return
      }
    } else {
      if (!isOnlineNow()) {
        const tempId = nextTempId()
        const data = { email, password, name: name || undefined, location: location || undefined, rol }
        await enqueueCommand('USER_CREATE', { tempId, data })
        await lepraDb.users.put({
          id: tempId,
          email,
          name: name || null,
          location: location || null,
          rol,
          active: true,
        } as any)
        toast.success('Usuario creado (pendiente de sincronizar)')
        setLoading(false)
        onClose(true)
        return
      }
      const { error } = await createUser({ email, password, name: name || undefined, location: location || undefined, rol })
      if (error) toast.error(error.message)
      else {
        toast.success('Cliente creado')
        setLoading(false)
        onClose(true)
        return
      }
    }
    setLoading(false)
  }

  return (
    <LepraModal show={show} onClose={() => onClose()} busy={loading}>
      <Modal.Header closeButton={!loading} className="border-dark">
        <Modal.Title>{isEditing ? 'Editar cliente' : 'Agregar cliente'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ModalBusyFrame busy={loading} message={isEditing ? 'Guardando cambios...' : 'Creando cliente...'}>
          <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isEditing}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Contraseña {isEditing && '(dejar vacío para no cambiar)'}</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required={!isEditing}
              isInvalid={passwordMismatchCreate || passwordMismatchEdit}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>{isEditing ? 'Repetir nueva contraseña' : 'Repetir contraseña'}</Form.Label>
            <Form.Control
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              required={!isEditing}
              isInvalid={passwordMismatchCreate || passwordMismatchEdit}
            />
            {(passwordMismatchCreate || passwordMismatchEdit) && (
              <Form.Control.Feedback type="invalid">
                {isEditing && password.length === 0 && passwordConfirm.length > 0
                  ? 'Completá también el campo de contraseña'
                  : 'Las contraseñas deben coincidir'}
              </Form.Control.Feedback>
            )}
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Nombre</Form.Label>
            <Form.Control value={name} onChange={(e) => setName(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Ubicación</Form.Label>
            <Form.Control value={location} onChange={(e) => setLocation(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Rol</Form.Label>
            <Select<string>
              options={[
                { value: 'CLIENT', label: 'Cliente' },
                { value: 'ADMIN', label: 'Administrador' },
              ]}
              value={rol}
              onChange={(v) => v != null && setRol(v as 'CLIENT' | 'ADMIN')}
              placeholder="Seleccionar rol..."
              isSearchable={false}
            />
          </Form.Group>
              <div className="d-flex justify-content-end gap-2">
                <Button variant="outline-dark" onClick={() => onClose()} disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" className="btn-lepra" disabled={loading || cannotSubmitPassword}>
                  {isEditing ? 'Guardar' : 'Crear'}
                </Button>
              </div>
          </Form>
        </ModalBusyFrame>
      </Modal.Body>
    </LepraModal>
  )
}
