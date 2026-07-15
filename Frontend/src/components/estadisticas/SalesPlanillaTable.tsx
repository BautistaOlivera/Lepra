import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, ButtonGroup, Card, Table } from 'react-bootstrap'
import type { Product } from '@/types'
import type { SalesGranularity, SalesPlanilla, SalesStats } from '@/types/salesStats'

type PlanillaMode = 'customer' | 'period'

type Props = {
  stats: SalesStats
  products: Product[]
}

function formatPeriodLabel(period: string, granularity: SalesGranularity): string {
  if (granularity === 'year') return period
  if (granularity === 'month') {
    const [y, m] = period.split('-')
    const months = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ]
    const idx = Number(m) - 1
    return months[idx] ? `${months[idx]} ${y}` : `${m}/${y}`
  }
  if (granularity === 'week' || granularity === 'day') {
    const [, mo, d] = period.split('-')
    if (d && mo) return `${d}/${mo}`
  }
  return period
}

function formatQty(n: number): string {
  if (!n) return ''
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 1000) / 1000)
}

function emptyPlanilla(): SalesPlanilla {
  return {
    customers: [],
    customer_keys: [],
    products: [],
    period_keys: [],
    blocks: [],
    by_period: [],
    period_totals: [],
    grand_total: 0,
  }
}

