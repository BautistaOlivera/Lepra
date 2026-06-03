import { useState, useEffect } from 'react'
import { Modal, Form, Button, Table } from 'react-bootstrap'
import { LepraModal } from '@/components/LepraModal'
import { ModalBusyFrame } from '@/components/LoadingOverlay'
import { createOrder } from '@/api/order'
import { createUser } from '@/api/user'
import { getUsersPaginatedOfflineFirst } from '@/repositories/usersRepo'
import { getProductsPaginatedOfflineFirst } from '@/repositories/productsRepo'
import { User, Product, Order } from '@/types'
import toast from 'react-hot-toast'
import { Select, type SelectOption } from '@/components/Select'
import { ClientePedidoSelect, type ClientePedidoValue } from '@/components/ClientePedidoSelect'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { nextTempId } from '@/offline/ids'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { buildQuickClientEmail, buildQuickClientPassword, findUserByClientQuery } from '@/lib/quickClient'

type SubmitPhase = 'idle' | 'client' | 'order'

function submitPhaseMessage(phase: SubmitPhase): string {
  switch (phase) {
    case 'client':
      return 'Creando cliente nuevo...'
    case 'order':
      return 'Creando pedido...'
    default:
      return ''
  }
}

interface PedidoModalProps {
  show: boolean
  onClose: (refresh?: boolean) => void
}

function getUnitPrice(product: Product, quantity: number): number {
  if (!product.has_tiered_pricing || !product.price_tiers?.length) return product.price
  const sorted = [...product.price_tiers].sort((a, b) => b.min_quantity - a.min_quantity)
  for (const t of sorted) {
    if (quantity >= t.min_quantity) return t.unit_price
  }
  return product.price
}

