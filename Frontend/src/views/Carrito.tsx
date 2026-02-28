import { useState } from 'react'
import { Container, Table, Button, Form, Spinner } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { createOrderClient, createOrder } from '@/api/order'
import { getImageUrl } from '@/api/product'
import { Product } from '@/types'
import toast from 'react-hot-toast'

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=80&q=80'

function getUnitPrice(product: Product, quantity: number): number {
  if (!product.has_tiered_pricing || !product.price_tiers?.length) return product.price
  const sorted = [...(product.price_tiers || [])].sort((a, b) => b.min_quantity - a.min_quantity)
  for (const t of sorted) {
    if (quantity >= t.min_quantity) return t.unit_price
  }
  return product.price
}

export function Carrito() {
  const { items, updateQuantity, removeItem, clearCart } = useCart()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const totals = items.map((i) => {
    const unitPrice = getUnitPrice(i.product, i.quantity)
    return { ...i, unitPrice, subtotal: i.quantity * unitPrice }
  })
  const total = totals.reduce((s, t) => s + t.subtotal, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      toast.error('El carrito está vacío')
      return
    }
    const userStr = localStorage.getItem('lepra_user')
    const user = userStr ? JSON.parse(userStr) : null
    const isAdmin = user?.rol === 'ADMIN'

    setLoading(true)
    const lines = totals.map((t) => ({
      id_product: t.id_product,
      quantity: t.quantity,
      unit_price: t.unitPrice,
    }))
    const { data, error } = isAdmin
      ? await createOrder({ id_user: user.id, lines })
      : await createOrderClient({ lines: items.map((i) => ({ id_product: i.id_product, quantity: i.quantity })) })
    setLoading(false)
    if (error) {
      toast.error(error.message || 'Error al crear el pedido')
      return
    }
    clearCart()
    toast.success(`¡Pedido #${data?.id} creado! Total: $${data?.total?.toFixed(2)}`)
    navigate('/')
  }

  const token = localStorage.getItem('lepra_token')
  if (!token) {
    return (
      <Container className="py-5">
        <p>Debes iniciar sesión para ver el carrito.</p>
        <Link to="/login" className="btn btn-lepra">Iniciar sesión</Link>
      </Container>
    )
  }

  if (items.length === 0) {
    return (
      <Container className="py-5">
        <h2 className="mb-3">Carrito vacío</h2>
        <p className="text-muted mb-4">Agrega productos desde el catálogo.</p>
        <Link to="/" className="btn btn-lepra">Ver catálogo</Link>
      </Container>
    )
  }

  return (
    <Container className="py-4">
      <h2 className="mb-4">Carrito</h2>
      <form onSubmit={handleSubmit}>
        <Table responsive className="align-middle">
          <thead className="table-dark">
            <tr>
              <th style={{ width: 70 }}></th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio u.</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {totals.map((t) => (
              <tr key={t.id_product}>
                <td>
                  <Link to={`/producto/${t.id_product}`} className="d-inline-block" style={{ cursor: 'pointer' }}>
                    <img
                      src={getImageUrl(t.product.img) || DEFAULT_IMG}
                      alt={t.product.name}
                      className="rounded"
                      style={{ width: 56, height: 56, objectFit: 'cover' }}
                    />
                  </Link>
                </td>
                <td>{t.product.name}</td>
                <td>
                  <Form.Control
                    type="number"
                    min={1}
                    size="sm"
                    style={{ width: 80 }}
                    value={t.quantity}
                    onChange={(e) => updateQuantity(t.id_product, parseInt(e.target.value) || 1)}
                  />
                </td>
                <td>${t.unitPrice.toFixed(2)}</td>
                <td>${t.subtotal.toFixed(2)}</td>
                <td>
                  <Button variant="link" size="sm" className="text-danger p-0" onClick={() => removeItem(t.id_product)}>
                    <Trash2 size={18} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="d-flex justify-content-between align-items-center mt-4 flex-wrap gap-3">
          <Link to="/" className="btn btn-outline-dark">← Seguir comprando</Link>
          <div className="d-flex align-items-center gap-4">
            <span className="fs-5 fw-bold">Total: ${total.toFixed(2)}</span>
            <Button type="submit" className="btn-lepra" disabled={loading}>
              {loading ? <><Spinner animation="border" size="sm" className="me-1" /> Procesando...</> : 'Realizar pedido'}
            </Button>
          </div>
        </div>
      </form>
    </Container>
  )
}
