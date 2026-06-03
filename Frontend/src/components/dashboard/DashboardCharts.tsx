import { useMemo, useState } from 'react'
import { Card, Row, Col, ButtonGroup, Button, Badge } from 'react-bootstrap'
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
import type { DashboardPeriodKey, DashboardStats } from '@/types/dashboard'
import { mergeStatusBreakdown, ORDER_STATUS_LABELS, type OrderStatusKey } from '@/lib/orderStatus'
import { CHART, formatMoney, formatMoneyAxis, formatShortDate, pctChange } from './chartTheme'

const PERIOD_LABELS: Record<DashboardPeriodKey, string> = {
  day: 'Hoy',
  week: '7 días',
  month: 'Mes',
}

const STATUS_COLORS: Record<OrderStatusKey, string> = {
  PENDING: CHART.pending,
  FULFILLED: CHART.fulfilled,
  CANCELED: CHART.canceled,
}

type Props = {
  stats: DashboardStats
}

export function DashboardCharts({ stats }: Props) {
  const [period, setPeriod] = useState<DashboardPeriodKey>('week')
  const p = stats.periods[period]

  const statusData = useMemo(
    () =>
      Object.entries(mergeStatusBreakdown(stats.status_breakdown))
        .filter(([, v]) => v > 0)
        .map(([key, value]) => {
          const k = key as OrderStatusKey
          return {
            key: k,
            name: ORDER_STATUS_LABELS[k],
            value,
            fill: STATUS_COLORS[k],
          }
        }),
    [stats.status_breakdown]
  )

  const seriesData = useMemo(
    () =>
      stats.daily_series.map((d) => ({
        ...d,
        label: formatShortDate(d.date),
      })),
    [stats.daily_series]
  )

  const ordersDelta = pctChange(p.orders, p.previous_orders)
  const revenueDelta = pctChange(p.revenue, p.previous_revenue)

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <ButtonGroup size="sm">
          {(Object.keys(PERIOD_LABELS) as DashboardPeriodKey[]).map((key) => (
            <Button
              key={key}
              variant={period === key ? 'dark' : 'outline-dark'}
              onClick={() => setPeriod(key)}
            >
              {PERIOD_LABELS[key]}
            </Button>
          ))}
        </ButtonGroup>
        {stats.source === 'local' && (
          <Badge bg="secondary" className="fw-normal">
            Datos locales (última sincronización)
          </Badge>
        )}
      </div>

      <Row className="g-4 mb-4">
        <Col md={6}>
          <Card className="card-lepra border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Text className="text-muted small mb-1">Pedidos — {PERIOD_LABELS[period]}</Card.Text>
              <div className="d-flex align-items-baseline gap-2">
                <Card.Title className="mb-0 display-6">{p.orders}</Card.Title>
                {ordersDelta != null && (
                  <span className={`small ${ordersDelta >= 0 ? 'text-success' : 'text-danger'}`}>
                    {ordersDelta >= 0 ? '+' : ''}
                    {ordersDelta}% vs anterior
                  </span>
                )}
              </div>
              <Card.Text className="text-muted small mb-0 mt-1">
                Período anterior: {p.previous_orders}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="card-lepra border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Text className="text-muted small mb-1">Facturación — {PERIOD_LABELS[period]}</Card.Text>
              <div className="d-flex align-items-baseline gap-2">
                <Card.Title className="mb-0 h3">{formatMoney(p.revenue)}</Card.Title>
                {revenueDelta != null && (
                  <span className={`small ${revenueDelta >= 0 ? 'text-success' : 'text-danger'}`}>
                    {revenueDelta >= 0 ? '+' : ''}
                    {revenueDelta}% vs anterior
                  </span>
                )}
              </div>
              <Card.Text className="text-muted small mb-0 mt-1">
                Período anterior: {formatMoney(p.previous_revenue)}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={8}>
          <Card className="card-lepra border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Title className="h6 mb-3">Actividad (últimos 30 días)</Card.Title>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <ComposedChart data={seriesData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: CHART.gray, fontSize: 11 }} interval="preserveStartEnd" />
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
                    <Bar yAxisId="orders" dataKey="orders" name="Pedidos" fill={CHART.black} radius={[4, 4, 0, 0]} />
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
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="card-lepra border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Title className="h6 mb-3">Estado de pedidos</Card.Title>
              {statusData.length === 0 ? (
                <p className="text-muted small mb-0">Sin pedidos</p>
              ) : (
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
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
              <Card.Title className="h6 mb-3">Top productos (30 días)</Card.Title>
              {stats.top_products.length === 0 ? (
                <p className="text-muted small mb-0">
                  Sin datos de líneas de pedido. Sincronizá o abrí Pedidos con conexión para completar el catálogo local.
                </p>
              ) : (
                <div style={{ width: '100%', height: Math.max(160, stats.top_products.length * 48) }}>
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={stats.top_products}
                      margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: CHART.gray, fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
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
