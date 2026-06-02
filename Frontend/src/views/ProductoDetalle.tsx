import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Container, Row, Col, Card, Spinner, Button } from 'react-bootstrap'
import { ArrowLeft, Minus, Plus, ShoppingCart } from 'lucide-react'
import { getProduct } from '@/api/product'
import { Product } from '@/types'
import { useCart } from '@/context/CartContext'
import { getImageUrl } from '@/api/product'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600&q=80'

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
      <Container fluid="sm" className="product-detail px-3 px-sm-4 py-5 text-center">
        <Spinner animation="border" />
      </Container>
    )
  }

  if (!product) {
    return (
      <Container fluid="sm" className="product-detail px-3 px-sm-4 py-4">
        <p className="mb-3">Producto no encontrado.</p>
        <Link to="/" className="btn btn-lepra product-detail-back-btn">
          <ArrowLeft size={18} className="me-1" aria-hidden /> Volver al catálogo
        </Link>
      </Container>
    )
  }

  const imageUrl = getImageUrl(product.img) || DEFAULT_IMG

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

  return (
    <Container fluid="sm" className="product-detail px-3 px-sm-4 py-3 py-sm-4 pb-4 pb-sm-5">
      <Link to="/" className="product-detail-back text-dark text-decoration-none">
        <ArrowLeft size={20} className="me-1" aria-hidden /> Volver al catálogo
      </Link>

      <Card className="card-lepra overflow-hidden mt-3">
        <Row className="g-0">
          <Col xs={12} md={5} className="d-md-flex">
            <div
              className="product-detail-image w-100"
              style={{
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              role="img"
              aria-label={product.name}
            />
          </Col>
          <Col xs={12} md={7}>
            <Card.Body className="product-detail-body p-3 p-md-4">
              <h1 className="product-detail-title h3 mb-2">{product.name}</h1>
              {product.brand && <p className="text-muted mb-1">{product.brand}</p>}
              {product.category && <p className="small text-muted mb-0">{product.category}</p>}
              <p className="product-detail-price fw-bold text-dark mt-3 mb-0">
                {formatMoneyWithSymbol(product.price)}
              </p>

              <div className="product-detail-actions mt-3">
                <div className="product-detail-quantity">
                  <span className="product-detail-qty-label text-nowrap">Cantidad</span>
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

                <div className="product-detail-buttons d-flex flex-column flex-sm-row gap-2">
                  <Button
                    className="btn-lepra"
                    onClick={() => addItem(product, quantity)}
                  >
                    <ShoppingCart size={18} className="me-1" aria-hidden /> Agregar al carrito
                  </Button>
                  <Link to="/carrito" className="btn btn-outline-dark">
                    Ver carrito
                  </Link>
                </div>
              </div>

              {product.has_tiered_pricing && product.price_tiers?.length ? (
                <div className="product-detail-tiers mt-3 pt-3 border-top">
                  <p className="small fw-bold mb-2">Precios por volumen</p>
                  <ul className="list-unstyled small mb-0 product-detail-tiers-list">
                    {product.price_tiers
                      .sort((a, b) => a.min_quantity - b.min_quantity)
                      .map((t) => (
                        <li key={t.id} className="py-1">
                          Desde {t.min_quantity} u: {formatMoneyWithSymbol(t.unit_price)}/u
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </Card.Body>
          </Col>
        </Row>
      </Card>
    </Container>
  )
}
