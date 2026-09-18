import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Alert, Badge, ButtonGroup, Button, Form, InputGroup } from 'react-bootstrap'
import { Calendar, LayoutDashboard, Table2 } from 'lucide-react'
import { LoadingCenter } from '@/components/LoadingOverlay'
import { DateInputAr } from '@/components/DateInputAr'
import { Select } from '@/components/Select'
import { AdminFilterResetButton } from '@/components/AdminFilterResetButton'
import { EstadisticasCharts } from '@/components/estadisticas/EstadisticasCharts'
import { SalesProductTable } from '@/components/estadisticas/SalesMatrixTable'
import { SalesPlanillaTable } from '@/components/estadisticas/SalesPlanillaTable'
import {
  CUSTOM_PERIOD_PRESET_ID,
  CUSTOM_PERIOD_PRESET_LABEL,
  chartPresetsForGranularity,
  defaultChartPeriod,
  defaultChartRangeForGranularity,
  defaultRangeForGranularity,
  defaultSalesPeriod,
  matchChartPreset,
  matchPreset,
  periodEnd,
  periodStart,
  presetsForGranularity,
  rangeForChartPreset,
  rangeForPreset,
  type NamedChartPeriodPresetId,
  type SalesPeriodPresetId,
  type SalesPeriodRange,
} from '@/lib/salesPeriodRange'
import { getSalesStatsHybrid } from '@/repositories/salesStatsRepo'
import { getProductsPaginatedOfflineFirst } from '@/repositories/productsRepo'
import { useOnlineStatus } from '@/offline/network'
import { productDisplayName } from '@/lib/productBrand'
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
  { key: 'data', label: 'Tablas', Icon: Table2 },
  { key: 'charts', label: 'Gráficos', Icon: LayoutDashboard },
]