/** Completa filas con productos activos del catálogo (aunque no hayan vendido). */
function mergeCatalogProducts(planilla: SalesPlanilla, products: Product[]): SalesPlanilla {
  const known = new Set(planilla.products.map((p) => p.id_product))
  const extras = products
    .filter((p) => p.active !== false && !known.has(p.id))
    .map((p) => ({
      id_product: p.id,
      name: p.name,
      category: p.category ?? null,
      sold_by_piece: !!p.fixed_weight,
      unit: p.fixed_weight ? 'u.' : 'kg',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  if (extras.length === 0) return planilla

  const allProducts = [...planilla.products, ...extras].sort((a, b) =>
    a.name.localeCompare(b.name, 'es')
  )
  const nCust = planilla.customers.length
  const nPeriods = planilla.period_keys.length
  const zeroCust = Array(nCust).fill(0) as number[]
  const zeroPeriods = Array(nPeriods).fill(0) as number[]

  return {
    ...planilla,
    products: allProducts,
    blocks: planilla.blocks.map((block) => {
      const byId = new Map(block.rows.map((r) => [r.id_product, r]))
      return {
        ...block,
        rows: allProducts.map(
          (p) =>
            byId.get(p.id_product) ?? {
              id_product: p.id_product,
              name: p.name,
              unit: p.unit,
              sold_by_piece: p.sold_by_piece,
              qtys: zeroCust.slice(),
              total: 0,
            }
        ),
      }
    }),
    by_period: allProducts.map((p) => {
      const existing = planilla.by_period.find((r) => r.id_product === p.id_product)
      return (
        existing ?? {
          id_product: p.id_product,
          name: p.name,
          unit: p.unit,
          sold_by_piece: p.sold_by_piece,
          values: zeroPeriods.slice(),
          total: 0,
        }
      )
    }),
  }
}

export function SalesPlanillaTable({ stats, products }: Props) {
  const [mode, setMode] = useState<PlanillaMode>('customer')
  const granularity = stats.filters.granularity

  const planilla = useMemo(() => {
    const base = stats.planilla ?? emptyPlanilla()
    return mergeCatalogProducts(base, products)
  }, [stats.planilla, products])

  const hasData = planilla.blocks.length > 0 || planilla.by_period.some((r) => r.total > 0)

  // En "Por período" arrancar con el scroll a la derecha: el último dato primero.
  const periodScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = periodScrollRef.current
    if (mode === 'period' && el) {
      el.scrollLeft = el.scrollWidth
    }
  }, [mode, planilla])

  return (
    <Card className="card-lepra border-0 shadow-sm">
      <Card.Body className="p-0">
        <div className="p-3 pb-2 d-flex flex-wrap align-items-start justify-content-between gap-2">
          <div>
            <Card.Title className="h6 mb-1">Planilla de caudal</Card.Title>
            <Card.Text className="text-muted small mb-0">
              Cantidades por producto (kg o u. según el producto). Usá el agrupamiento de arriba
              para ver por día, semana, mes o año.
            </Card.Text>
          </div>
          <ButtonGroup size="sm">
            <Button
              variant={mode === 'customer' ? 'dark' : 'outline-dark'}
              onClick={() => setMode('customer')}
            >
              Por cliente
            </Button>
            <Button
              variant={mode === 'period' ? 'dark' : 'outline-dark'}
              onClick={() => setMode('period')}
            >
              Por período
            </Button>
          </ButtonGroup>
        </div>

        {!hasData ? (
          <p className="text-muted small px-3 pb-3 mb-0">Sin datos en el período seleccionado</p>
        ) : mode === 'customer' ? (
          <div className="px-0 pb-3">
            {planilla.blocks.map((block) => (
              <div key={block.period} className="mb-3">
                <div className="px-3 py-1 small fw-semibold bg-light border-top border-bottom">
                  {formatPeriodLabel(block.period, granularity)}
                </div>
                <div className="table-responsive estadisticas-matrix-scroll">
                  <Table
                    bordered
                    size="sm"
                    className="mb-0 estadisticas-matrix-table estadisticas-planilla-table"
                  >
                    <thead>
                      <tr>
                        <th className="estadisticas-matrix-sticky-col">Producto</th>
                        {planilla.customers.map((label) => (
                          <th key={label} className="text-end text-nowrap">
                            {label}
                          </th>
                        ))}
                        <th className="text-end fw-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row) => (
                        <tr key={row.id_product}>
                          <td className="estadisticas-matrix-sticky-col text-nowrap">
                            {row.name}{' '}
                            <span className="text-muted small">({row.unit})</span>
                          </td>
                          {row.qtys.map((q, i) => (
                            <td key={i} className="text-end">
                              {formatQty(q)}
                            </td>
                          ))}
                          <td className="text-end fw-semibold">{formatQty(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="table-secondary">
                        <td className="estadisticas-matrix-sticky-col fw-bold">TOTAL</td>
                        {block.customer_totals.map((t, i) => (
                          <td key={i} className="text-end fw-semibold">
                            {formatQty(t)}
                          </td>
                        ))}
                        <td className="text-end fw-bold">{formatQty(block.grand_total)}</td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div ref={periodScrollRef} className="table-responsive estadisticas-matrix-scroll mb-3">
            <Table
              bordered
              size="sm"
              className="mb-0 estadisticas-matrix-table estadisticas-planilla-table"
            >
              <thead>
                <tr>
                  <th className="estadisticas-matrix-sticky-col">Producto</th>
                  {planilla.period_keys.map((p) => (
                    <th key={p} className="text-end text-nowrap">
                      {formatPeriodLabel(p, granularity)}
                    </th>
                  ))}
                  <th className="text-end fw-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {planilla.by_period.map((row) => (
                  <tr key={row.id_product}>
                    <td className="estadisticas-matrix-sticky-col text-nowrap">
                      {row.name} <span className="text-muted small">({row.unit})</span>
                    </td>
                    {row.values.map((v, i) => (
                      <td key={i} className="text-end">
                        {formatQty(v)}
                      </td>
                    ))}
                    <td className="text-end fw-semibold">{formatQty(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="table-secondary">
                  <td className="estadisticas-matrix-sticky-col fw-bold">TOTAL</td>
                  {planilla.period_totals.map((t, i) => (
                    <td key={i} className="text-end fw-semibold">
                      {formatQty(t)}
                    </td>
                  ))}
                  <td className="text-end fw-bold">{formatQty(planilla.grand_total)}</td>
                </tr>
              </tfoot>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
