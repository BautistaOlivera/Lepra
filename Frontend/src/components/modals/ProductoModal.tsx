import { useState, useEffect, useRef } from 'react'
import { Modal, Form, Button, Table } from 'react-bootstrap'
import { LepraModal, ModalDismissButton } from '@/components/LepraModal'
import { ModalBusyFrame } from '@/components/LoadingOverlay'
import { Plus, Trash2, Download } from 'lucide-react'
import { createProduct, updateProduct, uploadProductImage, getImageUrl } from '@/api/product'
import {
  createProductPriceTier,
  deleteProductPriceTier,
} from '@/api/productPriceTier'
import { Product, PriceTier } from '@/types'
import toast from 'react-hot-toast'
import { Select } from '@/components/Select'
import { BrandSelect } from '@/components/BrandSelect'
import { DecimalInput } from '@/components/DecimalInput'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { nextTempId } from '@/offline/ids'
import {
  getExistingProductBrands,
  getProductsPaginatedOfflineFirst,
} from '@/repositories/productsRepo'
import {
  type TierDraft,
  tierDraftsFromProduct,
  newTierDraft,
  validateTierDrafts,
  snapshotTiers,
  tiersChanged,
  computeTierDiff,
  applyTierDiffOnline,
} from '@/lib/productTiers'
import { tiersFromPayload } from '@/lib/productMerge'
import { parseWeightInput } from '@/lib/formatWeight'
import { downloadRemoteImage } from '@/lib/downloadImage'
import { canonicalizeBrand } from '@/lib/productBrand'

interface ProductoModalProps {
  show: boolean
  onClose: (refresh?: boolean) => void
  editingProduct: Product | null
}

const CATEGORIAS = [
  { value: 'Lacteos', label: 'Lácteos' },
  { value: 'Embutidos', label: 'Embutidos' },
]

const PRICE_DECIMALS_MSG = 'Solo 2 números después del punto'

