import { useState } from 'react'
import { Container, Button, Card } from 'react-bootstrap'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { createColumnHelper } from '@tanstack/react-table'
import { useCart } from '@/context/CartContext'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { parseWeightInput } from '@/lib/formatWeight'
import {
  isFixedWeightProduct,
  lineTotal,
  lineUnitPrice,
  validateLineWeightKg,
} from '@/lib/pricing'
import { createOrderClient, createOrder } from '@/api/order'
import { Product } from '@/types'
import { ProductImage } from '@/components/ProductImage'
import toast from 'react-hot-toast'
import { DataTable } from '@/components/DataTable'
import { QuantityStepper } from '@/components/QuantityStepper'
import { DecimalInput } from '@/components/DecimalInput'

type CartRow = ReturnType<typeof useCart>['items'][0] & {
  unitPrice: number
  subtotal: number
  pieces: number
}

const cartPageClass = 'cart-page px-3 px-sm-4 py-3 py-sm-4 pb-4 pb-sm-5'

function piecesForLine(product: Product, weightKg: number): number {
  if (!isFixedWeightProduct(product)) return 0
  const piece = product.weight
  if (!piece) return 1
  return Math.max(1, Math.round(weightKg / piece))
}

export function Carrito() {
  const { items, updateWeight, adjustPieces, removeItem, clearCart } = useCart()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const totals: CartRow[] = items.map((i) => {
    const unitPrice = lineUnitPrice(i.product, i.weight)
    return {
      ...i,
      unitPrice,
      subtotal: lineTotal(i.product, i.weight, unitPrice),
      pieces: piecesForLine(i.product, i.weight),
    }
  })
  const total = totals.reduce((s, t) => s + t.subtotal, 0)

  function handleLineWeightChange(id_product: number, product: Product, raw: string) {
    const parsed = parseWeightInput(raw)
    if (!parsed.ok) return
    if (parsed.value == null) return
    const valid = validateLineWeightKg(product, parsed.value)
    if (!valid.ok) {
      toast.error(valid.message)
      return
    }
    updateWeight(id_product, parsed.value)
  }

  const columnHelper = createColumnHelper<CartRow>()
  const columns = [
    columnHelper.display({
      id: 'img',
      header: '',
      size: 70,
      cell: ({ row }) => (
        <ProductImage
          src={row.original.product.img}
          alt={row.original.product.name}
          variant="thumb"
          linkTo={`/producto/${row.original.id_product}`}
        />
      ),
    }),
    columnHelper.accessor((r) => r.product.name, {
      id: 'product',
      header: 'Producto',
      cell: (info) => <span>{info.row.original.product.name}</span>,
    }),
    columnHelper.display({
      id: 'weight',
      header: 'Cant. / kg',
      cell: ({ row }) => {
        const { product, id_product, weight, pieces } = row.original
        if (isFixedWeightProduct(product)) {
          return (
            <QuantityStepper
              value={pieces}
              onChange={(p) => adjustPieces(id_product, p - pieces)}
              ariaLabel={`Piezas de ${product.name}`}
            />
          )
        }
        return (
          <DecimalInput
            size="sm"
            className="input-kg"
            value={String(weight)}
            onChange={(e) => handleLineWeightChange(id_product, product, e.target.value)}
            aria-label={`Peso de ${product.name}`}
          />
        )
      },
    }),
    columnHelper.display({
      id: 'unitPrice',
      header: 'Precio',
      cell: ({ row }) => (
        <span>
          {formatMoneyWithSymbol(row.original.unitPrice)}
          {!isFixedWeightProduct(row.original.product) && (
            <span className="text-muted small">/kg</span>
          )}
        </span>
      ),
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

  const token = localStorage.getItem('lepra_token')
  const isLoggedIn = !!token

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoggedIn) return
    if (items.length === 0) {
      toast.error('El carrito está vacío')
      return
    }

    for (const t of totals) {
      const valid = validateLineWeightKg(t.product, t.weight)
      if (!valid.ok) {
        toast.error(`${t.product.name}: ${valid.message}`)
        return
      }
    }

    const userStr = localStorage.getItem('lepra_user')
    const user = userStr ? JSON.parse(userStr) : null
    const isAdmin = user?.rol === 'ADMIN'

    setLoading(true)
    const linePayload = totals.map((t) => ({
      id_product: t.id_product,
      weight: t.weight,
      ...(isAdmin ? { price_per_kg: t.unitPrice } : {}),
    }))
    const { error } = isAdmin
      ? await createOrder({ id_user: user.id, lines: linePayload })
      : await createOrderClient({ lines: linePayload.map(({ id_product, weight }) => ({ id_product, weight })) })
    setLoading(false)
    if (error) {
      toast.error(error.message || 'Error al crear el pedido')
      return
    }
    clearCart()
    toast.success('Pedido enviado con éxito')
    navigate('/')
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
      {!isLoggedIn ? (
        <p className="text-muted small mb-3">
          Podés armar el pedido sin cuenta. Para confirmarlo, iniciá sesión. El carrito se guarda en este
          dispositivo.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="position-relative">
        {loading ? <LoadingOverlay message="Enviando pedido..." variant="page" /> : null}
        <div className="cart-items-mobile d-lg-none">
          {totals.map((row) => (
            <Card key={row.id_product} className="card-lepra cart-item mb-3">
              <Card.Body className="p-3">
                <div className="d-flex gap-3 align-items-start">
                  <ProductImage
                    src={row.product.img}
                    alt={row.product.name}
                    variant="thumb"
                    linkTo={`/producto/${row.id_product}`}
                    className="cart-item-image-link flex-shrink-0"
                  />
                  <div className="flex-grow-1 min-w-0">
                    <Link
                      to={`/producto/${row.id_product}`}
                      className="cart-item-title text-dark text-decoration-none fw-semibold d-block text-truncate"
                    >
                      {row.product.name}
                    </Link>
                    <div className="d-flex align-items-center gap-2 mt-2">
                      <span className="small text-muted flex-shrink-0">
                        {isFixedWeightProduct(row.product) ? 'Piezas' : 'Peso (kg)'}
                      </span>
                      {isFixedWeightProduct(row.product) ? (
                        <QuantityStepper
                          value={row.pieces}
                          onChange={(p) => adjustPieces(row.id_product, p - row.pieces)}
                          ariaLabel={`Piezas de ${row.product.name}`}
                          className="cart-item-stepper"
                        />
                      ) : (
                        <DecimalInput
                          size="sm"
                          className="cart-item-weight-input input-kg"
                          value={String(row.weight)}
                          onChange={(e) => handleLineWeightChange(row.id_product, row.product, e.target.value)}
                          aria-label={`Peso de ${row.product.name}`}
                        />
                      )}
                    </div>
                    <p className="small text-muted mb-0 mt-2">
                      {formatMoneyWithSymbol(row.unitPrice)}
                      {!isFixedWeightProduct(row.product) ? '/kg' : ' c/u'}
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

                <div className="d-flex justify-content-end align-items-center mt-3 gap-2 flex-wrap">
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
            {isLoggedIn ? (
              <Button type="submit" className="btn-lepra cart-page-btn order-lg-2" disabled={loading}>
                Realizar pedido
              </Button>
            ) : (
              <Link
                to="/login"
                state={{ from: { pathname: '/carrito' } }}
                className="btn btn-lepra cart-page-btn order-lg-2 text-center"
              >
                Iniciar sesión para confirmar pedido
              </Link>
            )}
          </div>
        </div>
      </form>
    </Container>
  )
}
