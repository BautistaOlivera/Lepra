import { useState, useEffect, useRef, useCallback } from 'react'
import { Modal, Form, Button, Table } from 'react-bootstrap'
import { LepraModal } from '@/components/LepraModal'
import { ModalBusyFrame } from '@/components/LoadingOverlay'
import { createOrder, updateOrder } from '@/api/order'
import { createUser } from '@/api/user'
import { getUsersPaginatedOfflineFirst } from '@/repositories/usersRepo'
import { getProductsPaginatedOfflineFirst } from '@/repositories/productsRepo'
import { User, Product, Order } from '@/types'
import toast from 'react-hot-toast'
import { Select, type SelectOption } from '@/components/Select'
import { ClientePedidoSelect, type ClientePedidoValue } from '@/components/ClientePedidoSelect'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand, enqueueOfflineOrderSave } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { nextTempId } from '@/offline/ids'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { formatWeight, hasWeight, parseWeightInput } from '@/lib/formatWeight'
import { buildQuickClientEmail, buildQuickClientPassword, findUserByClientQuery } from '@/lib/quickClient'
import {
  isFixedWeightProduct,
  lineTotal,
  lineUnitPrice,
  minKgFromPieces,
  pieceWeightKg,
  validateLineWeightKg,
} from '@/lib/pricing'
import { parseUnitPriceInput } from '@/lib/productTiers'
import { QuantityStepper } from '@/components/QuantityStepper'
import { DecimalInput } from '@/components/DecimalInput'
import {
  clearPedidoDraft,
  hasPedidoDraft,
  loadPedidoDraft,
  savePedidoDraft,
  type PedidoDraft,
} from '@/lib/pedidoDraft'
import { useConfirm } from '@/context/ConfirmContext'

type SubmitPhase = 'idle' | 'client' | 'order'

function submitPhaseMessage(phase: SubmitPhase, editing: boolean): string {
  switch (phase) {
    case 'client':
      return 'Creando cliente nuevo...'
    case 'order':
      return editing ? 'Guardando pedido...' : 'Creando pedido...'
    default:
      return ''
  }
}

interface PedidoModalProps {
  show: boolean
  onClose: (refresh?: boolean) => void
  onDraftChange?: (hasDraft: boolean) => void
  /** Si viene, el modal edita ese pedido en vez de crear uno nuevo. */
  order?: Order | null
}

type PedidoLine = {
  id_product: number
  weight: string
  /** Precio unitario editable ($/kg o $/pieza); solo afecta este pedido. */
  price: string
  product?: Product
}

type LinePayload = { id_product: number; weight: number | null; price_per_kg: number }

function lineWeightKg(line: PedidoLine): number | null {
  const parsed = parseWeightInput(line.weight)
  return parsed.ok && parsed.value != null ? parsed.value : null
}

function lineUnitPriceNumber(line: PedidoLine): number {
  const parsed = parseUnitPriceInput(line.price)
  return parsed.ok ? parsed.value : 0
}

function linePieces(line: PedidoLine): number {
  const piece = line.product ? pieceWeightKg(line.product) : null
  if (!piece) return 0
  const w = lineWeightKg(line)
  if (w == null) return 0
  return Math.max(0, Math.round(w / piece))
}

function hydrateLines(draftLines: PedidoDraft['lines'], products: Product[]): PedidoLine[] {
  return draftLines.map((l) => ({
    id_product: l.id_product,
    weight: l.weight,
    price: l.price,
    product: l.id_product ? products.find((p) => p.id === l.id_product) : undefined,
  }))
}

function hydrateOrderLines(order: Order, products: Product[]): PedidoLine[] {
  return (order.lines || []).map((l) => {
    const product = products.find((p) => p.id === l.id_product)
    return {
      id_product: l.id_product,
      weight: l.weight == null ? '' : String(l.weight),
      price: String(l.price_per_kg ?? product?.price ?? ''),
      product,
    }
  })
}

