import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Form, Modal } from 'react-bootstrap'
import { ChevronLeft, ChevronRight, Pencil, Plus, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { AdminPageHero } from '@/components/AdminPageHero'
import { LoadingCenter, ModalBusyFrame } from '@/components/LoadingOverlay'
import { ClienteModal } from '@/components/modals/ClienteModal'
import { DateInputAr } from '@/components/DateInputAr'
import { LepraModal, ModalDismissButton } from '@/components/LepraModal'
import { upsertSalaryMonth } from '@/api/salary'
import { getUsersPaginatedOfflineFirst } from '@/repositories/usersRepo'
import { getSalaryYearOfflineFirst } from '@/repositories/salaryRepo'
import type { SalaryMonth, User } from '@/types'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { nextTempId } from '@/offline/ids'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { formatDateFromApi } from '@/lib/formatDate'
import { releaseBootstrapModalLock } from '@/lib/bootstrapModal'

const MONTHS = [
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

function todayIso(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function Empleados() {
  const [employees, setEmployees] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [months, setMonths] = useState<SalaryMonth[]>([])
  const [monthsLoading, setMonthsLoading] = useState(false)
  const [editingMonth, setEditingMonth] = useState<number | null>(null)

  const loadEmployees = useCallback(async () => {
    setLoading(true)
    const { data } = await getUsersPaginatedOfflineFirst({
      limit: 100,
      filters: { rol: 'EMPLOYEE', active: true },
    })
    if (data) setEmployees(data.items)
    setLoading(false)
  }, [])

  const loadMonths = useCallback(async (idUser: number, y: number) => {
    setMonthsLoading(true)
    const res = await getSalaryYearOfflineFirst(idUser, y)
    setMonths(res.data?.items ?? [])
    if (res.error) toast.error(res.error.message)
    setMonthsLoading(false)
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  useEffect(() => {
    if (selectedId == null) return
    loadMonths(selectedId, year)
  }, [selectedId, year, loadMonths])

  const selected = employees.find((e) => e.id === selectedId) ?? null
  const byMonth = useMemo(() => {
    const map = new Map<number, SalaryMonth>()
    for (const row of months) map.set(row.month, row)
    return map
  }, [months])

  function onModalClose(refresh?: boolean) {
    setModalOpen(false)
    setEditingUser(null)
    releaseBootstrapModalLock()
    if (refresh) loadEmployees()
  }

  return (
    <div className="admin-list-page">
      <AdminPageHero>
        <span className="d-inline-flex align-items-center gap-2">
          <Wallet size={28} aria-hidden />
          Empleados
        </span>
      </AdminPageHero>

      <div className="admin-list-toolbar">
        <Button
          className="btn-lepra admin-list-add-btn"
          onClick={() => {
            setEditingUser(null)
            setModalOpen(true)
          }}
        >
          <Plus size={18} className="me-1" aria-hidden /> Agregar empleado
        </Button>
      </div>

      {loading && employees.length === 0 ? (
        <LoadingCenter message="Cargando empleados..." />
      ) : employees.length === 0 ? (
        <p className="text-muted">Todavía no hay empleados.</p>
      ) : (
        <div className="d-flex flex-column gap-2 mb-4">
          {employees.map((employee) => {
            const active = employee.id === selectedId
            return (
              <Card key={employee.id} className="card-lepra">
                <Card.Body className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
                  <div>
                    <div className="fw-semibold">{employee.name || employee.email}</div>
                    <div className="small text-muted">{employee.email}</div>
                  </div>
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-dark"
                      size="sm"
                      onClick={() => {
                        setEditingUser(employee)
                        setModalOpen(true)
                      }}
                    >
                      <Pencil size={16} aria-hidden /> Editar
                    </Button>
                    <Button
                      className={active ? 'btn-lepra' : ''}
                      variant={active ? undefined : 'outline-dark'}
                      size="sm"
                      onClick={() => setSelectedId(active ? null : employee.id)}
                    >
                      Sueldos
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            )
          })}
        </div>
      )}

      {selected ? (
        <section>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h5 className="mb-0">Sueldos de {selected.name || selected.email}</h5>
            <div className="d-flex align-items-center gap-2">
              <Button variant="outline-dark" size="sm" onClick={() => setYear((y) => y - 1)} aria-label="Año anterior">
                <ChevronLeft size={16} />
              </Button>
              <span className="fw-semibold">{year}</span>
              <Button variant="outline-dark" size="sm" onClick={() => setYear((y) => y + 1)} aria-label="Año siguiente">
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
          {monthsLoading ? (
            <LoadingCenter message="Cargando sueldos..." />
          ) : (
            <div className="row g-3">
              {MONTHS.map((label, index) => {
                const month = index + 1
                const row = byMonth.get(month)
                const paid = Boolean(row?.paid)
                return (
                  <div className="col-12 col-md-6 col-xl-4" key={month}>
                    <Card className="card-lepra h-100">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="fw-semibold">{label}</div>
                          <div className="d-flex gap-1">
                            <Badge bg={paid ? 'success' : 'secondary'}>{paid ? 'Pagado' : 'Impago'}</Badge>
                            {row && row.id < 0 ? <Badge bg="warning">Pendiente</Badge> : null}
                          </div>
                        </div>
                        {paid && row?.amount != null ? (
                          <div className="mt-2">{formatMoneyWithSymbol(row.amount)}</div>
                        ) : null}
                        {row?.paid_at ? <div className="small text-muted">{formatDateFromApi(row.paid_at)}</div> : null}
                        {row?.note ? <div className="small mt-2">{row.note}</div> : null}
                        <Button
                          variant="outline-dark"
                          size="sm"
                          className="mt-3"
                          onClick={() => setEditingMonth(month)}
                        >
                          {row ? 'Editar' : 'Anotar'}
                        </Button>
                      </Card.Body>
                    </Card>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      {modalOpen ? (
        <ClienteModal
          show
          onClose={onModalClose}
          editingUser={editingUser}
          lockedRol="EMPLOYEE"
          noun="empleado"
        />
      ) : null}

      {selected && editingMonth != null ? (
        <SalaryMonthModal
          employeeId={selected.id}
          year={year}
          month={editingMonth}
          existing={byMonth.get(editingMonth) ?? null}
          onClose={(refresh) => {
            setEditingMonth(null)
            releaseBootstrapModalLock()
            if (refresh) loadMonths(selected.id, year)
          }}
        />
      ) : null}
    </div>
  )
}

function SalaryMonthModal({
  employeeId,
  year,
  month,
  existing,
  onClose,
}: {
  employeeId: number
  year: number
  month: number
  existing: SalaryMonth | null
  onClose: (refresh?: boolean) => void
}) {
  const [paid, setPaid] = useState(existing?.paid ?? false)
  const [amount, setAmount] = useState(existing?.amount != null ? String(existing.amount) : '')
  const [paidAt, setPaidAt] = useState(existing?.paid_at || todayIso())
  const [note, setNote] = useState(existing?.note || '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedAmount = amount.trim() === '' ? null : Number(amount.replace(',', '.'))
    if (paid && (parsedAmount == null || !Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      toast.error('Indicá el monto del sueldo')
      return
    }
    if (paid && !paidAt) {
      toast.error('Indicá la fecha de pago')
      return
    }
    const data = {
      id_user: employeeId,
      year,
      month,
      paid,
      amount: paid ? parsedAmount : null,
      paid_at: paid ? paidAt : null,
      note: note.trim() || null,
    }
    setLoading(true)
    if (!isOnlineNow()) {
      const localId = existing?.id ?? nextTempId()
      await lepraDb.salaryMonths.put({
        id: localId,
        ...data,
        amount: data.amount,
        updated_at: new Date().toISOString(),
      })
      await enqueueCommand('SALARY_UPSERT', { localId, data })
      toast.success('Sueldo guardado (pendiente de sincronizar)')
      setLoading(false)
      onClose(true)
      return
    }
    const { error } = await upsertSalaryMonth(data)
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(paid ? 'Mes marcado como pagado' : 'Mes marcado como impago')
    onClose(true)
  }

  return (
    <LepraModal show onClose={() => onClose()} busy={loading}>
      <Modal.Header closeButton={!loading}>
        <Modal.Title>
          {MONTHS[month - 1]} {year}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ModalBusyFrame busy={loading} message="Guardando...">
          <Form onSubmit={handleSubmit}>
            <Form.Check
              className="mb-3"
              type="switch"
              id="salary-paid"
              label={paid ? 'Pagado' : 'Impago'}
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
            />
            {paid ? (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Monto</Form.Label>
                  <Form.Control
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Fecha de pago</Form.Label>
                  <DateInputAr value={paidAt} onChange={setPaidAt} required />
                </Form.Group>
              </>
            ) : null}
            <Form.Group className="mb-3">
              <Form.Label>Nota</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opcional"
              />
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              <ModalDismissButton disabled={loading}>Cancelar</ModalDismissButton>
              <Button type="submit" className="btn-lepra" disabled={loading}>
                Guardar
              </Button>
            </div>
          </Form>
        </ModalBusyFrame>
      </Modal.Body>
    </LepraModal>
  )
}