export function ProductoModal({ show, onClose, editingProduct }: ProductoModalProps) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [weight, setWeight] = useState('')
  const [fixedWeight, setFixedWeight] = useState(false)
  const [brand, setBrand] = useState('')
  const [brandOptions, setBrandOptions] = useState<{ value: string; label: string }[]>([])
  const [category, setCategory] = useState('')
  const [img, setImg] = useState('')
  const [hasTieredPricing, setHasTieredPricing] = useState(false)
  const [tierRows, setTierRows] = useState<TierDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloadingImage, setDownloadingImage] = useState(false)
  const [disableModalOpen, setDisableModalOpen] = useState(false)
  const [disableConfirmChecked, setDisableConfirmChecked] = useState(false)
  const [disablingTiers, setDisablingTiers] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initialTiersRef = useRef<PriceTier[]>([])
  const lastBrandRef = useRef('')

  const isEditing = !!editingProduct
  const imgDisplayUrl = img ? getImageUrl(img) : 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=200&q=80'
  function parsePriceInput(raw: string): { ok: true; value: number } | { ok: false; message: string } {
    const trimmed = raw.trim().replace(',', '.')
    if (!trimmed) return { ok: false, message: 'Precio inválido' }
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false, message: 'Precio inválido' }
    const [, decimals] = trimmed.split('.')
    if (decimals && decimals.length > 2) return { ok: false, message: PRICE_DECIMALS_MSG }
    const value = parseFloat(trimmed)
    if (!Number.isFinite(value) || value < 0) return { ok: false, message: 'Precio inválido' }
    return { ok: true, value }
  }

  const priceNumPreview = parseFloat(price.trim().replace(',', '.'))
  const isPriceValid = price.trim() !== '' && !isNaN(priceNumPreview) && priceNumPreview >= 0
  const isFormValid = name.trim() !== '' && isPriceValid

  const weightNumPreview = parseWeightInput(weight)
  const pieceWeightForTiers =
    weightNumPreview.ok && weightNumPreview.value != null && weightNumPreview.value > 0
      ? weightNumPreview.value
      : null

  const tierCtx = { pieceWeightKg: pieceWeightForTiers, fixedWeight }

  function resetTierStateFromProduct(product: Product | null) {
    const tiers = product?.price_tiers ?? []
    initialTiersRef.current = snapshotTiers(tiers)
    setTierRows(
      tierDraftsFromProduct(tiers, {
        pieceWeightKg: product?.weight,
        fixedWeight: !!product?.fixed_weight,
      }),
    )
  }

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name)
      setPrice(String(editingProduct.price))
      setWeight(editingProduct.weight != null ? String(editingProduct.weight) : '')
      setFixedWeight(!!editingProduct.fixed_weight)
      setBrand(editingProduct.brand || '')
      setCategory(editingProduct.category || '')
      setImg(editingProduct.img || '')
      setHasTieredPricing(editingProduct.has_tiered_pricing)
      resetTierStateFromProduct(editingProduct)
    } else {
      setName('')
      setPrice('')
      setWeight('')
      setFixedWeight(false)
      setBrand(lastBrandRef.current)
      setCategory('')
      setImg('')
      setHasTieredPricing(false)
      initialTiersRef.current = []
      setTierRows([])
    }
    setDisableModalOpen(false)
    setDisableConfirmChecked(false)
  }, [editingProduct, show])

  useEffect(() => {
    if (!show) return
    let cancelled = false
    ;(async () => {
      try {
        if (isOnlineNow()) {
          await getProductsPaginatedOfflineFirst({
            limit: 200,
            filters: { admin_list: true },
          })
        }
        const brands = await getExistingProductBrands()
        if (cancelled) return
        setBrandOptions(brands.map((b) => ({ value: b, label: b })))
      } catch {
        if (!cancelled) setBrandOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [show])

  function rememberBrand(next: string) {
    const trimmed = canonicalizeBrand(
      next,
      brandOptions.map((o) => o.value),
    )
    if (!trimmed) return
    lastBrandRef.current = trimmed
    setBrandOptions((prev) => {
      const exists = prev.some((o) => o.value.toLowerCase() === trimmed.toLowerCase())
      if (exists) {
        return prev.map((o) =>
          o.value.toLowerCase() === trimmed.toLowerCase() ? { value: trimmed, label: trimmed } : o,
        )
      }
      return [...prev, { value: trimmed, label: trimmed }].sort((a, b) =>
        a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }),
      )
    })
  }

  function finishClose(refresh = true) {
    rememberBrand(brand)
    onClose(refresh)
  }

  function resolvedBrand(): string | undefined {
    const canon = canonicalizeBrand(
      brand,
      brandOptions.map((o) => o.value),
    )
    return canon || undefined
  }

  function productFieldsChanged(priceNum: number, weightNum: number | null): boolean {
    if (!editingProduct) return true
    const prevWeight = editingProduct.weight ?? null
    return (
      editingProduct.name !== name.trim() ||
      editingProduct.price !== priceNum ||
      prevWeight !== weightNum ||
      !!editingProduct.fixed_weight !== fixedWeight ||
      (editingProduct.brand || '') !== (canonicalizeBrand(brand, brandOptions.map((o) => o.value)) || '') ||
      (editingProduct.category || '') !== (category || '') ||
      (editingProduct.img || '') !== img ||
      editingProduct.has_tiered_pricing !== hasTieredPricing
    )
  }

  function handleTieredPricingToggle(checked: boolean) {
    if (checked) {
      setHasTieredPricing(true)
      if (tierRows.length === 0) setTierRows([newTierDraft()])
      return
    }

    const serverCount = initialTiersRef.current.length
    const formCount = tierRows.filter((r) => r.min_kg.trim() || r.price_per_kg.trim()).length
    if (serverCount === 0 && formCount === 0) {
      setHasTieredPricing(false)
      setTierRows([])
      return
    }

    setDisableConfirmChecked(false)
    setDisableModalOpen(true)
  }

  async function confirmDisableTieredPricing() {
    if (!disableConfirmChecked) return

    if (isEditing && editingProduct) {
      setDisablingTiers(true)
      const deleteIds = initialTiersRef.current.map((t) => t.id).filter((id) => id > 0)

      if (!isOnlineNow()) {
        await enqueueCommand('PRODUCT_UPDATE', {
          id: editingProduct.id,
          has_tiered_pricing: false,
        })
        if (deleteIds.length > 0) {
          await enqueueCommand('PRODUCT_TIERS_SYNC', {
            id: editingProduct.id,
            create: [],
            update: [],
            delete: deleteIds,
            has_tiered_pricing: false,
          })
        }
        await lepraDb.products.update(editingProduct.id, {
          has_tiered_pricing: false,
          price_tiers: [],
        })
        setDisablingTiers(false)
        setDisableModalOpen(false)
        toast.success('Cambio guardado (pendiente de sincronizar)')
        finishClose(true)
        return
      }

      for (const t of initialTiersRef.current) {
        const { error } = await deleteProductPriceTier(t.id)
        if (error) {
          toast.error(error.message)
          setDisablingTiers(false)
          return
        }
      }
      const { error } = await updateProduct({
        id: editingProduct.id,
        has_tiered_pricing: false,
      })
      setDisablingTiers(false)
      if (error) {
        toast.error(error.message)
        return
      }
      await lepraDb.products.update(editingProduct.id, {
        has_tiered_pricing: false,
        price_tiers: [],
      } as Partial<Product>)
      toast.success('Precios por volumen desactivados')
      finishClose(true)
      return
    }

    setHasTieredPricing(false)
    setTierRows([])
    initialTiersRef.current = []
    setDisableModalOpen(false)
  }

  function cancelDisableTieredPricing() {
    setDisableModalOpen(false)
    setDisableConfirmChecked(false)
  }

  function updateTierRow(key: string, field: 'min_kg' | 'price_per_kg', value: string) {
    setTierRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  }

  function removeTierRow(key: string) {
    setTierRows((prev) => prev.filter((r) => r.key !== key))
  }

  function addTierRow() {
    setTierRows((prev) => [...prev, newTierDraft()])
  }

  function handlePriceInvalid(e: React.FormEvent<HTMLInputElement>) {
    e.preventDefault()
    const input = e.currentTarget
    if (input.validity.stepMismatch) {
      toast.error(PRICE_DECIMALS_MSG)
      return
    }
    if (input.validity.badInput || input.validity.typeMismatch) {
      toast.error('Precio inválido')
      return
    }
    if (input.validity.rangeUnderflow) {
      toast.error('El precio no puede ser negativo')
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isOnlineNow()) {
      toast.error('Sin conexión: no se puede subir imagen')
      e.target.value = ''
      return
    }
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('Formato no permitido. Use JPEG, PNG, GIF o WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5 MB')
      return
    }
    const productName = name.trim()
    if (!productName) {
      toast.error('Completá el nombre del producto antes de subir la imagen')
      e.target.value = ''
      return
    }
    setUploading(true)
    const { data, error } = await uploadProductImage(file, productName, brand.trim())
    setUploading(false)
    if (error) {
      toast.error(error.message || 'Error al subir la imagen')
      return
    }
    if (data?.url) setImg(data.url)
    e.target.value = ''
  }

  async function handleDownloadImage() {
    if (!img) return
    setDownloadingImage(true)
    try {
      const filename = name.trim() || editingProduct?.name || 'producto'
      await downloadRemoteImage(getImageUrl(img), filename)
      toast.success('Imagen descargada')
    } catch {
      toast.error('No se pudo descargar la imagen')
    } finally {
      setDownloadingImage(false)
    }
  }

  async function persistTiersForProduct(productId: number, tiers: ReturnType<typeof validateTierDrafts> & { ok: true }) {
    if (isEditing) {
      if (!tiersChanged(initialTiersRef.current, tiers.tiers)) return null
      const diff = computeTierDiff(initialTiersRef.current, tiers.tiers)
      return applyTierDiffOnline(productId, diff)
    }

    for (const row of tiers.tiers) {
      const res = await createProductPriceTier({
        id_product: productId,
        min_kg: row.min_kg,
        price_per_kg: row.price_per_kg,
      })
      if (res.error) return res.error.message
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parsePriceInput(price)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }
    const priceNum = parsed.value
    const weightParsed = parseWeightInput(weight)
    if (!weightParsed.ok) {
      toast.error(weightParsed.message)
      return
    }
    const weightNum = weightParsed.value

    if (fixedWeight && (weightNum == null || weightNum <= 0)) {
      toast.error('El peso por pieza es obligatorio si vendés solo por pieza')
      return
    }

    let validatedTiers: ReturnType<typeof validateTierDrafts> | null = null
    if (hasTieredPricing) {
      validatedTiers = validateTierDrafts(tierRows, tierCtx)
      if (!validatedTiers.ok) {
        toast.error(validatedTiers.message)
        return
      }
    }

    setLoading(true)
    const brandValue = resolvedBrand()

    if (isEditing) {
      if (!isOnlineNow()) {
        const patch = {
          id: editingProduct!.id,
          name,
          price: priceNum,
          weight: weightNum ?? undefined,
          fixed_weight: fixedWeight,
          brand: brandValue,
          category: category || undefined,
          img: img || undefined,
          has_tiered_pricing: hasTieredPricing,
        }
        if (productFieldsChanged(priceNum, weightNum)) {
          await enqueueCommand('PRODUCT_UPDATE', patch)
        }
        if (hasTieredPricing && validatedTiers?.ok && tiersChanged(initialTiersRef.current, validatedTiers.tiers)) {
          const diff = computeTierDiff(initialTiersRef.current, validatedTiers.tiers)
          await enqueueCommand('PRODUCT_TIERS_SYNC', {
            id: editingProduct!.id,
            ...diff,
          })
        }
        await lepraDb.products.update(editingProduct!.id, {
          name,
          price: priceNum,
          weight: weightNum,
          fixed_weight: fixedWeight,
          brand: brandValue ?? null,
          category: category || null,
          img: img || null,
          has_tiered_pricing: hasTieredPricing,
          price_tiers:
            hasTieredPricing && validatedTiers?.ok
              ? tiersFromPayload(validatedTiers.tiers)
              : [],
        })
        toast.success('Cambio guardado (pendiente de sincronizar)')
        setLoading(false)
        finishClose(true)
        return
      }

      const { error } = await updateProduct({
        id: editingProduct!.id,
        name,
        price: priceNum,
        weight: weightNum ?? undefined,
        fixed_weight: fixedWeight,
        brand: brandValue,
        category: category || undefined,
        img: img || undefined,
        has_tiered_pricing: hasTieredPricing,
      })
      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      if (hasTieredPricing && validatedTiers?.ok) {
        const tierErr = await persistTiersForProduct(editingProduct!.id, validatedTiers)
        if (tierErr) {
          toast.error(`Producto actualizado, pero falló un precio por volumen: ${tierErr}`)
          setLoading(false)
          finishClose(true)
          return
        }
      }

      toast.success('Producto actualizado')
      setLoading(false)
      finishClose(true)
      return
    } else {
      if (!isOnlineNow()) {
        if (img) {
          toast.error('Sin conexión: no se puede crear con imagen. Quitá la imagen o esperá a tener conexión.')
          setLoading(false)
          return
        }
        const tempId = nextTempId()
        const data = {
          name,
          price: priceNum,
          weight: weightNum ?? undefined,
          fixed_weight: fixedWeight,
          brand: brandValue,
          category: category || undefined,
          img: undefined,
          has_tiered_pricing: hasTieredPricing,
        }
        const tiersPayload =
          hasTieredPricing && validatedTiers?.ok
            ? validatedTiers.tiers.map((t) => ({
                min_kg: t.min_kg,
                price_per_kg: t.price_per_kg,
              }))
            : undefined
        await enqueueCommand('PRODUCT_CREATE', { tempId, data, tiers: tiersPayload })
        await lepraDb.products.put({
          id: tempId,
          name,
          price: priceNum,
          weight: weightNum,
          fixed_weight: fixedWeight,
          brand: brandValue ?? null,
          category: category || null,
          has_tiered_pricing: hasTieredPricing,
          img: null,
          active: true,
          status: 'active',
          price_tiers:
            hasTieredPricing && validatedTiers?.ok ? tiersFromPayload(validatedTiers.tiers) : undefined,
        } as Product)
        toast.success('Producto creado (pendiente de sincronizar)')
        setLoading(false)
        finishClose(true)
        return
      }

      const { data, error } = await createProduct({
        name,
        price: priceNum,
        weight: weightNum ?? undefined,
        fixed_weight: fixedWeight,
        brand: brandValue,
        category: category || undefined,
        img: img || undefined,
        has_tiered_pricing: hasTieredPricing,
      })
      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      const newId = data?.id
      if (hasTieredPricing && validatedTiers?.ok && Number.isFinite(newId)) {
        const tierErr = await persistTiersForProduct(newId!, validatedTiers)
        if (tierErr) {
          toast.error(`Producto creado, pero falló un precio por volumen: ${tierErr}`)
          setLoading(false)
          finishClose(true)
          return
        }
      }

      toast.success('Producto creado')
      setLoading(false)
      finishClose(true)
      return
    }
    setLoading(false)
  }

  const disableTierCount = isEditing
    ? initialTiersRef.current.length
    : tierRows.filter((r) => r.min_kg.trim() || r.price_per_kg.trim()).length

  const busy = loading || uploading
  const busyMessage = uploading ? 'Subiendo imagen...' : isEditing ? 'Guardando cambios...' : 'Creando producto...'

  return (
    <>
      <LepraModal show={show} onClose={() => onClose()} busy={busy} size={hasTieredPricing ? 'lg' : undefined}>
        <Modal.Header closeButton={!busy} className="border-dark">
          <Modal.Title>{isEditing ? 'Editar producto' : 'Agregar producto'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ModalBusyFrame busy={busy} message={busyMessage}>
            <Form onSubmit={handleSubmit} noValidate>
            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control value={name} onChange={(e) => setName(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{fixedWeight ? 'Precio base ($/pieza)' : 'Precio base ($/kg)'}</Form.Label>
              <DecimalInput
                kind="price"
                allowEmpty={false}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onInvalid={handlePriceInvalid}
                required
              />
              <Form.Text className="text-muted">
                {fixedWeight
                  ? 'Precio por unidad entera. Los precios por volumen también son por pieza.'
                  : 'Se usa si no alcanza ningún precio por volumen (por kg).'}
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Marca</Form.Label>
              <BrandSelect
                options={brandOptions}
                value={brand}
                onChange={setBrand}
                disabled={busy}
                placeholder="Buscar o escribir marca..."
              />
              <Form.Text className="text-muted">
                Elegí una marca existente o escribí una nueva. Al crear otro producto se reutiliza la última.
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Peso por pieza (kg)</Form.Label>
              <DecimalInput
                kind="weight"
                allowEmpty={!fixedWeight}
                className="input-kg"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Opcional — ej. 0.5 o 0,5"
                required={fixedWeight}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Vender solo por pieza (múltiplos del peso por pieza)"
                checked={fixedWeight}
                onChange={(e) => setFixedWeight(e.target.checked)}
              />
              <Form.Text className="text-muted">
                Requiere peso por pieza. El cliente elige cantidad de piezas, no kg libres.
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Categoría</Form.Label>
              <Select<string>
                options={CATEGORIAS}
                value={category || null}
                onChange={(v) => setCategory(v ?? '')}
                placeholder="Seleccionar categoría..."
                isSearchable={false}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Imagen del producto</Form.Label>
              <Form.Text className="text-muted d-block mb-2">
                Al subir la foto se aplica el logo de El Lepra, el nombre y la marca del producto sobre la imagen.
              </Form.Text>
              <div className="d-flex align-items-start gap-3">
                <div
                  className="border rounded overflow-hidden bg-light"
                  style={{ width: 80, height: 80, flexShrink: 0 }}
                >
                  <img
                    src={imgDisplayUrl}
                    alt="Vista previa"
                    className="w-100 h-100 object-fit-cover"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="d-none"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline-dark"
                    size="sm"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {img ? 'Cambiar imagen' : 'Subir imagen'}
                  </Button>
                  {img && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="text-muted ms-1"
                      onClick={() => setImg('')}
                    >
                      Quitar
                    </Button>
                  )}
                  {isEditing && img && (
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline-dark"
                        size="sm"
                        disabled={busy || downloadingImage}
                        onClick={handleDownloadImage}
                      >
                        <Download size={14} className="me-1" aria-hidden />
                        {downloadingImage ? 'Descargando…' : 'Descargar imagen'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Tiene precios por volumen"
                checked={hasTieredPricing}
                onChange={(e) => handleTieredPricingToggle(e.target.checked)}
              />
            </Form.Group>

            {hasTieredPricing ? (
              <div className="mb-4 border rounded p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <Form.Label className="mb-0 fw-semibold">Precios por volumen</Form.Label>
                  <Button type="button" variant="outline-dark" size="sm" onClick={addTierRow}>
                    <Plus size={16} className="me-1" aria-hidden />
                    Agregar volumen
                  </Button>
                </div>
                <p className="small text-muted mb-3">
                  {fixedWeight
                    ? 'Precio por pieza desde cada mínimo (≥ 2 piezas).'
                    : pieceWeightForTiers
                      ? 'Mínimo en piezas; se convierte a kg para el umbral. Precio por kg.'
                      : 'Precio por kg desde cada mínimo (≥ 2 kg).'}
                </p>
                {tierRows.length === 0 ? (
                  <p className="small text-muted mb-0">Sin precios por volumen. Agregá al menos uno.</p>
                ) : (
                  <Table responsive size="sm" className="mb-0 align-middle table-lepra">
                    <thead className="table-dark">
                      <tr>
                        <th>{fixedWeight || pieceWeightForTiers ? 'Desde (piezas)' : 'Desde (kg)'}</th>
                        <th>{fixedWeight ? 'Precio ($/pieza)' : 'Precio ($/kg)'}</th>
                        <th style={{ width: 48 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {tierRows.map((row) => (
                        <tr key={row.key}>
                          <td>
                            <DecimalInput
                              kind={fixedWeight || pieceWeightForTiers ? 'decimal' : 'weight'}
                              allowEmpty
                              showFeedback={false}
                              className={fixedWeight || pieceWeightForTiers ? undefined : 'input-kg'}
                              inputMode={fixedWeight || pieceWeightForTiers ? 'numeric' : undefined}
                              value={row.min_kg}
                              onChange={(e) => updateTierRow(row.key, 'min_kg', e.target.value)}
                              placeholder={pieceWeightForTiers ? 'Ej. 5' : 'Ej. 2.5'}
                            />
                          </td>
                          <td>
                            <DecimalInput
                              kind="price"
                              allowEmpty
                              showFeedback={false}
                              value={row.price_per_kg}
                              onChange={(e) => updateTierRow(row.key, 'price_per_kg', e.target.value)}
                              placeholder="Ej. 9.50"
                            />
                          </td>
                          <td>
                            <Button
                              type="button"
                              variant="link"
                              className="text-danger p-0"
                              aria-label="Quitar precio por volumen"
                              onClick={() => removeTierRow(row.key)}
                            >
                              <Trash2 size={18} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            ) : null}

                <div className="d-flex justify-content-end gap-2">
                  <ModalDismissButton disabled={busy}>Cancelar</ModalDismissButton>
                  <Button type="submit" className="btn-lepra" disabled={busy || !isFormValid}>
                    {isEditing ? 'Guardar' : 'Crear'}
                  </Button>
                </div>
            </Form>
          </ModalBusyFrame>
        </Modal.Body>
      </LepraModal>

      <LepraModal
        show={disableModalOpen}
        onClose={cancelDisableTieredPricing}
        busy={disablingTiers}
        centered
      >
        <Modal.Header closeButton={!disablingTiers} className="border-dark">
          <Modal.Title>Desactivar precios por volumen</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ModalBusyFrame busy={disablingTiers} message="Eliminando precios por volumen...">
            <p className="mb-3">
            Vas a desactivar precios por volumen y eliminar{' '}
            <strong>{disableTierCount}</strong> precio(s) por volumen de este producto.
          </p>
          <p className="small text-muted mb-3">
            Los pedidos ya hechos no cambian; los nuevos usarán solo el precio base.
          </p>
          <Form.Check
            type="checkbox"
            id="confirm-disable-tiers"
            label="Entiendo que se borrarán los precios por volumen"
            checked={disableConfirmChecked}
            onChange={(e) => setDisableConfirmChecked(e.target.checked)}
          />
            <div className="d-flex justify-content-end gap-2 mt-3 pt-3 border-top">
              <ModalDismissButton disabled={disablingTiers}>Cancelar</ModalDismissButton>
              <Button
                variant="outline-danger"
                disabled={!disableConfirmChecked || disablingTiers}
                onClick={() => void confirmDisableTieredPricing()}
              >
                Eliminar precios por volumen y desactivar
              </Button>
            </div>
          </ModalBusyFrame>
        </Modal.Body>
      </LepraModal>
    </>
  )
}