function snapshotDraft(
  clientValue: ClientePedidoValue | null,
  lines: PedidoLine[],
  extraAmount: string,
  extraNote: string,
): PedidoDraft {
  return {
    client: clientValue,
    lines: lines.map((l) => ({
      id_product: l.id_product,
      weight: l.weight,
      price: l.price,
    })),
    extraAmount,
    extraNote,
  }
}

export function PedidoModal({ show, onClose, onDraftChange, order = null }: PedidoModalProps) {
  const confirm = useConfirm()
  const editing = !!order
  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clientValue, setClientValue] = useState<ClientePedidoValue | null>(null)
  const [lines, setLines] = useState<PedidoLine[]>([])
  const [extraAmount, setExtraAmount] = useState('')
  const [extraNote, setExtraNote] = useState('')
  const [resumedDraft, setResumedDraft] = useState(false)

  const validLines = lines.filter((l) => l.id_product !== 0)
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('idle')
  const [loadingData, setLoadingData] = useState(false)
  const loading = submitPhase !== 'idle'

  const draftRef = useRef({ clientValue, lines, extraAmount, extraNote })
  draftRef.current = { clientValue, lines, extraAmount, extraNote }

  const notifyDraft = useCallback(
    (has: boolean) => {
      onDraftChange?.(has)
    },
    [onDraftChange],
  )

  useEffect(() => {
    if (!show) {
      setLoadingData(false)
      return
    }
    setLoadingData(true)
    const draft = !editing ? loadPedidoDraft() : null
    const resuming = !!draft
    setResumedDraft(resuming)

    if (editing && order) {
      if (order.id_user != null && order.id_user !== 0) {
        setClientValue({
          kind: 'existing',
          id: order.id_user,
          label: order.user_name || order.customer_name || `Cliente #${order.id_user}`,
        })
      } else {
        const name = (order.customer_name || order.user_name || '').trim()
        setClientValue(name ? { kind: 'new', name } : null)
      }
      setLines(
        (order.lines || []).map((l) => ({
          id_product: l.id_product,
          weight: l.weight == null ? '' : String(l.weight),
          price: String(l.price_per_kg ?? ''),
        })),
      )
      const ea = Number(order.extra_amount || 0)
      setExtraAmount(ea > 0 ? String(ea) : '')
      setExtraNote(order.extra_note || '')
    } else {
      setClientValue(draft?.client ?? null)
      setLines(
        draft?.lines?.length
          ? draft.lines.map((l) => ({
              id_product: l.id_product,
              weight: l.weight,
              price: l.price,
            }))
          : [],
      )
      setExtraAmount(draft?.extraAmount ?? '')
      setExtraNote(draft?.extraNote ?? '')
    }

    Promise.all([
      getUsersPaginatedOfflineFirst({ limit: 100, filters: {} }),
      getProductsPaginatedOfflineFirst({ limit: 100, filters: { admin_list: true } }),
    ])
      .then(([usersRes, productsRes]) => {
        const nextProducts = productsRes.data?.items ?? []
        if (usersRes.data) setUsers(usersRes.data.items)
        if (productsRes.data) setProducts(nextProducts)
        if (editing && order) {
          setLines(hydrateOrderLines(order, nextProducts))
        } else if (draft?.lines?.length) {
          setLines(hydrateLines(draft.lines, nextProducts))
        }
        if (productsRes.error) toast.error(productsRes.error.message || 'Error al cargar productos')
        if (usersRes.error) toast.error(usersRes.error.message || 'Error al cargar clientes')
      })
      .catch(() => toast.error('Error al cargar datos'))
      .finally(() => setLoadingData(false))
  }, [show, editing, order])

  function persistMinimize() {
    if (editing) {
      onClose()
      return
    }
    const snap = snapshotDraft(
      draftRef.current.clientValue,
      draftRef.current.lines,
      draftRef.current.extraAmount,
      draftRef.current.extraNote,
    )
    savePedidoDraft(snap)
    notifyDraft(hasPedidoDraft())
    onClose()
  }

  async function handleDiscard() {
    if (loading) return
    if (editing) {
      onClose()
      return
    }
    const ok = await confirm({
      title: '¿Cancelar pedido?',
      message: 'Se descarta el pedido en curso y no se guarda el progreso.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Volver',
    })
    if (!ok) return
    clearPedidoDraft()
    notifyDraft(false)
    onClose()
  }

  function recalcPrice(line: PedidoLine): void {
    if (!line.product) return
    const w = lineWeightKg(line)
    // Sin peso: precio base del catálogo (se recalcula al completar kg).
    line.price = String(lineUnitPrice(line.product, w ?? 0))
  }

  function addLine() {
    if (products.length === 0) {
      toast.error('No hay productos cargados')
      return
    }
    setLines([...lines, { id_product: 0, weight: '', price: '' }])
  }

  function updateLine(
    index: number,
    field: 'id_product' | 'weight' | 'pieces' | 'price',
    value: number | string | null,
  ) {
    const newLines = [...lines]
    const line = newLines[index]
    if (field === 'id_product') {
      if (value == null || value === 0) {
        line.id_product = 0
        line.price = ''
        line.product = undefined
        line.weight = ''
      } else {
        const product = products.find((x) => x.id === value)
        if (product) {
          line.id_product = product.id
          line.product = product
          // Admin puede dejar sin pesar: no autocompletar kg/cantidad.
          line.weight = ''
          line.price = String(product.price)
        }
      }
    } else if (field === 'weight' && typeof value === 'string') {
      line.weight = value
      recalcPrice(line)
    } else if (field === 'pieces' && typeof value === 'number' && line.product) {
      const piece = pieceWeightKg(line.product)
      if (piece) {
        if (value <= 0) {
          line.weight = ''
        } else {
          line.weight = String(minKgFromPieces(value, piece))
        }
        recalcPrice(line)
      }
    } else if (field === 'price' && typeof value === 'string') {
      line.price = value
    }
    setLines(newLines)
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index))
  }

  const linesTotal = validLines.reduce((s, l) => {
    if (!l.product) return s
    const w = lineWeightKg(l)
    if (w == null) return s
    return s + lineTotal(l.product, w, lineUnitPriceNumber(l))
  }, 0)

  const extraParsed = extraAmount.trim() === '' ? null : parseUnitPriceInput(extraAmount)
  const extraAmountValue = extraParsed?.ok ? extraParsed.value : 0
  const extraNoteTrimmed = extraNote.trim()
  const hasExtra = extraAmount.trim() !== '' && extraParsed?.ok === true && extraAmountValue > 0
  const total = hasExtra ? linesTotal + extraAmountValue : linesTotal
  const canSubmitExtra =
    extraAmount.trim() === '' ||
    (extraParsed?.ok === true && (extraAmountValue === 0 || extraNoteTrimmed.length > 0))

  const userOptions: SelectOption<number>[] = users.map((u) => ({
    value: u.id,
    label: [u.name, u.email].filter(Boolean).join(' — ') || u.email,
  }))
  const productOptions: SelectOption<number>[] = products.map((p) => {
    const parts = [p.name]
    if (p.brand) parts[0] = `${p.name} (${p.brand})`
    if (hasWeight(p.weight)) parts.push(formatWeight(p.weight))
    return { value: p.id, label: parts.join(' · ') }
  })

  function resolveClient(): { idUser: number; displayName: string; createNew: false } | { newName: string; createNew: true } | null {
    if (!clientValue) return null
    if (clientValue.kind === 'existing') {
      const u = users.find((x) => x.id === clientValue.id)
      return {
        idUser: clientValue.id,
        displayName: u?.name || u?.email || clientValue.label,
        createNew: false,
      }
    }
    const name = clientValue.name.trim()
    if (name.length < 2) return null
    const existing = findUserByClientQuery(users, name)
    if (existing) {
      return {
        idUser: existing.id,
        displayName: existing.name || existing.email,
        createNew: false,
      }
    }
    return { newName: name, createNew: true }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const client = resolveClient()
    if (!client) {
      toast.error('Escribí o elegí un cliente')
      return
    }
    if (validLines.length === 0) {
      toast.error('Agregá al menos un producto')
      return
    }

    const parsedLines: LinePayload[] = []
    for (const l of validLines) {
      const w = parseWeightInput(l.weight)
      if (!w.ok) {
        toast.error(w.message)
        return
      }
      // Admin: peso vacío permitido (null = sin pesar). 0 / negativo siguen rechazados.
      if (w.value != null) {
        if (l.product) {
          const valid = validateLineWeightKg(l.product, w.value)
          if (!valid.ok) {
            toast.error(`${l.product.name}: ${valid.message}`)
            return
          }
        }
      }
      const priceParsed = parseUnitPriceInput(l.price)
      if (!priceParsed.ok) {
        toast.error(`${l.product?.name ?? 'Producto'}: ${priceParsed.message}`)
        return
      }
      parsedLines.push({
        id_product: l.id_product,
        weight: w.value,
        price_per_kg: priceParsed.value,
      })
    }

    let extraPayloadAmount = 0
    let extraPayloadNote: string | null = null
    if (extraAmount.trim() !== '') {
      const extraMoney = parseUnitPriceInput(extraAmount)
      if (!extraMoney.ok) {
        toast.error(extraMoney.message)
        return
      }
      if (extraMoney.value > 0) {
        if (!extraNoteTrimmed) {
          toast.error('Indicá qué productos incluye el saldo extra')
          return
        }
        extraPayloadAmount = extraMoney.value
        extraPayloadNote = extraNoteTrimmed
      }
    }

    let createdNewUser = false
    let idUser: number
    let displayName: string

    try {
      if (!client.createNew) {
        setSubmitPhase('order')
        idUser = client.idUser
        displayName = client.displayName
      } else if (!isOnlineNow()) {
        createdNewUser = true
        setSubmitPhase('client')
        const userTempId = nextTempId()
        const email = buildQuickClientEmail(client.newName)
        const password = buildQuickClientPassword()
        await enqueueCommand('USER_CREATE', {
          tempId: userTempId,
          data: { email, password, name: client.newName, rol: 'CLIENT' },
        })
        await lepraDb.users.put({
          id: userTempId,
          email,
          name: client.newName,
          location: null,
          rol: 'CLIENT',
          active: true,
        } as User)
        idUser = userTempId
        displayName = client.newName
        setSubmitPhase('order')
      } else {
        createdNewUser = true
        setSubmitPhase('client')
        const email = buildQuickClientEmail(client.newName)
        const password = buildQuickClientPassword()
        const userRes = await createUser({
          email,
          password,
          name: client.newName,
          rol: 'CLIENT',
        })
        if (userRes.error) {
          toast.error(userRes.error.message)
          setSubmitPhase('idle')
          return
        }
        idUser = userRes.data!.user.id
        displayName = client.newName
        setSubmitPhase('order')
      }

      const linePayload = parsedLines
      const extraFields = {
        extra_amount: extraPayloadAmount,
        extra_note: extraPayloadNote,
      }

      if (editing && order) {
        const body = {
          id: order.id,
          id_user: idUser,
          customer_name: null as string | null,
          lines: linePayload,
          ...extraFields,
        }

        if (!isOnlineNow()) {
          const { localId } = await enqueueOfflineOrderSave({
            orderId: order.id,
            data: body,
          })
          const prev = (await lepraDb.orders.get(localId)) ?? order
          await lepraDb.orders.put({
            ...prev,
            id: localId,
            id_user: idUser,
            customer_name: null,
            user_name: displayName,
            total,
            extra_amount: extraPayloadAmount,
            extra_note: extraPayloadNote,
            lines: linePayload,
          } as Order)
          // Evitar fila fantasma si el id temp ya se había mapeado.
          if (order.id < 0 && localId !== order.id) {
            await lepraDb.orders.delete(order.id).catch(() => {})
          }
          toast.success('Pedido actualizado (pendiente de sincronizar)')
        } else {
          const { error } = await updateOrder(body)
          if (error) {
            toast.error(error.message)
            setSubmitPhase('idle')
            return
          }
          toast.success('Pedido actualizado')
        }
      } else {
        const body = {
          id_user: idUser!,
          lines: linePayload,
          ...extraFields,
        }

        if (!isOnlineNow()) {
          const orderTempId = nextTempId()
          await enqueueCommand('ORDER_CREATE_ADMIN', { tempId: orderTempId, data: body })
          await lepraDb.orders.put({
            id: orderTempId,
            id_user: idUser,
            customer_name: null,
            user_name: displayName,
            total,
            extra_amount: extraPayloadAmount,
            extra_note: extraPayloadNote,
            created_at: new Date().toISOString(),
            status: 'PENDING',
            active: true,
            lines: linePayload,
          } as Order)
          const dependsOnPending = idUser < 0 || validLines.some((l) => l.id_product < 0)
          toast.success(
            createdNewUser
              ? dependsOnPending
                ? 'Pedido y cliente nuevos guardados (pendientes de sincronizar)'
                : 'Pedido creado con cliente nuevo (pendiente de sincronizar)'
              : dependsOnPending
                ? 'Pedido creado (pendiente; sincronizará después de productos o clientes nuevos)'
                : 'Pedido creado (pendiente de sincronizar)'
          )
        } else {
          const { error } = await createOrder(body)
          if (error) {
            toast.error(error.message)
            setSubmitPhase('idle')
            return
          }
          toast.success(createdNewUser ? 'Pedido creado con cliente nuevo' : 'Pedido creado')
        }

        clearPedidoDraft()
        notifyDraft(false)
      }

      setSubmitPhase('idle')
      onClose(true)
    } catch {
      setSubmitPhase('idle')
    }
  }

  const clientReady =
    clientValue?.kind === 'existing' ||
    (clientValue?.kind === 'new' && clientValue.name.trim().length >= 2)

  const busy = loading || loadingData
  const busyMessage = loading ? submitPhaseMessage(submitPhase, editing) : 'Cargando datos...'

  const title = editing
    ? `Editar pedido${order && order.id > 0 ? ` #${order.id}` : ''}`
    : resumedDraft
      ? 'Continuar pedido'
      : 'Nuevo pedido'

  return (
    <LepraModal
      show={show}
      onClose={persistMinimize}
      busy={busy}
      size="lg"
      closeConfirmTitle={editing ? '¿Cerrar sin guardar?' : '¿Minimizar pedido?'}
      closeConfirmMessage={
        editing
          ? 'Se descartan los cambios no guardados de este pedido.'
          : 'Se guarda el progreso. Podés continuar después con Continuar pedido.'
      }
      closeConfirmLabel={editing ? 'Cerrar' : 'Minimizar'}
      closeConfirmCancelLabel="Seguir editando"
    >
      <Modal.Header closeButton={!busy} className="border-dark">
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ModalBusyFrame busy={busy} message={busyMessage}>
          <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-4">
            <Form.Label>Cliente</Form.Label>
            <ClientePedidoSelect
              options={userOptions}
              users={users}
              value={clientValue}
              onChange={setClientValue}
              disabled={busy}
            />
            <Form.Text className="text-muted">
              Elegí uno de la lista o escribí un nombre; si no hay coincidencia, se crea un cliente nuevo al guardar.
              {!editing && ' Cerrar con la X o tocando afuera guarda el progreso.'}
              {' '}Podés dejar productos sin kg y completarlos después.
            </Form.Text>
          </Form.Group>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0">Productos</h6>
            <Button
              type="button"
              variant="outline-dark"
              size="sm"
              onClick={addLine}
              disabled={busy || products.length === 0}
            >
              + Agregar
            </Button>
          </div>

          <div className="table-lepra-wrap mb-4">
          <Table size="sm" className="table-lepra pedido-lines-table mb-0" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '32%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '5%' }} />
            </colgroup>
            <thead className="table-dark">
              <tr>
                <th>Producto</th>
                <th className="text-center">Cant. / kg</th>
                <th className="text-end">Precio</th>
                <th className="text-end">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const w = lineWeightKg(l)
                const unitPrice = lineUnitPriceNumber(l)
                const sub = l.product && w != null ? lineTotal(l.product, w, unitPrice) : 0
                const fixed = l.product ? isFixedWeightProduct(l.product) : false
                return (
                <tr key={i}>
                  <td className="align-middle">
                    <Select<number>
                      size="sm"
                      options={productOptions}
                      value={l.id_product === 0 ? null : l.id_product}
                      onChange={(id) => updateLine(i, 'id_product', id ?? 0)}
                      placeholder="Buscar por nombre..."
                      isSearchable
                    />
                  </td>
                  <td className="align-middle text-center">
                    {fixed ? (
                      <div className="d-inline-flex align-items-center justify-content-center gap-1">
                        <QuantityStepper
                          size="sm"
                          value={linePieces(l)}
                          min={1}
                          emptyLabel="—"
                          onChange={(p) => updateLine(i, 'pieces', p)}
                          ariaLabel="Piezas"
                        />
                        <span className="text-muted small user-select-none">u</span>
                      </div>
                    ) : (
                      <div className="d-inline-flex align-items-center gap-1">
                        <DecimalInput
                          kind="weight"
                          allowEmpty
                          showFeedback={false}
                          size="sm"
                          className="input-kg"
                          style={{ minHeight: 31, width: '4.25rem' }}
                          value={l.weight}
                          onChange={(e) => updateLine(i, 'weight', e.target.value)}
                          placeholder="—"
                          aria-label="Peso en kg"
                        />
                        <span className="text-muted small user-select-none">kg</span>
                      </div>
                    )}
                  </td>
                  <td className="text-end align-middle">
                    <div className="d-inline-flex align-items-center justify-content-end gap-1">
                      <DecimalInput
                        kind="price"
                        allowEmpty
                        showFeedback={false}
                        size="sm"
                        className="input-price text-end"
                        style={{ minHeight: 31, width: '4.75rem' }}
                        value={l.price}
                        onChange={(e) => updateLine(i, 'price', e.target.value)}
                        placeholder="—"
                        disabled={!l.product || busy}
                        aria-label={fixed ? 'Precio por pieza' : 'Precio por kg'}
                      />
                      {!fixed && <span className="text-muted small user-select-none">/kg</span>}
                    </div>
                  </td>
                  <td className="text-end align-middle">
                    {w == null && l.product ? (
                      <span className="text-muted small">Sin pesar</span>
                    ) : (
                      formatMoneyWithSymbol(sub)
                    )}
                  </td>
                  <td className="align-middle">
                    <Button variant="link" size="sm" className="text-danger p-0" onClick={() => removeLine(i)}>
                      ✕
                    </Button>
                  </td>
                </tr>
              )})}
            </tbody>
          </Table>
          </div>

          <Form.Group className="mb-3">
            <Form.Label>Productos extra (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder="Qué productos incluye (no listados en el catálogo)"
              disabled={busy}
              maxLength={500}
            />
            <div className="d-flex align-items-center gap-2 mt-2">
              <span className="text-muted small text-nowrap">Monto $</span>
              <DecimalInput
                kind="price"
                allowEmpty
                showFeedback={false}
                className="input-price"
                style={{ maxWidth: '9rem' }}
                value={extraAmount}
                onChange={(e) => setExtraAmount(e.target.value)}
                placeholder="0"
                disabled={busy}
                aria-label="Monto de productos extra"
              />
            </div>
            <Form.Text className="text-muted">
              Se suma al total y aparece en el comprobante PDF. No crea productos en el catálogo.
            </Form.Text>
          </Form.Group>

          <p className="fw-bold">Total: {formatMoneyWithSymbol(total)}</p>

              <div className="d-flex justify-content-end gap-2">
                <Button
                  type="button"
                  variant="outline-dark"
                  disabled={busy}
                  onClick={() => {
                    void handleDiscard()
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  className="pedido-modal-submit-btn fw-semibold"
                  disabled={busy || !clientReady || validLines.length === 0 || !canSubmitExtra}
                >
                  {editing ? 'Guardar cambios' : 'Crear pedido'}
                </Button>
              </div>
          </Form>
        </ModalBusyFrame>
      </Modal.Body>
    </LepraModal>
  )
}
