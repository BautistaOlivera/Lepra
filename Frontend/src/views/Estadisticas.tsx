import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Alert, Badge, ButtonGroup, Button, Form, InputGroup } from 'react-bootstrap'
import { Calendar, BarChart3, LayoutDashboard, Table2 } from 'lucide-react'
import { LoadingCenter } from '@/components/LoadingOverlay'
import { DateInputAr } from '@/components/DateInputAr'
import { Select } from '@/components/Select'
import { AdminFilterResetButton } from '@/components/AdminFilterResetButton'
import { AdminPageHero } from '@/components/AdminPageHero'
import { EstadisticasCharts } from '@/components/estadisticas/EstadisticasCharts'
import { SalesProductTable } from '@/components/estadisticas/SalesMatrixTable'
import { SalesPlanillaTable } from '@/components/estadisticas/SalesPlanillaTable'
import { defaultSalesDateRange } from '@/lib/salesStatsAggregate'
import { defaultRangeForGranularity, periodStart, periodEnd } from '@/lib/salesPeriodRange'
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

type StatsViewMode = 'charts' | 'data'

const VIEW_OPTIONS: { key: StatsViewMode; label: string; Icon: typeof LayoutDashboard }[] = [
  { key: 'charts', label: 'Gráficos', Icon: LayoutDashboard },
  { key: 'data', label: 'Datos', Icon: Table2 },
]

export function Estadisticas() {
  const online = useOnlineStatus()
  const defaults = defaultSalesDateRange()

  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo, setDateTo] = useState(defaults.to)
  const [productId, setProductId] = useState<number | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [granularity, setGranularity] = useState<SalesGranularity>('day')
  const [viewMode, setViewMode] = useState<StatsViewMode>('charts')

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

  // Evita que una respuesta vieja pise a una más nueva al cambiar filtros rápido.
  const requestSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError(null)
    const res = await getSalesStatsHybrid({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      product_id: productId,
      category,
      granularity,
    })
    if (seq !== requestSeq.current) return
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

  /**
   * El agrupamiento funciona como atajo del selector de fechas:
   * al elegirlo se aplica un rango de períodos completos acorde
   * (semanas lunes-domingo, meses/años calendario).
   */
  function applyGranularity(g: SalesGranularity) {
    const r = defaultRangeForGranularity(g)
    setGranularity(g)
    setDateFrom(r.from)
    setDateTo(r.to)
  }

  /** Fechas elegidas a mano se alinean al inicio/fin del período agrupado. */
  function applyDateFrom(iso: string) {
    if (!iso) {
      setDateFrom('')
      return
    }
    const snapped = periodStart(iso, granularity)
    setDateFrom(snapped)
    if (dateTo && snapped > dateTo) {
      setDateTo(periodEnd(iso, granularity))
    }
  }

  function applyDateTo(iso: string) {
    if (!iso) {
      setDateTo('')
      return
    }
    const snapped = periodEnd(iso, granularity)
    setDateTo(snapped)
    if (dateFrom && snapped < dateFrom) {
      setDateFrom(periodStart(iso, granularity))
    }
  }

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
      <AdminPageHero
        end={
          stats.source === 'local' ? (
            <Badge bg="secondary" className="fw-normal">
              Datos locales (última sincronización)
            </Badge>
          ) : null
        }
      >
        <span className="d-inline-flex align-items-center gap-2">
          <BarChart3 size={28} aria-hidden />
          Estadísticas
        </span>
      </AdminPageHero>
      <p className="text-muted mb-3">Análisis detallado de ventas y productos</p>

      <div className="admin-list-toolbar mb-4">
        <div className="admin-list-dates-row">
          <InputGroup className="admin-list-date-field">
            <InputGroup.Text>
              <Calendar size={16} aria-hidden />
            </InputGroup.Text>
            <DateInputAr value={dateFrom} onChange={applyDateFrom} aria-label="Fecha desde" />
          </InputGroup>
          <span className="admin-list-dates-sep" aria-hidden>
            –
          </span>
          <InputGroup className="admin-list-date-field">
            <InputGroup.Text>
              <Calendar size={16} aria-hidden />
            </InputGroup.Text>
            <DateInputAr value={dateTo} onChange={applyDateTo} aria-label="Fecha hasta" />
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

        <div className="admin-list-granularity">
          <Form.Label className="small text-muted mb-1 d-block">Agrupar</Form.Label>
          <ButtonGroup className="admin-list-granularity-group">
            {GRANULARITY_OPTIONS.map(({ key, label }) => (
              <Button
                key={key}
                variant={granularity === key ? 'dark' : 'outline-dark'}
                onClick={() => applyGranularity(key)}
              >
                {label}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3" role="tablist" aria-label="Vista de estadísticas">
        <ButtonGroup>
          {VIEW_OPTIONS.map(({ key, label, Icon }) => (
            <Button
              key={key}
              variant={viewMode === key ? 'dark' : 'outline-dark'}
              onClick={() => setViewMode(key)}
              role="tab"
              aria-selected={viewMode === key}
            >
              <span className="d-inline-flex align-items-center">
                <Icon size={16} className="me-2" aria-hidden />
                <span>{label}</span>
              </span>
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {loading && (
        <p className="text-muted small mb-3" aria-live="polite">
          Actualizando...
        </p>
      )}

      {!loading && error && (
        <Alert variant="warning" className="mb-3">
          {error} — se muestran los últimos datos cargados.
        </Alert>
      )}

      {viewMode === 'charts' ? (
        <EstadisticasCharts stats={stats} />
      ) : (
        <div className="d-flex flex-column gap-4">
          <SalesPlanillaTable stats={stats} products={products} />
          <SalesProductTable rows={stats.by_product} />
        </div>
      )}
    </div>
  )
}
