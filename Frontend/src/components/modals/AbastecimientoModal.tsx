import { useEffect, useMemo, useState } from 'react'
import { Modal, Form, Button } from 'react-bootstrap'
import { Plus, Trash2 } from 'lucide-react'
import { LepraModal, ModalDismissButton } from '@/components/LepraModal'
import { ModalBusyFrame } from '@/components/LoadingOverlay'
import { DecimalInput } from '@/components/DecimalInput'
import { Select } from '@/components/Select'
import { ProductoModal } from '@/components/modals/ProductoModal'
import { createPurchase, updatePurchase, type PurchaseWrite } from '@/api/purchase'
import { getProductsPaginatedOfflineFirst } from '@/repositories/productsRepo'
import type { Product, Purchase, Supplier } from '@/types'
import toast from 'react-hot-toast'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { nextTempId } from '@/offline/ids'
import { pickerDateToIso } from '@/lib/formatDate'
import { parseWeightInput } from '@/lib/formatWeight'
import { parseUnitPriceInput } from '@/lib/productTiers'
import { productDisplayName } from '@/lib/productBrand'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import {
  formatAmountDraft,
  formatUnitDraft,
  lineAmount,
  parsePurchasePrice,
  pricePerKgFromAmount,
  purchaseTotal,
} from '@/lib/purchaseTotals'

interface AbastecimientoModalProps {
  show: boolean
  onClose: (refresh?: boolean) => void
  editing: Purchase | null
  suppliers: Supplier[]
}

type LineDraft = {
  id_product: number
  weight: string
  price: string
  amount: string
}

function emptyLine(): LineDraft {
  return { id_product: 0, weight: '', price: '', amount: '' }
}

function amountFromDraft(line: LineDraft): string {
  const weight = parseWeightInput(line.weight)
  const price = parsePurchasePrice(line.price)
  if (!weight.ok || weight.value == null || weight.value <= 0 || !price.ok) return ''
  return formatAmountDraft(lineAmount(weight.value, price.value))
}

function lineToDraft(line: NonNullable<Purchase['lines']>[number]): LineDraft {
  const amount = line.amount ?? lineAmount(line.weight, line.price_per_kg)
  return {
    id_product: line.id_product,
    weight: String(line.weight),
    price: formatUnitDraft(line.price_per_kg),
    amount: formatAmountDraft(amount),
  }
}

