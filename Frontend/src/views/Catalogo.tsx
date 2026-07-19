import { useState, useEffect, useCallback } from 'react'
import { Container, Row, Col, Card, Form } from 'react-bootstrap'
import { LoadingCenter } from '@/components/LoadingOverlay'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { getProductsPaginated } from '@/api/product'
import { Product } from '@/types'
import { useCart } from '@/context/CartContext'
import { ProductImage } from '@/components/ProductImage'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { formatWeight, hasWeight } from '@/lib/formatWeight'
import toast from 'react-hot-toast'

const CHEESE_HERO = 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=1200&q=80'

const CATALOG_CATEGORIES = [
  { value: 'Lacteos', label: 'Lácteos' },
  { value: 'Embutidos', label: 'Embutidos' },
] as const

export function Catalogo() {
  const { addItem } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>('Lacteos')
  const [nextCursor, setNextCursor] = useState<number | null>(null)

  const loadProducts = useCallback(async (lastId?: number) => {
    setLoading(true)
    const filters: Record<string, string> = {}
    if (search.trim()) filters.search = search.trim()
    if (categoryFilter) filters.category = categoryFilter
    const { data, error } = await getProductsPaginated({
      limit: 20,
      last_seen_id: lastId ?? null,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    })
    if (error && !lastId) {
      toast.error(error.message || 'No se pudo cargar el catálogo')
    }
    if (data) {
      setProducts((prev) => (lastId ? [...prev, ...data.items] : data.items))
      setNextCursor(data.next_cursor)
    }
    setLoading(false)
  }, [search, categoryFilter])

  useEffect(() => {
    loadProducts()
  }, [categoryFilter, loadProducts])

  function toggleCategory(value: string) {
    setCategoryFilter((prev) => (prev === value ? null : value))
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadProducts()
  }

  return (
    <>
      <div
        className="bg-lepra-hero catalog-hero rounded-bottom-3"
        style={{ backgroundImage: `url(${CHEESE_HERO})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="bg-dark bg-opacity-50 catalog-hero-overlay rounded-bottom-3">
          <Container fluid="sm" className="px-3 px-sm-4">
            <h1 className="text-white catalog-hero-title fw-bold mb-2">Catálogo El Lepra</h1>
            <p className="text-white-50 catalog-hero-subtitle mb-3 mb-sm-4">Quesos y lácteos de calidad</p>
            <Form className="d-flex gap-2 catalog-search-form" onSubmit={handleSearch}>
              <Form.Control
                type="search"
                placeholder="Buscar productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 flex-grow-1"
                aria-label="Buscar productos"
              />
              <button type="submit" className="btn btn-lepra px-4">Buscar</button>
            </Form>
            <div className="catalog-category-filters d-flex gap-2" role="group" aria-label="Filtrar por categoría">
              {CATALOG_CATEGORIES.map(({ value, label }) => {
                const active = categoryFilter === value
                return (
                  <button
                    key={value}
                    type="button"
                    className={
                      active
                        ? 'btn btn-lepra catalog-category-btn catalog-category-btn--active'
                        : 'btn catalog-category-btn catalog-category-btn--inactive'
                    }
                    aria-pressed={active}
                    onClick={(e) => {
                      toggleCategory(value)
                      e.currentTarget.blur()
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </Container>
        </div>
      </div>

      <Container fluid="sm" className="catalog-products px-3 px-sm-4 pb-4 pb-sm-5">
        {loading && products.length === 0 ? (
          <LoadingCenter message="Cargando catálogo..." />
        ) : (
          <Row xs={1} sm={2} lg={3} xl={4} className="g-3 g-sm-4">
            {products.map((p) => (
              <Col key={p.id}>
                <Card className="card-lepra h-100 overflow-hidden">
                  <ProductImage
                    src={p.img}
                    alt={p.name}
                    category={p.category}
                    variant="card"
                    linkTo={`/producto/${p.id}`}
                  />
                  <Card.Body className="d-flex flex-column">
                    <Card.Title className="text-truncate mb-1">{p.name}</Card.Title>
                    {p.brand && <Card.Text className="small text-muted mb-0">{p.brand}</Card.Text>}
                    {hasWeight(p.weight) && (
                      <Card.Text className="small text-muted mb-0">{formatWeight(p.weight)}</Card.Text>
                    )}
                    <div className="d-flex justify-content-between align-items-center gap-2 mt-auto pt-2 flex-wrap catalog-card-actions">
                      <span className="fw-bold text-dark catalog-card-price">
                        {formatMoneyWithSymbol(p.price)}
                        {!p.fixed_weight && '/kg'}
                      </span>
                      <div className="d-flex gap-2 catalog-card-buttons">
                        <Link to={`/producto/${p.id}`} className="btn btn-sm btn-outline-dark">
                          Ver
                        </Link>
                        <button
                          type="button"
                          className="btn btn-sm btn-lepra"
                          onClick={() => addItem(p)}
                        >
                          <Plus size={14} className="me-1" aria-hidden /> Agregar
                        </button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
        {nextCursor && (
          <div className="text-center mt-4">
            <button
              type="button"
              className="btn btn-outline-dark catalog-load-more"
              onClick={() => loadProducts(nextCursor)}
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Cargar más'}
            </button>
          </div>
        )}
      </Container>
    </>
  )
}
