import { useState, useEffect } from 'react'
import { Table, Button, Badge, Spinner } from 'react-bootstrap'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getUsersPaginated, deactivateUser } from '@/api/user'
import { User } from '@/types'
import toast from 'react-hot-toast'
import { ClienteModal } from '@/components/modals/ClienteModal'

export function Clientes() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  async function loadUsers(lastId?: number) {
    setLoading(true)
    const { data } = await getUsersPaginated({
      limit: 20,
      last_seen_id: lastId ?? null,
      filters: {},
    })
    if (data) {
      setUsers((prev) => (lastId ? [...prev, ...data.items] : data.items))
      setNextCursor(data.next_cursor)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function handleAdd() {
    setEditingUser(null)
    setModalOpen(true)
  }

  function handleEdit(u: User) {
    setEditingUser(u)
    setModalOpen(true)
  }

  async function handleDeactivate(u: User) {
    if (!confirm(`¿Desactivar a ${u.email}?`)) return
    const { error } = await deactivateUser(u.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Usuario desactivado')
      loadUsers()
    }
  }

  function onModalClose(refresh?: boolean) {
    setModalOpen(false)
    setEditingUser(null)
    if (refresh) loadUsers()
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-dark mb-0">Clientes</h2>
        <Button className="btn-lepra" onClick={handleAdd}>
          <Plus size={18} className="me-1" /> Agregar cliente
        </Button>
      </div>

      {loading && users.length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <Table responsive hover>
          <thead className="table-dark">
            <tr>
              <th>Email</th>
              <th>Nombre</th>
              <th>Ubicación</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name || '-'}</td>
                <td>{u.location || '-'}</td>
                <td><Badge bg={u.rol === 'ADMIN' ? 'dark' : 'secondary'}>{u.rol}</Badge></td>
                <td>{u.active ? <Badge bg="success">Activo</Badge> : <Badge bg="danger">Inactivo</Badge>}</td>
                <td>
                  {u.active && (
                    <>
                      <Button variant="link" size="sm" className="text-dark p-0 me-2" onClick={() => handleEdit(u)}>
                        <Pencil size={16} />
                      </Button>
                      <Button variant="link" size="sm" className="text-danger p-0" onClick={() => handleDeactivate(u)}>
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {nextCursor && (
        <div className="text-center mt-3">
          <Button variant="outline-dark" size="sm" onClick={() => loadUsers(nextCursor)} disabled={loading}>
            Cargar más
          </Button>
        </div>
      )}

      <ClienteModal show={modalOpen} onClose={onModalClose} editingUser={editingUser} />
    </>
  )
}
