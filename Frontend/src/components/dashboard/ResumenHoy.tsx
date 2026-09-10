import { Card, Col, Row } from 'react-bootstrap'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { isoDateToDisplay } from '@/lib/formatDate'
import type { DashboardTodayCash } from '@/types/dashboard'

type Props = {
  cash: DashboardTodayCash
}

const METHOD_ITEMS: { key: keyof Pick<DashboardTodayCash, 'efectivo' | 'transferencia' | 'cheque' | 'otro'>; label: string }[] = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'otro', label: 'Otro' },
]

export function ResumenHoy({ cash }: Props) {
  if (!cash) return null

  return (
    <Card className="card-lepra border-0 shadow-sm mb-4">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-baseline gap-2 mb-3">
          <Card.Title className="h6 mb-0">Resumen de hoy</Card.Title>
          <span className="text-muted small">{isoDateToDisplay(cash.date)}</span>
        </div>
        <Row className="g-3 resumen-hoy-grid">
          {METHOD_ITEMS.map((item) => (
            <Col xs={6} lg key={item.key}>
              <div className="text-muted small mb-1">{item.label}</div>
              <div className="resumen-hoy-value">{formatMoneyWithSymbol(cash[item.key])}</div>
            </Col>
          ))}
          <Col xs={12} lg className="resumen-hoy-owed">
            <div className="text-muted small mb-1">Se debe</div>
            <div className="resumen-hoy-value">{formatMoneyWithSymbol(cash.owed)}</div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  )
}