export function Estadisticas() {
  const online = useOnlineStatus()
  const tableDefaults = defaultSalesPeriod()
  const chartDefaults = defaultChartPeriod()

  const [tablesPeriod, setTablesPeriod] = useState<SalesPeriodRange>(tableDefaults)
  const [chartsPeriod, setChartsPeriod] = useState<SalesPeriodRange>(chartDefaults)
  const [productId, setProductId] = useState<number | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<StatsViewMode>('data')

  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<SalesStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isTables = viewMode === 'data'
  const period = isTables ? tablesPeriod : chartsPeriod
  const dateFrom = period.from
  const dateTo = period.to
  const granularity = period.granularity

  function setActivePeriod(next: SalesPeriodRange) {
    if (isTables) setTablesPeriod(next)
    else setChartsPeriod(next)
  }

  useEffect(() => {
    getProductsPaginatedOfflineFirst({ limit: 500, filters: { active: true } }).then(({ data }) => {
      if (data) setProducts(data.items)
    })
  }, [])

  const productOptions = useMemo(
    () =>
      [...products]
        .sort((a, b) => {
          const byName = a.name.localeCompare(b.name, 'es')
          if (byName !== 0) return byName
          return (a.brand || '').localeCompare(b.brand || '', 'es')
        })
        .map((p) => ({ value: p.id, label: productDisplayName(p.name, p.brand) })),
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

  const matchedTablePreset = matchPreset(dateFrom, dateTo, granularity)
  const matchedChartPreset = matchChartPreset(dateFrom, dateTo, granularity)

  const periodOptions = useMemo(() => {
    if (isTables) {
      const named = presetsForGranularity(granularity).map((p) => ({
        value: p.id as string,
        label: p.label,
      }))
      if (matchedTablePreset === CUSTOM_PERIOD_PRESET_ID) {
        named.push({ value: CUSTOM_PERIOD_PRESET_ID, label: CUSTOM_PERIOD_PRESET_LABEL })
      }
      return named
    }
    const named = chartPresetsForGranularity(granularity).map((p) => ({
      value: p.id as string,
      label: p.label,
    }))
    if (matchedChartPreset === CUSTOM_PERIOD_PRESET_ID) {
      named.push({ value: CUSTOM_PERIOD_PRESET_ID, label: CUSTOM_PERIOD_PRESET_LABEL })
    }
    return named
  }, [isTables, granularity, matchedTablePreset, matchedChartPreset])

  const matchedPreset = isTables ? matchedTablePreset : matchedChartPreset

  /**
   * Tablas: un solo período (Hoy / Esta semana…).
   * Gráficos: un rango de varios buckets para la evolución.
   */
  function applyGranularity(g: SalesGranularity) {
    const r = isTables ? defaultRangeForGranularity(g) : defaultChartRangeForGranularity(g)
    setActivePeriod({ from: r.from, to: r.to, granularity: g })
  }

  function applyPeriodPreset(id: string | null) {
    if (!id || id === CUSTOM_PERIOD_PRESET_ID) return
    if (isTables) {
      const r = rangeForPreset(id as Exclude<SalesPeriodPresetId, 'custom'>)
      setActivePeriod(r)
      return
    }
    const r = rangeForChartPreset(id as NamedChartPeriodPresetId)
    setActivePeriod(r)
  }

  /** Fechas elegidas a mano se alinean al inicio/fin del período agrupado. */
  function applyDateFrom(iso: string) {
    if (!iso) {
      setActivePeriod({ ...period, from: '' })
      return
    }
    const snapped = periodStart(iso, granularity)
    const nextTo = dateTo && snapped > dateTo ? periodEnd(iso, granularity) : dateTo
    setActivePeriod({ from: snapped, to: nextTo, granularity })
  }

  function applyDateTo(iso: string) {
    if (!iso) {
      setActivePeriod({ ...period, to: '' })
      return
    }
    const snapped = periodEnd(iso, granularity)
    const nextFrom = dateFrom && snapped < dateFrom ? periodStart(iso, granularity) : dateFrom
    setActivePeriod({ from: nextFrom, to: snapped, granularity })
  }

  function clearFilters() {
    setProductId(null)
    setCategory(null)
    if (isTables) setTablesPeriod(defaultSalesPeriod())
    else setChartsPeriod(defaultChartPeriod())
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
    <div className="admin-list-page estadisticas-page">
      <div className="admin-list-toolbar estadisticas-toolbar-sticky mb-4">
        <div className="estadisticas-view-tabs" role="tablist" aria-label="Vista de estadísticas">
          <ButtonGroup className="estadisticas-view-mode-group">
            {VIEW_OPTIONS.map(({ key, label, Icon }) => (
              <Button
                key={key}
                variant={viewMode === key ? 'dark' : 'outline-dark'}
                active={viewMode === key}
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
          <div className="admin-list-period-type">
            <ButtonGroup className="admin-list-granularity-group" aria-label={isTables ? 'Tipo' : 'Agrupar'}>
              {GRANULARITY_OPTIONS.map(({ key, label }) => (
                <Button
                  key={key}
                  variant={granularity === key ? 'dark' : 'outline-dark'}
                  active={granularity === key}
                  onClick={() => applyGranularity(key)}
                >
                  {label}
                </Button>
              ))}
            </ButtonGroup>
          </div>
          <div className="admin-list-period-select">
            <Select<string>
              options={periodOptions}
              value={matchedPreset}
              onChange={applyPeriodPreset}
              placeholder={isTables ? 'Período' : 'Rango'}
              isSearchable={false}
            />
          </div>
          {stats.source === 'local' ? (
            <Badge bg="secondary" className="fw-normal estadisticas-view-tabs-badge">
              Datos locales (última sincronización)
            </Badge>
          ) : null}
        </div>

        <div className="estadisticas-filters-line">
          <div className="admin-list-dates-row">
            <div className="admin-list-date-labeled">
              <Form.Label className="small text-muted mb-1">Desde</Form.Label>
              <InputGroup className="admin-list-date-field">
                <InputGroup.Text>
                  <Calendar size={16} aria-hidden />
                </InputGroup.Text>
                <DateInputAr value={dateFrom} onChange={applyDateFrom} aria-label="Fecha desde" />
              </InputGroup>
            </div>
            <span className="admin-list-dates-sep" aria-hidden>
              –
            </span>
            <div className="admin-list-date-labeled">
              <Form.Label className="small text-muted mb-1">Hasta</Form.Label>
              <InputGroup className="admin-list-date-field">
                <InputGroup.Text>
                  <Calendar size={16} aria-hidden />
                </InputGroup.Text>
                <DateInputAr value={dateTo} onChange={applyDateTo} aria-label="Fecha hasta" />
              </InputGroup>
            </div>
          </div>

          <div className="admin-list-filter">
            <Form.Label className="small text-muted mb-1">Producto</Form.Label>
            <Select
              options={productOptions}
              value={productId ?? ''}
              onChange={(v) => setProductId(v)}
              placeholder="Todos los productos"
              isClearable
            />
          </div>
          <div className="admin-list-filter">
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
        <div className="estadisticas-tables d-flex flex-column gap-4">
          <SalesPlanillaTable stats={stats} products={products} />
          <SalesProductTable rows={stats.by_product} />
        </div>
      )}
    </div>
  )
}
