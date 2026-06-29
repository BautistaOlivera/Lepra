import { useState, useEffect, useCallback, useMemo } from 'react'
import { Alert, Badge, ButtonGroup, Button, Form, InputGroup } from 'react-bootstrap'
import { Calendar, BarChart3 } from 'lucide-react'
import { LoadingCenter } from '@/components/LoadingOverlay'
import { DateInputAr } from '@/components/DateInputAr'
import { Select } from '@/components/Select'
import { AdminFilterResetButton } from '@/components/AdminFilterResetButton'
import { EstadisticasCharts } from '@/components/estadisticas/EstadisticasCharts'
import { SalesMatrixTable, SalesProductTable } from '@/components/estadisticas/SalesMatrixTable'
import { defaultSalesDateRange } from '@/lib/salesStatsAggregate'
import { getSalesStatsHybrid } from '@/repositories/salesStatsRepo'
import { getProductsPaginatedOfflineFirst } from '@/repositories/productsRepo'
import { useOnlineStatus } from '@/offline/network'
import type { Product } from '@/types'
import type { SalesGranularity, SalesStats } from '@/types/salesStats'

const GRANULARITY_OPTIONS: { key: SalesGranularity; label: string }[] = [
  { key: 'day', label: 'Día' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
]

export function Estadisticas() {
  const online = useOnlineStatus()
  const defaults = defaultSalesDateRange()

  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [productId, setProductId] = useState<number | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [granularity, setGranularity] = useState<SalesGranularity>('day')

  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<SalesStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getProductsPaginatedOfflineFirst({ limit: 500, filters: { active: true } }).then(({ data }) => {
      if (data) setProducts(data.items)
    })
  }, [])

  const productOptions = useMemo(
    () =>
      [...products]
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((p) => ({ value: p.id, label: p.name })),
    [products]
  )

  const categoryOptions = useMemo(() => {
    const cats = new Set<string>()
    for (const p of products) {
      if (p.category?.trim()) cats.add(p.category.trim())
    }
    return [...cats].sort((a, b) => a.localeCompare(b, 'es')).map((c) => ({ value: c, label: c }))
  }, [products])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await getSalesStatsHybrid({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      product_id: productId,
      category,
      granularity,
    })
    if (res.data) {
      setStats(res.data)
    } else {
      setError(res.error?.message ?? 'No se pudieron cargar las estadísticas')
    }
    setLoading(false)
  }, [dateFrom, dateTo, productId, category, granularity])

  useEffect(() => {
    load()
  }, [load, online])

  function clearFilters() {
    const d = defaultSalesDateRange()
    setDateFrom(d.from)
    setDateTo(d.to)
    setProductId(null)
    setCategory(null)
    setGranularity('day')
  }

  if (loading && !stats) {
    return <LoadingCenter message="Cargando estadísticas..." />
  }

  if (error && !stats) {
    return <Alert variant="danger">{error}</Alert>
  }

  if (!stats) {
    return <Alert variant="danger">Error desconocido</Alert>
  }

  return (
    <div className="admin-list-page">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
        <div>
          <h1 className="admin-list-title h3 text-dark mb-1 d-flex align-items-center gap-2">
            <BarChart3 size={28} aria-hidden />
            Estadísticas
          </h1>
          <p className="text-muted mb-0">Análisis detallado de ventas y productos</p>
        </div>
        {stats.source === 'local' && (
          <Badge bg="secondary" className="fw-normal align-self-start">
            Datos locales (última sincronización)
          </Badge>
        )}
      </div>

      <div className="admin-list-toolbar mb-4">
        <div className="admin-list-dates-row">
          <InputGroup className="admin-list-date-field">
            <InputGroup.Text>
              <Calendar size={16} aria-hidden />
            </InputGroup.Text>
            <DateInputAr value={dateFrom} onChange={setDateFrom} aria-label="Fecha desde" />
          </InputGroup>
          <span className="admin-list-dates-sep" aria-hidden>
            –
          </span>
          <InputGroup className="admin-list-date-field">
            <InputGroup.Text>
              <Calendar size={16} aria-hidden />
            </InputGroup.Text>
            <DateInputAr value={dateTo} onChange={setDateTo} aria-label="Fecha hasta" />
          </InputGroup>
        </div>

        <div className="admin-list-filters-row">
          <div className="admin-list-filter admin-list-filter-wide">
            <Form.Label className="small text-muted mb-1">Producto</Form.Label>
            <Select
              options={productOptions}
              value={productId ?? ''}
              onChange={(v) => setProductId(v)}
              placeholder="Todos los productos"
              isClearable
            />
          </div>
          <div className="admin-list-filter admin-list-filter-wide">
            <Form.Label className="small text-muted mb-1">Categoría</Form.Label>
            <Select<string>
              options={categoryOptions}
              value={category ?? ''}
              onChange={(v) => setCategory(v)}
              placeholder="Todas las categorías"
              isClearable
            />
          </div>
          <AdminFilterResetButton onClick={clearFilters} />
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
          <span className="small text-muted me-1">Agrupar:</span>
          <ButtonGroup size="sm">
            {GRANULARITY_OPTIONS.map(({ key, label }) => (
              <Button
                key={key}
                variant={granularity === key ? 'dark' : 'outline-dark'}
                onClick={() => setGranularity(key)}
              >
                {label}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      </div>

      {loading && (
        <p className="text-muted small mb-3" aria-live="polite">
          Actualizando...
        </p>
      )}

      <EstadisticasCharts stats={stats} />

      <div className="d-flex flex-column gap-4 mt-4">
        <SalesMatrixTable rows={stats.product_by_customer} />
        <SalesProductTable rows={stats.by_product} />
      </div>
    </div>
  )
}
