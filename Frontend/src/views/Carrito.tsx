import { useState } from 'react'
import { Container, Button, Card, Spinner } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { createColumnHelper } from '@tanstack/react-table'
import { useCart } from '@/context/CartContext'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { createOrderClient, createOrder } from '@/api/order'
import { getImageUrl } from '@/api/product'
import { Product } from '@/types'
import toast from 'react-hot-toast'
import { DataTable } from '@/components/DataTable'
import { QuantityStepper } from '@/components/QuantityStepper'

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=80&q=80'

function getUnitPrice(product: Product, quantity: number): number {
  if (!product.has_tiered_pricing || !product.price_tiers?.length) return product.price
  const sorted = [...(product.price_tiers || [])].sort((a, b) => b.min_quantity - a.min_quantity)
  for (const t of sorted) {
    if (quantity >= t.min_quantity) return t.unit_price
  }
  return product.price
}

type CartRow = ReturnType<typeof useCart>['items'][0] & { unitPrice: number; subtotal: number }

const cartPageClass = 'cart-page px-3 px-sm-4 py-3 py-sm-4 pb-4 pb-sm-5'

export function Carrito() {
  const { items, updateQuantity, removeItem, clearCart } = useCart()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const totals: CartRow[] = items.map((i) => {
    const unitPrice = getUnitPrice(i.product, i.quantity)
    return { ...i, unitPrice, subtotal: i.quantity * unitPrice }
  })
  const total = totals.reduce((s, t) => s + t.subtotal, 0)

  const columnHelper = createColumnHelper<CartRow>()
  const columns = [
    columnHelper.display({
      id: 'img',
      header: '',
      size: 70,
      cell: ({ row }) => (
        <Link to={`/producto/${row.original.id_product}`} className="d-inline-block">
          <img
            src={getImageUrl(row.original.product.img) || DEFAULT_IMG}
            alt={row.original.product.name}
            className="rounded"
            style={{ width: 56, height: 56, objectFit: 'cover' }}
          />
        </Link>
      ),
    }),
    columnHelper.accessor((r) => r.product.name, { id: 'product', header: 'Producto' }),
    columnHelper.display({
      id: 'quantity',
      header: 'Cantidad',
      cell: ({ row }) => (
        <QuantityStepper
          value={row.original.quantity}
          onChange={(q) => updateQuantity(row.original.id_product, q)}
          ariaLabel={`Cantidad de ${row.original.product.name}`}
        />
      ),
    }),
    columnHelper.accessor('unitPrice', {
      header: 'Precio u.',
      cell: (info) => formatMoneyWithSymbol(info.getValue()),
    }),
    columnHelper.accessor('subtotal', {
      header: 'Subtotal',
      cell: (info) => formatMoneyWithSymbol(info.getValue()),
    }),
    columnHelper.display({
      id: 'remove',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="link"
          size="sm"
          className="text-danger p-0"
          onClick={() => removeItem(row.original.id_product)}
          aria-label={`Quitar ${row.original.product.name}`}
        >
          <Trash2 size={18} />
        </Button>
      ),
    }),
  ]

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
    const { error } = isAdmin
      ? await createOrder({ id_user: user.id, lines })
      : await createOrderClient({ lines: items.map((i) => ({ id_product: i.id_product, quantity: i.quantity })) })
    setLoading(false)
    if (error) {
      toast.error(error.message || 'Error al crear el pedido')
      return
    }
    clearCart()
    toast.success('Pedido enviado con éxito')
    navigate('/')
  }

  const token = localStorage.getItem('lepra_token')
  if (!token) {
    return (
      <Container fluid="sm" className={cartPageClass}>
        <h1 className="cart-page-title h3 mb-3">Carrito</h1>
        <p className="mb-3">Debes iniciar sesión para ver el carrito.</p>
        <Link to="/login" className="btn btn-lepra cart-page-btn">
          Iniciar sesión
        </Link>
      </Container>
    )
  }

  if (items.length === 0) {
    return (
      <Container fluid="sm" className={cartPageClass}>
        <h1 className="cart-page-title h3 mb-3">Carrito vacío</h1>
        <p className="text-muted mb-4">Agrega productos desde el catálogo.</p>
        <Link to="/" className="btn btn-lepra cart-page-btn">
          Ver catálogo
        </Link>
      </Container>
    )
  }

  return (
    <Container fluid="sm" className={cartPageClass}>
      <h1 className="cart-page-title h3 mb-3 mb-sm-4">Carrito</h1>

      <form onSubmit={handleSubmit}>
        <div className="cart-items-mobile d-lg-none">
          {totals.map((row) => (
            <Card key={row.id_product} className="card-lepra cart-item mb-3">
              <Card.Body className="p-3">
                <div className="d-flex gap-3 align-items-start">
                  <Link
                    to={`/producto/${row.id_product}`}
                    className="cart-item-image-link flex-shrink-0"
                  >
                    <img
                      src={getImageUrl(row.product.img) || DEFAULT_IMG}
                      alt=""
                      className="cart-item-image rounded"
                    />
                  </Link>
                  <div className="flex-grow-1 min-w-0">
                    <Link
                      to={`/producto/${row.id_product}`}
                      className="cart-item-title text-dark text-decoration-none fw-semibold d-block text-truncate"
                    >
                      {row.product.name}
                    </Link>
                    <p className="small text-muted mb-0 mt-1">
                      {formatMoneyWithSymbol(row.unitPrice)} c/u
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="text-danger p-0 cart-item-remove flex-shrink-0"
                    onClick={() => removeItem(row.id_product)}
                    aria-label={`Quitar ${row.product.name}`}
                  >
                    <Trash2 size={20} />
                  </Button>
                </div>

                <div className="d-flex justify-content-between align-items-center mt-3 gap-2 flex-wrap">
                  <QuantityStepper
                    value={row.quantity}
                    onChange={(q) => updateQuantity(row.id_product, q)}
                    ariaLabel={`Cantidad de ${row.product.name}`}
                    className="cart-item-stepper"
                  />
                  <span className="cart-item-subtotal fw-bold text-dark">
                    {formatMoneyWithSymbol(row.subtotal)}
                  </span>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>

        <div className="cart-table-desktop d-none d-lg-block">
          <DataTable columns={columns} data={totals} getRowId={(row) => String(row.id_product)} />
        </div>

        <div className="cart-footer mt-4 pt-3 border-top">
          <div className="cart-footer-total text-center text-lg-end mb-3 mb-lg-0">
            <span className="cart-footer-total-label text-muted d-block d-lg-inline me-lg-2">
              Total
            </span>
            <span className="cart-footer-total-value fw-bold">{formatMoneyWithSymbol(total)}</span>
          </div>

          <div className="cart-footer-actions d-flex flex-column flex-lg-row justify-content-lg-between align-items-stretch gap-2">
            <Link to="/" className="btn btn-outline-dark cart-page-btn order-lg-1">
              ← Seguir comprando
            </Link>
            <Button
              type="submit"
              className="btn-lepra cart-page-btn order-lg-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" aria-hidden />
                  Procesando...
                </>
              ) : (
                'Realizar pedido'
              )}
            </Button>
          </div>
        </div>
      </form>
    </Container>
  )
}
