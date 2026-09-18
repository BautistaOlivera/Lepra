import { useMemo, useState } from 'react'
import { Card, Row, Col, ButtonGroup, Button, Badge } from 'react-bootstrap'
import {
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
import type { DashboardPeriodKey, DashboardPeriodStats, DashboardStats, DashboardTopProduct } from '@/types/dashboard'
import { mergeStatusBreakdown, ORDER_STATUS_LABELS, type OrderStatusKey } from '@/lib/orderStatus'
import { CHART, formatMoney, formatMoneyAxis, formatShortDate, pctChange } from './chartTheme'
import { ChartFrame } from '@/components/ChartFrame'
import { isLegacyClient } from '@/lib/legacyBrowser'

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

function periodBundle(stats: DashboardStats, period: DashboardPeriodKey): DashboardPeriodStats {
  const p = stats.periods[period]
  return {
    orders: p.orders,
    revenue: p.revenue,
    previous_orders: p.previous_orders,
    previous_revenue: p.previous_revenue,
    status_breakdown: p.status_breakdown ?? (period === 'day' ? stats.status_breakdown : {}),
    daily_series: p.daily_series ?? (period === 'day' ? stats.daily_series : []),
    top_products: p.top_products ?? (period === 'day' ? stats.top_products : []),
  }
}

export function DashboardCharts({ stats }: Props) {
  const [period, setPeriod] = useState<DashboardPeriodKey>('day')
  const p = useMemo(() => periodBundle(stats, period), [stats, period])
  const animate = !isLegacyClient()
  const periodLabel = PERIOD_LABELS[period]

  const statusData = useMemo(
    () =>
      Object.entries(mergeStatusBreakdown(p.status_breakdown))
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
    [p.status_breakdown]
  )

  const seriesData = useMemo(
    () =>
      p.daily_series.map((d) => {
        if (period === 'day' && d.date.includes('T')) {
          const hour = Number(d.date.slice(11, 13))
          const label = `${hour}h`
          return { ...d, label, fullLabel: `${String(hour).padStart(2, '0')}:00` }
        }
        return {
          ...d,
          label: period === 'month' ? String(Number(d.date.slice(8, 10))) : formatShortDate(d.date),
          fullLabel: formatShortDate(d.date),
        }
      }),
    [p.daily_series, period]
  )

  const topProducts = useMemo(
    () =>
      p.top_products.map((item) => {
        const raw = item as DashboardTopProduct & { quantity?: number }
        return {
          ...item,
          total_kg: Number(item.total_kg) || Number(raw.quantity) || 0,
        }
      }),
    [p.top_products]
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
              <Card.Text className="text-muted small mb-1">Pedidos — {periodLabel}</Card.Text>
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
              <Card.Text className="text-muted small mb-1">Facturación — {periodLabel}</Card.Text>
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
              <Card.Title className="h6 mb-3">
                {period === 'day' ? 'Actividad por hora' : `Actividad (${periodLabel})`}
              </Card.Title>
              {seriesData.length === 0 ? (
                <p className="text-muted small mb-0">Sin pedidos en el período</p>
              ) : (
                <ChartFrame height={280}>
                    <ComposedChart data={seriesData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: CHART.gray, fontSize: period === 'month' || period === 'day' ? 10 : 11 }}
                        interval={period === 'month' ? 0 : period === 'day' ? 1 : 'preserveStartEnd'}
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
                        labelFormatter={(_label, payload) => {
                          const row = payload?.[0]?.payload as { fullLabel?: string } | undefined
                          return row?.fullLabel ?? String(_label ?? '')
                        }}
                        formatter={(value, name) =>
                          String(name).toLowerCase().includes('factur') || name === 'revenue'
                            ? formatMoney(Number(value))
                            : String(value ?? '')
                        }
                      />
                      <Legend />
                      <Bar yAxisId="orders" dataKey="orders" name="Pedidos" fill={CHART.black} radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={animate} />
                      <Line
                        yAxisId="revenue"
                        type="monotone"
                        dataKey="revenue"
                        name="Facturación"
                        stroke={CHART.yellow}
                        strokeWidth={2}
                        dot={period === 'day' ? { r: 2 } : false}
                        isAnimationActive={animate}
                      />
                    </ComposedChart>
                </ChartFrame>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="card-lepra border-0 shadow-sm h-100">
            <Card.Body>
              <Card.Title className="h6 mb-3">Estado de pedidos ({periodLabel})</Card.Title>
              {statusData.length === 0 ? (
                <p className="text-muted small mb-0">Sin pedidos en el período</p>
              ) : (
                <ChartFrame height={280}>
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
                        isAnimationActive={animate}
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                </ChartFrame>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12}>
          <Card className="card-lepra border-0 shadow-sm">
            <Card.Body>
              <Card.Title className="h6 mb-3">Top productos ({periodLabel})</Card.Title>
              {topProducts.length === 0 ? (
                <p className="text-muted small mb-0">
                  Sin datos de líneas de pedido en el período. Sincronizá o abrí Pedidos con conexión para completar el catálogo local.
                </p>
              ) : (
                <ChartFrame height={Math.max(160, topProducts.length * 48)}>
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
                      <Tooltip formatter={(value) => [`${value ?? 0} kg`, 'Peso']} />
                      <Bar dataKey="total_kg" name="Peso (kg)" fill={CHART.yellow} radius={[0, 4, 4, 0]} isAnimationActive={animate} />
                    </BarChart>
                </ChartFrame>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  )
}
