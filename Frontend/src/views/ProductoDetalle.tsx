import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from 'react-bootstrap'
import { LoadingCenter } from '@/components/LoadingOverlay'
import { ArrowLeft, Minus, Plus, ShoppingCart } from 'lucide-react'
import { getProduct } from '@/api/product'
import { Product } from '@/types'
import { useCart } from '@/context/CartContext'
import { ProductImage } from '@/components/ProductImage'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'

export function ProductoDetalle() {
  const { id } = useParams()
  const { addItem } = useCart()
  const [product, setProduct] = useState<Product | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (!id) return
    getProduct(parseInt(id)).then(({ data }) => {
      setProduct(data ?? undefined)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="product-detail-page px-3 px-sm-4 py-4 text-center">
        <LoadingCenter message="Cargando producto..." />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="product-detail-page px-3 px-sm-4 py-4 text-center">
        <p className="mb-3">Producto no encontrado.</p>
        <Link to="/" className="btn btn-lepra product-detail-back-btn">
          <ArrowLeft size={18} className="me-1" aria-hidden /> Volver al catálogo
        </Link>
      </div>
    )
  }

  const decrementQuantity = () => setQuantity((q) => Math.max(1, q - 1))
  const incrementQuantity = () => setQuantity((q) => q + 1)

  const releaseQtyBtn = (btn: HTMLButtonElement) => {
    window.setTimeout(() => {
      btn.classList.remove('product-detail-qty-btn--pressed')
      btn.blur()
    }, 150)
  }

  const handleQtyPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.disabled) return
    e.currentTarget.classList.add('product-detail-qty-btn--pressed')
  }

  const handleQtyPointerUp = (
    e: React.PointerEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    const btn = e.currentTarget
    if (btn.disabled) return
    action()
    releaseQtyBtn(btn)
  }

  const handleQtyPointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    releaseQtyBtn(e.currentTarget)
  }

  const specs: { label: string; value: string }[] = []
  if (product.brand) specs.push({ label: 'Marca', value: product.brand })
  if (product.category) specs.push({ label: 'Categoría', value: product.category })
  if (product.has_tiered_pricing) specs.push({ label: 'Precio', value: 'Por volumen' })

  const sortedTiers =
    product.has_tiered_pricing && product.price_tiers?.length
      ? [...product.price_tiers].sort((a, b) => a.min_quantity - b.min_quantity)
      : []

  return (
    <div className="product-detail-page px-3 px-sm-4 py-2 py-md-3">
      <div className="product-detail-page-inner mx-auto">
        <Link to="/" className="product-detail-back text-dark text-decoration-none">
          <ArrowLeft size={20} className="me-1" aria-hidden /> Volver al catálogo
        </Link>

        <article className="product-detail-panel card-lepra mt-2">
          <div className="product-detail-image-wrap">
            <ProductImage src={product.img} alt={product.name} variant="detail" className="w-100 h-100" />
          </div>

          <div className="product-detail-info">
            <div className="product-detail-summary">
              <h1 className="product-detail-title h4 mb-2">{product.name}</h1>

              {specs.length > 0 ? (
                <dl className="product-detail-specs mb-2">
                  {specs.map((row) => (
                    <div key={row.label} className="product-detail-spec-row">
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <p className="product-detail-price fw-bold text-dark mb-0">
                {formatMoneyWithSymbol(product.price)}
              </p>

              {sortedTiers.length > 0 ? (
                <div className="product-detail-tiers mt-2 pt-2 border-top">
                  <p className="small fw-bold mb-1">Precios por volumen</p>
                  <ul className="list-unstyled small mb-0 product-detail-tiers-list">
                    {sortedTiers.map((t) => (
                      <li key={t.id}>
                        Desde {t.min_quantity} u: {formatMoneyWithSymbol(t.unit_price)}/u
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="product-detail-actions">
              <div className="product-detail-quantity">
                <span className="product-detail-qty-label">Cantidad</span>
                <div
                  className="product-detail-qty-stepper"
                  role="group"
                  aria-label="Cantidad del producto"
                >
                  <button
                    type="button"
                    className="btn btn-outline-dark product-detail-qty-btn"
                    onPointerDown={handleQtyPointerDown}
                    onPointerUp={(e) => handleQtyPointerUp(e, decrementQuantity)}
                    onPointerLeave={handleQtyPointerLeave}
                    disabled={quantity <= 1}
                    aria-label="Reducir cantidad"
                  >
                    <Minus size={20} aria-hidden />
                  </button>
                  <span className="product-detail-qty-value" aria-live="polite" aria-atomic="true">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline-dark product-detail-qty-btn"
                    onPointerDown={handleQtyPointerDown}
                    onPointerUp={(e) => handleQtyPointerUp(e, incrementQuantity)}
                    onPointerLeave={handleQtyPointerLeave}
                    aria-label="Aumentar cantidad"
                  >
                    <Plus size={20} aria-hidden />
                  </button>
                </div>
              </div>

              <div className="product-detail-buttons">
                <Button className="btn-lepra w-100" onClick={() => addItem(product, quantity)}>
                  <ShoppingCart size={18} className="me-1" aria-hidden /> Agregar al carrito
                </Button>
                <Link to="/carrito" className="btn btn-outline-dark w-100">
                  Ver carrito
                </Link>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
