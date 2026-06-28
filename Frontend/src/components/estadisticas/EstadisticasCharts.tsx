import { useMemo } from 'react'
import { Card, Row, Col } from 'react-bootstrap'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
} from 'recharts'
import type { SalesGranularity, SalesStats } from '@/types/salesStats'
import { CHART, formatMoney, formatMoneyAxis, pctChange } from '@/components/dashboard/chartTheme'

const GRANULARITY_LABELS: Record<SalesGranularity, string> = {
  day: 'Por día',
  week: 'Por semana',
  month: 'Por mes',
  year: 'Por año',
}

function formatPeriodLabel(period: string, granularity: SalesGranularity): string {
  if (granularity === 'year') return period
  if (granularity === 'month') {
    const [y, m] = period.split('-')
    return `${m}/${y}`
  }
  if (granularity === 'week' || granularity === 'day') {
    const [, mo, d] = period.split('-')
    return `${d}/${mo}`
  }
  return period
}

const CATEGORY_COLORS = [
  CHART.yellow,
  CHART.black,
  CHART.fulfilled,
  '#4a90d9',
  '#c45c5c',
  '#8e6abf',
  CHART.canceled,
]

type Props = {
  stats: SalesStats
}

export function EstadisticasCharts({ stats }: Props) {
  const { summary } = stats
  const { granularity } = stats.filters
  const granLabel = GRANULARITY_LABELS[granularity]

  const seriesData = useMemo(
    () =>
      stats.time_series.map((d) => ({
        ...d,
        label: formatPeriodLabel(d.period, granularity),
      })),
    [stats.time_series, granularity]
  )

  const categoryData = useMemo(
    () =>
      stats.by_category.map((c, i) => ({
        name: c.category,
        value: c.revenue,
        fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      })),
    [stats.by_category]
  )

  const topProducts = useMemo(() => stats.by_product.slice(0, 8), [stats.by_product])

  const ordersDelta = pctChange(summary.orders, summary.previous_orders)
  const revenueDelta = pctChange(summary.revenue, summary.previous_revenue)

  return (
    <>
      <Row className="g-4 mb-4">
        <Col sm={6} xl={3}>
          <Card className="card-lepra border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Text className="text-muted small mb-1">Pedidos</Card.Text>
              <div className="d-flex align-items-baseline gap-2">
                <Card.Title className="mb-0 h3">{summary.orders}</Card.Title>
                {ordersDelta != null && (
                  <span className={`small ${ordersDelta >= 0 ? 'text-success' : 'text-danger'}`}>
                    {ordersDelta >= 0 ? '+' : ''}
                    {ordersDelta}%
                  </span>
                )}
              </div>
              <Card.Text className="text-muted small mb-0 mt-1">
                Anterior: {summary.previous_orders}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} xl={3}>
          <Card className="card-lepra border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Text className="text-muted small mb-1">Facturación</Card.Text>
              <div className="d-flex align-items-baseline gap-2">
                <Card.Title className="mb-0 h4">{formatMoney(summary.revenue)}</Card.Title>
                {revenueDelta != null && (
                  <span className={`small ${revenueDelta >= 0 ? 'text-success' : 'text-danger'}`}>
                    {revenueDelta >= 0 ? '+' : ''}
                    {revenueDelta}%
                  </span>
                )}
              </div>
              <Card.Text className="text-muted small mb-0 mt-1">
                Anterior: {formatMoney(summary.previous_revenue)}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} xl={3}>
          <Card className="card-lepra border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Text className="text-muted small mb-1">Unidades vendidas</Card.Text>
              <Card.Title className="mb-0 h3">{summary.quantity}</Card.Title>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} xl={3}>
          <Card className="card-lepra border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Text className="text-muted small mb-1">Ticket promedio</Card.Text>
              <Card.Title className="mb-0 h4">{formatMoney(summary.avg_ticket)}</Card.Title>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4 mb-4">
        <Col lg={8}>
          <Card className="card-lepra border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Title className="h6 mb-3">Evolución de ventas — {granLabel}</Card.Title>
              {seriesData.length === 0 ? (
                <p className="text-muted small mb-0">Sin datos en el período seleccionado</p>
              ) : (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={seriesData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: CHART.gray, fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        yAxisId="orders"
                        allowDecimals={false}
                        tick={{ fill: CHART.gray, fontSize: 11 }}
                        width={32}
                      />
                      <YAxis
                        yAxisId="revenue"
                        orientation="right"
                        tick={{ fill: CHART.gray, fontSize: 11 }}
                        tickFormatter={(v: number) => formatMoneyAxis(v)}
                        width={44}
                      />
                      <Tooltip
                        formatter={(value, name) =>
                          String(name).toLowerCase().includes('factur') || name === 'revenue'
                            ? formatMoney(Number(value))
                            : String(value ?? '')
                        }
                      />
                      <Legend />
                      <Bar
                        yAxisId="orders"
                        dataKey="orders"
                        name="Pedidos"
                        fill={CHART.black}
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="revenue"
                        type="monotone"
                        dataKey="revenue"
                        name="Facturación"
                        stroke={CHART.yellow}
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="card-lepra border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Title className="h6 mb-3">Por categoría</Card.Title>
              {categoryData.length === 0 ? (
                <p className="text-muted small mb-0">Sin datos</p>
              ) : (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {categoryData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatMoney(Number(v))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12}>
          <Card className="card-lepra border-0 shadow-sm">
            <Card.Body>
              <Card.Title className="h6 mb-3">Productos más vendidos</Card.Title>
              {topProducts.length === 0 ? (
                <p className="text-muted small mb-0">Sin datos de productos en el período</p>
              ) : (
                <div style={{ width: '100%', height: Math.max(180, topProducts.length * 44) }}>
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={topProducts}
                      margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: CHART.gray, fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tick={{ fill: CHART.black, fontSize: 12 }}
                      />
                      <Tooltip formatter={(value) => [`${value ?? 0} u.`, 'Cantidad']} />
                      <Bar dataKey="quantity" name="Cantidad" fill={CHART.yellow} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  )
}
