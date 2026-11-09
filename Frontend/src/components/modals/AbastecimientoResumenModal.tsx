import { Modal, Table } from 'react-bootstrap'
import { LepraModal, ModalDismissButton } from '@/components/LepraModal'
import type { Purchase } from '@/types'
import { formatDateFromApi } from '@/lib/formatDate'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { formatWeight } from '@/lib/formatWeight'
import { productDisplayName } from '@/lib/productBrand'
import { lineAmount } from '@/lib/purchaseTotals'

function formatPricePerKg(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const negative = value < 0
  const [intRaw, frac = ''] = Math.abs(value).toFixed(6).replace(/\.?0+$/, '').split('.')
  const intGrouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const body = frac ? `${intGrouped},${frac}` : intGrouped
  return `${negative ? '-' : ''}$${body}`
}

export function AbastecimientoResumenModal({
  show,
  purchase,
  onClose,
}: {
  show: boolean
  purchase: Purchase | null
  onClose: () => void
}) {
  const lines = purchase?.lines ?? []

  return (
    <LepraModal show={show} onClose={onClose} confirmClose={false} centered>
      <Modal.Header closeButton>
        <Modal.Title>Resumen</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {purchase && (
          <>
            <div className="mb-3">
              <div className="fw-semibold">{purchase.supplier_name || 'Proveedor'}</div>
              <div className="text-muted small">{formatDateFromApi(purchase.date)}</div>
              {purchase.note ? <div className="small mt-1">{purchase.note}</div> : null}
            </div>
            {lines.length === 0 ? (
              <p className="text-muted mb-0">Sin productos.</p>
            ) : (
              <div className="table-lepra-wrap">
                <Table size="sm" className="table-lepra mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="text-end">Kilos</th>
                      <th className="text-end">Precio / kg</th>
                      <th className="text-end">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.id ?? index}>
                        <td>{productDisplayName(line.product_name || 'Producto', line.product_brand)}</td>
                        <td className="text-end text-nowrap">{formatWeight(line.weight)}</td>
                        <td className="text-end text-nowrap">{formatPricePerKg(line.price_per_kg)}</td>
                        <td className="text-end text-nowrap">
                          {formatMoneyWithSymbol(line.amount ?? lineAmount(line.weight, line.price_per_kg))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
            <div className="mt-3">
              {purchase.unitemized_amount > 0 && (
                <div className="d-flex justify-content-between gap-3">
                  <span>Importe sin detallar</span>
                  <span>{formatMoneyWithSymbol(purchase.unitemized_amount)}</span>
                </div>
              )}
              <div className="d-flex justify-content-between gap-3 fw-semibold">
                <span>Total</span>
                <span>{formatMoneyWithSymbol(purchase.total)}</span>
              </div>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <ModalDismissButton>Cerrar</ModalDismissButton>
      </Modal.Footer>
    </LepraModal>
  )
}