export function PedidoModal({ show, onClose }: PedidoModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clientValue, setClientValue] = useState<ClientePedidoValue | null>(null)
  const [lines, setLines] = useState<{ id_product: number; quantity: number; unit_price: number; product?: Product }[]>([])

  const validLines = lines.filter((l) => l.id_product !== 0)
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('idle')
  const [loadingData, setLoadingData] = useState(false)
  const loading = submitPhase !== 'idle'

  useEffect(() => {
    if (!show) {
      setLoadingData(false)
      return
    }
    setLoadingData(true)
    setClientValue(null)
    setLines([])
    Promise.all([
      getUsersPaginatedOfflineFirst({ limit: 100, filters: {} }),
      getProductsPaginatedOfflineFirst({ limit: 100, filters: {} }),
    ])
      .then(([usersRes, productsRes]) => {
        if (usersRes.data) setUsers(usersRes.data.items)
        if (productsRes.data) setProducts(productsRes.data.items)
        if (productsRes.error) toast.error(productsRes.error.message || 'Error al cargar productos')
        if (usersRes.error) toast.error(usersRes.error.message || 'Error al cargar clientes')
      })
      .catch(() => toast.error('Error al cargar datos'))
      .finally(() => setLoadingData(false))
  }, [show])

  function addLine() {
    if (products.length === 0) {
      toast.error('No hay productos cargados')
      return
    }
    setLines([...lines, { id_product: 0, quantity: 1, unit_price: 0 }])
  }

  function updateLine(index: number, field: 'id_product' | 'quantity', value: number | null) {
    const newLines = [...lines]
    const line = newLines[index]
    if (field === 'id_product') {
      if (value == null || value === 0) {
        line.id_product = 0
        line.unit_price = 0
        line.product = undefined
      } else {
        const product = products.find((x) => x.id === value)
        if (product) {
          line.id_product = product.id
          line.unit_price = getUnitPrice(product, line.quantity)
          line.product = product
        }
      }
    } else if (typeof value === 'number') {
      line.quantity = Math.max(1, value)
      if (line.product) line.unit_price = getUnitPrice(line.product, line.quantity)
    }
    setLines(newLines)
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index))
  }

  const total = validLines.reduce((s, l) => s + l.quantity * l.unit_price, 0)

  const userOptions: SelectOption<number>[] = users.map((u) => ({
    value: u.id,
    label: [u.name, u.email].filter(Boolean).join(' — ') || u.email,
  }))
  const productOptions: SelectOption<number>[] = products.map((p) => ({
    value: p.id,
    label: p.brand ? `${p.name} (${p.brand})` : p.name,
  }))

  function resolveClient(): { idUser: number; displayName: string; createNew: false } | { newName: string; createNew: true } | null {
    if (!clientValue) return null
    if (clientValue.kind === 'existing') {
      const u = users.find((x) => x.id === clientValue.id)
      return {
        idUser: clientValue.id,
        displayName: u?.name || u?.email || clientValue.label,
        createNew: false,
      }
    }
    const name = clientValue.name.trim()
    if (name.length < 2) return null
    const existing = findUserByClientQuery(users, name)
    if (existing) {
      return {
        idUser: existing.id,
        displayName: existing.name || existing.email,
        createNew: false,
      }
    }
    return { newName: name, createNew: true }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const client = resolveClient()
    if (!client) {
      toast.error('Escribí o elegí un cliente')
      return
    }
    if (validLines.length === 0) {
      toast.error('Agregá al menos un producto')
      return
    }

    let createdNewUser = false
    let idUser: number
    let displayName: string

    try {
      if (!client.createNew) {
        setSubmitPhase('order')
        idUser = client.idUser
        displayName = client.displayName
      } else if (!isOnlineNow()) {
        createdNewUser = true
        setSubmitPhase('client')
        const userTempId = nextTempId()
        const email = buildQuickClientEmail(client.newName)
        const password = buildQuickClientPassword()
        await enqueueCommand('USER_CREATE', {
          tempId: userTempId,
          data: { email, password, name: client.newName, rol: 'CLIENT' },
        })
        await lepraDb.users.put({
          id: userTempId,
          email,
          name: client.newName,
          location: null,
          rol: 'CLIENT',
          active: true,
        } as User)
        idUser = userTempId
        displayName = client.newName
        setSubmitPhase('order')
      } else {
        createdNewUser = true
        setSubmitPhase('client')
        const email = buildQuickClientEmail(client.newName)
        const password = buildQuickClientPassword()
        const userRes = await createUser({
          email,
          password,
          name: client.newName,
          rol: 'CLIENT',
        })
        if (userRes.error) {
          toast.error(userRes.error.message)
          setSubmitPhase('idle')
          return
        }
        idUser = userRes.data!.user.id
        displayName = client.newName
        setSubmitPhase('order')
      }

      const linePayload = validLines.map((l) => ({
        id_product: l.id_product,
        quantity: l.quantity,
        unit_price: l.unit_price,
      }))

      const body = { id_user: idUser!, lines: linePayload }

      if (!isOnlineNow()) {
        const orderTempId = nextTempId()
        await enqueueCommand('ORDER_CREATE_ADMIN', { tempId: orderTempId, data: body })
        await lepraDb.orders.put({
          id: orderTempId,
          id_user: idUser,
          customer_name: null,
          user_name: displayName,
          total,
          created_at: new Date().toISOString(),
          status: 'PENDING',
          active: true,
          lines: linePayload,
        } as Order)
        const dependsOnPending = idUser < 0 || validLines.some((l) => l.id_product < 0)
        toast.success(
          createdNewUser
            ? dependsOnPending
              ? 'Pedido y cliente nuevos guardados (pendientes de sincronizar)'
              : 'Pedido creado con cliente nuevo (pendiente de sincronizar)'
            : dependsOnPending
              ? 'Pedido creado (pendiente; sincronizará después de productos o clientes nuevos)'
              : 'Pedido creado (pendiente de sincronizar)'
        )
      } else {
        const { error } = await createOrder(body)
        if (error) {
          toast.error(error.message)
          setSubmitPhase('idle')
          return
        }
        toast.success(createdNewUser ? 'Pedido creado con cliente nuevo' : 'Pedido creado')
      }

      setSubmitPhase('idle')
      onClose(true)
    } catch {
      setSubmitPhase('idle')
    }
  }

  const clientReady =
    clientValue?.kind === 'existing' ||
    (clientValue?.kind === 'new' && clientValue.name.trim().length >= 2)

  const busy = loading || loadingData
  const busyMessage = loading ? submitPhaseMessage(submitPhase) : 'Cargando datos...'

  return (
    <LepraModal show={show} onClose={() => onClose()} busy={busy} size="lg">
      <Modal.Header closeButton={!busy} className="border-dark">
        <Modal.Title>Nuevo pedido</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ModalBusyFrame busy={busy} message={busyMessage}>
          <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-4">
            <Form.Label>Cliente</Form.Label>
            <ClientePedidoSelect
              options={userOptions}
              users={users}
              value={clientValue}
              onChange={setClientValue}
              disabled={busy}
            />
            <Form.Text className="text-muted">
              Elegí uno de la lista o escribí un nombre; si no hay coincidencia, se crea un cliente nuevo al guardar.
            </Form.Text>
          </Form.Group>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0">Productos</h6>
            <Button
              type="button"
              variant="outline-dark"
              size="sm"
              onClick={addLine}
              disabled={busy || products.length === 0}
            >
              + Agregar
            </Button>
          </div>

          <Table size="sm" className="mb-4" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '45%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-center">Cant.</th>
                <th className="text-end">Precio u.</th>
                <th className="text-end">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="align-middle">
                    <Select<number>
                      size="sm"
                      options={productOptions}
                      value={l.id_product === 0 ? null : l.id_product}
                      onChange={(id) => updateLine(i, 'id_product', id ?? 0)}
                      placeholder="Buscar por nombre..."
                      isSearchable
                    />
                  </td>
                  <td className="align-middle text-center">
                    <Form.Control
                      type="number"
                      min={1}
                      size="sm"
                      className="w-100"
                      style={{ minHeight: 31 }}
                      value={l.quantity}
                      onChange={(e) => updateLine(i, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </td>
                  <td className="text-end align-middle">{formatMoneyWithSymbol(l.unit_price)}</td>
                  <td className="text-end align-middle">{formatMoneyWithSymbol(l.quantity * l.unit_price)}</td>
                  <td className="align-middle">
                    <Button variant="link" size="sm" className="text-danger p-0" onClick={() => removeLine(i)}>
                      ✕
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <p className="fw-bold">Total: {formatMoneyWithSymbol(total)}</p>

              <div className="d-flex justify-content-end gap-2">
                <Button variant="outline-dark" onClick={() => onClose()} disabled={busy}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  className="pedido-modal-submit-btn fw-semibold"
                  disabled={busy || !clientReady || validLines.length === 0}
                >
                  Crear pedido
                </Button>
              </div>
          </Form>
        </ModalBusyFrame>
      </Modal.Body>
    </LepraModal>
  )
}
