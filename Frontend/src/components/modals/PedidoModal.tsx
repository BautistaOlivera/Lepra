import { useState, useEffect } from 'react'
import { Modal, Form, Button, Table, Spinner } from 'react-bootstrap'
import { createOrder } from '@/api/order'
import { getUsersPaginatedOfflineFirst } from '@/repositories/usersRepo'
import { getProductsPaginatedOfflineFirst } from '@/repositories/productsRepo'
import { User, Product } from '@/types'
import toast from 'react-hot-toast'
import { Select, type SelectOption } from '@/components/Select'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { nextTempId } from '@/offline/ids'

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
  const [idUser, setIdUser] = useState<number | ''>('')
  const [lines, setLines] = useState<{ id_product: number; quantity: number; unit_price: number; product?: Product }[]>([])

  const validLines = lines.filter((l) => l.id_product !== 0)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (!show) {
      setLoadingData(false)
      return
    }
    setLoadingData(true)
    setIdUser('')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idUser || validLines.length === 0) {
      toast.error('Selecciona un cliente y agrega al menos un producto')
      return
    }
    setLoading(true)
    const body = {
      id_user: Number(idUser),
      lines: validLines.map((l) => ({ id_product: l.id_product, quantity: l.quantity, unit_price: l.unit_price })),
    }
    if (!isOnlineNow()) {
      const tempId = nextTempId()
      const selectedUser = users.find((u) => u.id === Number(idUser))
      await enqueueCommand('ORDER_CREATE_ADMIN', { tempId, data: body })
      await lepraDb.orders.put({
        id: tempId,
        id_user: Number(idUser),
        user_name: selectedUser?.name || selectedUser?.email || null,
        total,
        created_at: new Date().toISOString(),
        status: 'PENDING',
        active: true,
        lines: validLines.map((l) => ({ id_product: l.id_product, quantity: l.quantity, unit_price: l.unit_price })),
      } as any)
      const dependsOnPending = Number(idUser) < 0 || validLines.some((l) => l.id_product < 0)
      toast.success(
        dependsOnPending
          ? 'Pedido creado (pendiente; sincronizará después de productos/clientes nuevos)'
          : 'Pedido creado (pendiente de sincronizar)'
      )
      setLoading(false)
      onClose(true)
      return
    }

    const { error } = await createOrder(body)
    setLoading(false)
    if (error) toast.error(error.message)
    else {
      toast.success('Pedido creado')
      onClose(true)
    }
  }

  return (
    <Modal show={show} onHide={() => onClose()} size="lg">
      <Modal.Header closeButton className="border-dark">
        <Modal.Title>Nuevo pedido</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-4">
            <Form.Label>Cliente</Form.Label>
            <Select<number>
              options={userOptions}
              value={idUser === '' ? null : idUser}
              onChange={(id) => setIdUser(id ?? '')}
              placeholder="Buscar por nombre o email..."
            />
          </Form.Group>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0">Productos</h6>
            <Button
              type="button"
              variant="outline-dark"
              size="sm"
              onClick={addLine}
              disabled={loadingData || products.length === 0}
            >
              {loadingData ? <><Spinner animation="border" size="sm" className="me-1" />Cargando...</> : '+ Agregar'}
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
                  <td className="text-end align-middle">${l.unit_price.toFixed(2)}</td>
                  <td className="text-end align-middle">${(l.quantity * l.unit_price).toFixed(2)}</td>
                  <td className="align-middle">
                    <Button variant="link" size="sm" className="text-danger p-0" onClick={() => removeLine(i)}>
                      ✕
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <p className="fw-bold">Total: ${total.toFixed(2)}</p>

          <div className="d-flex justify-content-end gap-2">
            <Button variant="outline-dark" onClick={() => onClose()}>Cancelar</Button>
            <Button type="submit" className="btn-lepra" disabled={loading || validLines.length === 0}>
              {loading ? 'Creando...' : 'Crear pedido'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  )
}
