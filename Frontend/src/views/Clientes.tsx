import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Spinner, Form, InputGroup } from 'react-bootstrap'
import { Plus, Pencil, Trash2, Search, RotateCcw, CheckCircle2 } from 'lucide-react'
import { createColumnHelper } from '@tanstack/react-table'
import { deactivateUser } from '@/api/user'
import { getUsersPaginatedOfflineFirst } from '@/repositories/usersRepo'
import { User } from '@/types'
import toast from 'react-hot-toast'
import { ClienteModal } from '@/components/modals/ClienteModal'
import { DataTable } from '@/components/DataTable'
import { Select } from '@/components/Select'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { useOutboxPending } from '@/offline/useOutboxPending'

const columnHelper = createColumnHelper<User>()

export function Clientes() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [rolFilter, setRolFilter] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<boolean | null>(true)
  const { users: pendingUsers, refresh: refreshPending } = useOutboxPending()

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const loadUsers = useCallback(async (lastId?: number) => {
    setLoading(true)
    const filters: Record<string, unknown> = {}
    if (searchDebounced.trim()) filters.search = searchDebounced.trim()
    if (rolFilter) filters.rol = rolFilter
    if (activeFilter !== null) filters.active = activeFilter
    const { data } = await getUsersPaginatedOfflineFirst({
      limit: 20,
      last_seen_id: lastId ?? null,
      filters,
    })
    if (data) {
      setUsers((prev) => (lastId ? [...prev, ...data.items] : data.items))
      setNextCursor(data.next_cursor)
    }
    setLoading(false)
  }, [searchDebounced, rolFilter, activeFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

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
    if (!isOnlineNow()) {
      await enqueueCommand('USER_DEACTIVATE', { id: u.id })
      await lepraDb.users.update(u.id, { active: false })
      toast.success('Cambio guardado (pendiente de sincronizar)')
      refreshPending().catch(() => {})
      loadUsers()
      return
    }
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
    if (refresh) {
      refreshPending().catch(() => {})
      loadUsers()
    }
  }

  function clearFilters() {
    setSearch('')
    setRolFilter(null)
    setActiveFilter(true)
  }

  const columns = [
    columnHelper.accessor('email', { header: 'Email' }),
    columnHelper.accessor('name', {
      header: 'Nombre',
      cell: (info) => info.getValue() || '-',
    }),
    columnHelper.accessor('location', {
      header: 'Ubicación',
      cell: (info) => info.getValue() || '-',
    }),
    columnHelper.accessor('rol', {
      header: 'Rol',
      cell: (info) => (
        <Badge bg={info.getValue() === 'ADMIN' ? 'dark' : 'secondary'}>{info.getValue()}</Badge>
      ),
    }),
    columnHelper.accessor('active', {
      header: 'Estado',
      cell: (info) =>
        info.getValue() ? <Badge bg="success">Activo</Badge> : <Badge bg="danger">Inactivo</Badge>,
    }),
    columnHelper.display({
      id: 'sync',
      header: 'Sync',
      cell: ({ row }) =>
        row.original.id < 0 || pendingUsers.has(row.original.id) ? (
          <Badge bg="warning" className="text-dark">Pendiente</Badge>
        ) : (
          <CheckCircle2 size={18} className="text-success" aria-label="Sincronizado">
            <title>Sincronizado</title>
          </CheckCircle2>
        ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.active ? (
          <>
            <Button variant="link" size="sm" className="text-dark p-0 me-2" onClick={() => handleEdit(row.original)}>
              <Pencil size={16} />
            </Button>
            <Button variant="link" size="sm" className="text-danger p-0" onClick={() => handleDeactivate(row.original)}>
              <Trash2 size={16} />
            </Button>
          </>
        ) : null,
    }),
  ]

  return (
    <>
      <h2 className="text-dark mb-3">Clientes</h2>
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap" style={{ width: '100%' }}>
        <InputGroup className="flex-grow-1" style={{ minWidth: 200, maxWidth: 340 }}>
          <InputGroup.Text><Search size={18} /></InputGroup.Text>
          <Form.Control
            placeholder="Buscar clientes por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <div style={{ minWidth: 150, width: 150 }}>
          <Select<string>
            options={[
              { value: '', label: 'Todos los roles' },
              { value: 'CLIENT', label: 'Cliente' },
              { value: 'ADMIN', label: 'Administrador' },
            ]}
            value={rolFilter ?? ''}
            onChange={(v) => setRolFilter(v || null)}
            placeholder="Rol"
            isSearchable={false}
          />
        </div>
        <div style={{ minWidth: 150, width: 150 }}>
          <Select<string>
            options={[
              { value: 'true', label: 'Activos' },
              { value: 'false', label: 'Inactivos' },
              { value: 'all', label: 'Todos' },
            ]}
            value={activeFilter === null ? 'all' : String(activeFilter)}
            onChange={(v) => setActiveFilter(v === 'all' || v === '' ? null : v === 'true')}
            placeholder="Estado"
            isSearchable={false}
          />
        </div>
        <Button
          variant="outline-secondary"
          onClick={clearFilters}
          title="Limpiar filtros"
          className="d-flex align-items-center justify-content-center p-0 flex-shrink-0"
          style={{ height: 38, width: 38 }}
        >
          <RotateCcw size={18} />
        </Button>
        <Button className="btn-lepra flex-shrink-0 ms-auto" onClick={handleAdd}>
          <Plus size={18} className="me-1" /> Agregar cliente
        </Button>
      </div>

      {loading && users.length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <DataTable columns={columns} data={users} getRowId={(row) => String(row.id)} />
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
