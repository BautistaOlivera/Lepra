import { useState, useEffect } from 'react'
import { Modal, Form, Button, Table } from 'react-bootstrap'
import { createOrder } from '@/api/order'
import { getUsersPaginated } from '@/api/user'
import { getProductsPaginated } from '@/api/product'
import { User, Product } from '@/types'
import toast from 'react-hot-toast'

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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (show) {
      getUsersPaginated({ limit: 100, filters: {} }).then(({ data }) => {
        if (data) setUsers(data.items)
      })
      getProductsPaginated({ limit: 100, filters: {} }).then(({ data }) => {
        if (data) setProducts(data.items)
      })
      setIdUser('')
      setLines([])
    }
  }, [show])

  function addLine() {
    const p = products[0]
    if (!p) {
      toast.error('No hay productos cargados')
      return
    }
    setLines([...lines, { id_product: p.id, quantity: 1, unit_price: getUnitPrice(p, 1), product: p }])
  }

  function updateLine(index: number, field: 'id_product' | 'quantity', value: number) {
    const newLines = [...lines]
    const line = newLines[index]
    if (field === 'id_product') {
      const product = products.find((x) => x.id === value)
      if (product) {
        line.id_product = product.id
        line.unit_price = getUnitPrice(product, line.quantity)
        line.product = product
      }
    } else {
      line.quantity = Math.max(1, value)
      if (line.product) line.unit_price = getUnitPrice(line.product, line.quantity)
    }
    setLines(newLines)
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index))
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idUser || lines.length === 0) {
      toast.error('Selecciona un cliente y agrega al menos un producto')
      return
    }
    setLoading(true)
    const body = {
      id_user: Number(idUser),
      lines: lines.map((l) => ({ id_product: l.id_product, quantity: l.quantity, unit_price: l.unit_price })),
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
            <Form.Select value={idUser} onChange={(e) => setIdUser(e.target.value ? Number(e.target.value) : '')} required>
              <option value="">Seleccionar...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.email} {u.name ? `(${u.name})` : ''}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0">Productos</h6>
            <Button type="button" variant="outline-dark" size="sm" onClick={addLine}>
              + Agregar
            </Button>
          </div>

          <Table size="sm" className="mb-4">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Precio u.</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <Form.Select
                      size="sm"
                      value={l.id_product}
                      onChange={(e) => updateLine(i, 'id_product', Number(e.target.value))}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Form.Select>
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      min={1}
                      size="sm"
                      style={{ width: 70 }}
                      value={l.quantity}
                      onChange={(e) => updateLine(i, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </td>
                  <td>${l.unit_price.toFixed(2)}</td>
                  <td>${(l.quantity * l.unit_price).toFixed(2)}</td>
                  <td>
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
            <Button type="submit" className="btn-lepra" disabled={loading || lines.length === 0}>
              {loading ? 'Creando...' : 'Crear pedido'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  )
}