export function AbastecimientoModal({ show, onClose, editing, suppliers }: AbastecimientoModalProps) {
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [date, setDate] = useState('')
  const [unitemized, setUnitemized] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)

  const isEditing = !!editing

  useEffect(() => {
    if (!show) return
    setSupplierId(editing?.id_supplier ?? null)
    setDate(editing?.date || pickerDateToIso(new Date()))
    setUnitemized(
      editing && editing.unitemized_amount ? formatAmountDraft(editing.unitemized_amount) : '',
    )
    setNote(editing?.note || '')
    setLines(editing?.lines?.length ? editing.lines.map(lineToDraft) : [])
    setProductModalOpen(false)
  }, [editing, show])

  useEffect(() => {
    if (!show) return
    let cancelled = false
    async function loadProducts() {
      const acc: Product[] = []
      let cursor: number | null = null
      for (let page = 0; page < 10; page++) {
        const res = await getProductsPaginatedOfflineFirst({
          limit: 100,
          last_seen_id: cursor,
          filters: { admin_list: true },
        })
        const items = res.data?.items ?? []
        acc.push(...items)
        cursor = res.data?.next_cursor ?? null
        if (!cursor || items.length === 0) break
      }
      if (!cancelled) setProducts(acc)
    }
    loadProducts().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [show])

  const supplierOptions = useMemo(() => {
    const list = suppliers.filter((s) => s.active || s.id === supplierId)
    return list.map((s) => ({ value: s.id, label: s.name }))
  }, [suppliers, supplierId])

  const productOptions = useMemo(() => {
    const opts = products
      .filter((p) => p.active !== false)
      .map((p) => ({ value: p.id, label: productDisplayName(p.name, p.brand) }))
    for (const line of lines) {
      if (!line.id_product || opts.some((o) => o.value === line.id_product)) continue
      const known = editing?.lines?.find((l) => l.id_product === line.id_product)
      opts.push({
        value: line.id_product,
        label: known
          ? productDisplayName(known.product_name || 'Producto', known.product_brand)
          : `Producto n.º ${line.id_product}`,
      })
    }
    return opts
  }, [products, lines, editing])

  const unitemizedValue = (() => {
    if (!unitemized.trim()) return 0
    const parsed = parseUnitPriceInput(unitemized)
    return parsed.ok ? parsed.value : 0
  })()

  const lineAmounts = lines.map((line) => {
    const weight = parseWeightInput(line.weight)
    const price = parsePurchasePrice(line.price)
    if (!weight.ok || weight.value == null || weight.value <= 0 || !price.ok) return 0
    return lineAmount(weight.value, price.value)
  })
  const total = purchaseTotal(lineAmounts, unitemizedValue)

  function patchLine(index: number, patch: Partial<LineDraft>, source: 'fields' | 'amount') {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line
        const next = { ...line, ...patch }
        if (source === 'amount') {
          const weight = parseWeightInput(next.weight)
          const amount = parseUnitPriceInput(next.amount)
          if (weight.ok && weight.value && weight.value > 0 && amount.ok) {
            next.price = formatUnitDraft(pricePerKgFromAmount(weight.value, amount.value))
          }
          return next
        }
        next.amount = amountFromDraft(next)
        return next
      }),
    )
  }

  function openNewProduct() {
    setProductModalOpen(true)
  }

  function handleProductCreated(product: Product) {
    setProducts((prev) => (prev.some((p) => p.id === product.id) ? prev : [...prev, product]))
    setLines((prev) => [...prev, { ...emptyLine(), id_product: product.id }])
  }

  function buildPayload(): PurchaseWrite | null {
    if (!supplierId) {
      toast.error('Elegí un proveedor')
      return null
    }
    if (!date) {
      toast.error('La fecha es obligatoria')
      return null
    }
    if (unitemized.trim()) {
      const parsed = parseUnitPriceInput(unitemized)
      if (!parsed.ok) {
        toast.error(parsed.message)
        return null
      }
    }
    const kept = lines.filter(
      (line) => line.id_product || line.weight.trim() || line.price.trim() || line.amount.trim(),
    )
    const payloadLines: PurchaseWrite['lines'] = []
    for (let i = 0; i < kept.length; i++) {
      const line = kept[i]
      if (!line.id_product) {
        toast.error(`Elegí un producto en la línea ${i + 1}`)
        return null
      }
      const weight = parseWeightInput(line.weight)
      if (!weight.ok || weight.value == null || weight.value <= 0) {
        toast.error(`Los kilos de la línea ${i + 1} deben ser mayores a 0`)
        return null
      }
      const price = parsePurchasePrice(line.price)
      if (!price.ok) {
        toast.error(`Precio de compra inválido en la línea ${i + 1}`)
        return null
      }
      payloadLines.push({
        id_product: line.id_product,
        weight: weight.value,
        price_per_kg: price.value,
      })
    }
    const extra = unitemized.trim() ? parseUnitPriceInput(unitemized) : { ok: true as const, value: 0 }
    if (!extra.ok) return null
    if (payloadLines.length === 0 && extra.value <= 0) {
      toast.error('Indicá un importe o al menos un producto')
      return null
    }
    return {
      id_supplier: supplierId,
      date,
      unitemized_amount: extra.value,
      note: note.trim() || null,
      lines: payloadLines,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = buildPayload()
    if (!payload) return
    const supplierName = suppliers.find((s) => s.id === payload.id_supplier)?.name ?? editing?.supplier_name
    const localLines = payload.lines.map((line) => {
      const product = products.find((p) => p.id === line.id_product)
      return {
        id_product: line.id_product,
        product_name: product?.name ?? null,
        product_brand: product?.brand ?? null,
        weight: line.weight,
        price_per_kg: line.price_per_kg,
        amount: lineAmount(line.weight, line.price_per_kg),
      }
    })
    const localTotal = purchaseTotal(
      localLines.map((line) => line.amount),
      payload.unitemized_amount,
    )

    setLoading(true)
    if (!isOnlineNow()) {
      if (isEditing) {
        await enqueueCommand('PURCHASE_UPDATE', { id: editing!.id, data: payload })
        const existing = await lepraDb.purchases.get(editing!.id)
        await lepraDb.purchases.put({
          ...(existing ?? editing!),
          ...payload,
          id: editing!.id,
          supplier_name: supplierName ?? null,
          total: localTotal,
          lines: localLines,
          active: existing?.active ?? editing!.active,
        })
        toast.success('Cambio guardado (pendiente de sincronizar)')
      } else {
        const tempId = nextTempId()
        await enqueueCommand('PURCHASE_CREATE', { tempId, data: payload })
        await lepraDb.purchases.put({
          id: tempId,
          ...payload,
          supplier_name: supplierName ?? null,
          total: localTotal,
          note: payload.note,
          active: true,
          lines: localLines,
        })
        toast.success('Abastecimiento creado (pendiente de sincronizar)')
      }
      setLoading(false)
      onClose(true)
      return
    }

    const res = isEditing
      ? await updatePurchase({ ...payload, id: editing!.id })
      : await createPurchase(payload)
    if (res.error) {
      toast.error(res.error.message)
      setLoading(false)
      return
    }
    if (res.data?.purchase) await lepraDb.purchases.put(res.data.purchase)
    toast.success(isEditing ? 'Abastecimiento actualizado' : 'Abastecimiento creado')
    setLoading(false)
    onClose(true)
  }

  return (
    <>
      <LepraModal show={show} onClose={() => onClose()} busy={loading} size="lg">
        <Modal.Header closeButton={!loading} className="border-dark">
          <Modal.Title>{isEditing ? 'Editar abastecimiento' : 'Nuevo abastecimiento'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ModalBusyFrame busy={loading} message="Guardando abastecimiento...">
            <Form onSubmit={handleSubmit}>
              <div className="row g-3">
                <Form.Group className="col-md-6">
                  <Form.Label>Proveedor</Form.Label>
                  <Select<number>
                    options={supplierOptions}
                    value={supplierId}
                    onChange={setSupplierId}
                    placeholder="Elegí un proveedor"
                  />
                </Form.Group>
                <Form.Group className="col-md-6">
                  <Form.Label>Fecha</Form.Label>
                  <Form.Control type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </Form.Group>
                <Form.Group className="col-md-6">
                  <Form.Label>Importe sin detallar</Form.Label>
                  <DecimalInput
                    kind="price"
                    allowEmpty
                    value={unitemized}
                    onChange={(e) => setUnitemized(e.target.value)}
                    placeholder="0"
                  />
                  <Form.Text className="text-muted">
                    Plata que no querés abrir en productos. Puede ser el único dato.
                  </Form.Text>
                </Form.Group>
                <Form.Group className="col-md-6">
                  <Form.Label>Nota</Form.Label>
                  <Form.Control
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Opcional"
                  />
                </Form.Group>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
                <h3 className="h6 mb-0">Productos (opcional)</h3>
                <div className="d-flex gap-2">
                  <Button type="button" variant="outline-dark" size="sm" onClick={openNewProduct}>
                    <Plus size={16} className="me-1" aria-hidden /> Nuevo producto
                  </Button>
                  <Button
                    type="button"
                    variant="outline-dark"
                    size="sm"
                    onClick={() => setLines((prev) => [...prev, emptyLine()])}
                  >
                    <Plus size={16} className="me-1" aria-hidden /> Agregar línea
                  </Button>
                </div>
              </div>
              <p className="text-muted small">
                El precio es el de compra al mayorista. No modifica el precio de venta del catálogo.
              </p>

              {lines.length === 0 ? (
                <p className="text-muted small">Sin productos. El total es solo el importe sin detallar.</p>
              ) : (
                lines.map((line, index) => (
                  <div key={index} className="border rounded p-2 mb-2">
                    <div className="row g-2 align-items-start">
                      <Form.Group className="col-md-4">
                        <Form.Label className="small">Producto</Form.Label>
                        <Select<number>
                          options={productOptions}
                          value={line.id_product || null}
                          onChange={(value) => patchLine(index, { id_product: value ?? 0 }, 'fields')}
                          placeholder="Elegí un producto"
                        />
                      </Form.Group>
                      <Form.Group className="col-6 col-md-2">
                        <Form.Label className="small">Kilos</Form.Label>
                        <DecimalInput
                          kind="weight"
                          allowEmpty={false}
                          value={line.weight}
                          onChange={(e) => patchLine(index, { weight: e.target.value }, 'fields')}
                        />
                      </Form.Group>
                      <Form.Group className="col-6 col-md-2">
                        <Form.Label className="small">Precio / kg</Form.Label>
                        <DecimalInput
                          kind="decimal"
                          allowEmpty={false}
                          value={line.price}
                          onChange={(e) => patchLine(index, { price: e.target.value }, 'fields')}
                        />
                      </Form.Group>
                      <Form.Group className="col-6 col-md-2">
                        <Form.Label className="small">Importe</Form.Label>
                        <DecimalInput
                          kind="price"
                          allowEmpty
                          value={line.amount}
                          onChange={(e) => patchLine(index, { amount: e.target.value }, 'amount')}
                          onBlur={() =>
                            setLines((prev) =>
                              prev.map((line, i) =>
                                i === index ? { ...line, amount: amountFromDraft(line) } : line,
                              ),
                            )
                          }
                        />
                      </Form.Group>
                      <div className="col-auto">
                        <Form.Label className="small invisible" aria-hidden="true">
                          &nbsp;
                        </Form.Label>
                        <Button
                          type="button"
                          variant="outline-danger"
                          className="abastecimiento-line-remove"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                          aria-label="Quitar línea"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              <div className="d-flex justify-content-between align-items-center mt-3">
                <strong>Total {formatMoneyWithSymbol(total)}</strong>
                <div className="d-flex gap-2">
                  <ModalDismissButton />
                  <Button type="submit" className="btn-lepra" disabled={loading}>
                    Guardar
                  </Button>
                </div>
              </div>
            </Form>
          </ModalBusyFrame>
        </Modal.Body>
      </LepraModal>
      {productModalOpen && (
        <ProductoModal
          show
          editingProduct={null}
          onCreated={handleProductCreated}
          onClose={() => setProductModalOpen(false)}
        />
      )}
    </>
  )
}
