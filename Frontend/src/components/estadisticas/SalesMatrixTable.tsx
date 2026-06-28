import { useMemo } from 'react'
import { Card, Table } from 'react-bootstrap'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import type { SalesProductByCustomer } from '@/types/salesStats'

type Props = {
  rows: SalesProductByCustomer[]
}

export function SalesMatrixTable({ rows }: Props) {
  const customerLabels = useMemo(() => {
    const labels = new Map<string, string>()
    for (const row of rows) {
      for (const c of row.customers) {
        labels.set(c.label, c.label)
      }
    }
    return [...labels.keys()].sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows])

  if (rows.length === 0) {
    return (
      <Card className="card-lepra border-0 shadow-sm">
        <Card.Body>
          <Card.Title className="h6 mb-2">Caudal por producto y cliente</Card.Title>
          <p className="text-muted small mb-0">Sin datos en el período seleccionado</p>
        </Card.Body>
      </Card>
    )
  }

  const grandTotal = rows.reduce((s, r) => s + r.total_quantity, 0)

  return (
    <Card className="card-lepra border-0 shadow-sm">
      <Card.Body className="p-0">
        <div className="p-3 pb-0">
          <Card.Title className="h6 mb-1">Caudal por producto y cliente</Card.Title>
          <Card.Text className="text-muted small mb-0">
            Cantidades vendidas por producto y cliente (estilo caudal de ventas)
          </Card.Text>
        </div>
        <div className="table-responsive estadisticas-matrix-scroll">
          <Table striped bordered hover size="sm" className="mb-0 estadisticas-matrix-table">
            <thead>
              <tr>
                <th className="estadisticas-matrix-sticky-col">Producto</th>
                {customerLabels.map((label) => (
                  <th key={label} className="text-end text-nowrap">
                    {label}
                  </th>
                ))}
                <th className="text-end fw-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const byLabel = new Map(row.customers.map((c) => [c.label, c.quantity]))
                return (
                  <tr key={row.id_product}>
                    <td className="estadisticas-matrix-sticky-col text-nowrap">{row.name}</td>
                    {customerLabels.map((label) => (
                      <td key={label} className="text-end">
                        {byLabel.get(label) ?? ''}
                      </td>
                    ))}
                    <td className="text-end fw-semibold">{row.total_quantity}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="table-secondary">
                <td className="estadisticas-matrix-sticky-col fw-bold">TOTAL</td>
                {customerLabels.map((label) => {
                  const colTotal = rows.reduce((s, row) => {
                    const cell = row.customers.find((c) => c.label === label)
                    return s + (cell?.quantity ?? 0)
                  }, 0)
                  return (
                    <td key={label} className="text-end fw-semibold">
                      {colTotal || ''}
                    </td>
                  )
                })}
                <td className="text-end fw-bold">{grandTotal}</td>
              </tr>
            </tfoot>
          </Table>
        </div>
      </Card.Body>
    </Card>
  )
}

type ProductTableProps = {
  rows: {
    id_product: number
    name: string
    category: string | null
    quantity: number
    revenue: number
    orders: number
  }[]
}

export function SalesProductTable({ rows }: ProductTableProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <Card className="card-lepra border-0 shadow-sm">
      <Card.Body className="p-0">
        <div className="p-3 pb-0">
          <Card.Title className="h6 mb-0">Detalle por producto</Card.Title>
        </div>
        <div className="table-responsive">
          <Table striped hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="text-end">Cantidad</th>
                <th className="text-end">Facturación</th>
                <th className="text-end">Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id_product}>
                  <td>{row.name}</td>
                  <td>{row.category || '-'}</td>
                  <td className="text-end">{row.quantity}</td>
                  <td className="text-end">{formatMoneyWithSymbol(row.revenue)}</td>
                  <td className="text-end">{row.orders}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  )
}
