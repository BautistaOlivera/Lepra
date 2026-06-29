import CreatableSelect from 'react-select/creatable'
import type { StylesConfig } from 'react-select'
import { UserPlus } from 'lucide-react'
import { Badge } from 'react-bootstrap'
import type { SelectOption } from '@/components/Select'
import { findUserByClientQuery } from '@/lib/quickClient'

export type ClientePedidoValue =
  | { kind: 'existing'; id: number; label: string }
  | { kind: 'new'; name: string }

type ClientePedidoSelectProps = {
  options: SelectOption<number>[]
  users: { id: number; name?: string | null; email: string }[]
  value: ClientePedidoValue | null
  onChange: (value: ClientePedidoValue | null) => void
  disabled?: boolean
}

/** Valor sintético en react-select para “crear nuevo” (no colisiona con ids reales). */
const NEW_VALUE_PREFIX = 'new:'

type ClientSelectOption = SelectOption<number | string>

function newUserOptionValue(name: string): string {
  return `${NEW_VALUE_PREFIX}${name}`
}

function parseNewUserName(opt: ClientSelectOption): string {
  if (typeof opt.value === 'string' && opt.value.startsWith(NEW_VALUE_PREFIX)) {
    return opt.value.slice(NEW_VALUE_PREFIX.length)
  }
  return String(opt.label)
    .replace(/^Nuevo usuario:\s*/i, '')
    .trim()
}

function isNewUserOption(opt: ClientSelectOption, meta: { action: string }): boolean {
  if (meta.action === 'create-option') return true
  if (typeof opt.value === 'string' && opt.value.startsWith(NEW_VALUE_PREFIX)) return true
  return /^Nuevo usuario:/i.test(String(opt.label))
}

const lepraStyles: StylesConfig<ClientSelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderColor: state.isFocused ? 'var(--lepra-yellow-dark, #b38f00)' : '#dee2e6',
    boxShadow: state.isFocused ? '0 0 0 0.2rem rgba(230, 184, 0, 0.25)' : 'none',
    '&:hover': { borderColor: state.isFocused ? 'var(--lepra-yellow-dark)' : '#adb5bd' },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--lepra-yellow-light, #ffe566)'
      : state.isFocused
        ? 'rgba(230, 184, 0, 0.15)'
        : base.backgroundColor,
    color: state.isSelected ? 'var(--lepra-black, #1a1a1a)' : base.color,
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--lepra-black, #1a1a1a)',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#6c757d',
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 1060,
  }),
}

function defaultFilterOption(option: SelectOption<number>, inputValue: string): boolean {
  const label = String(option.label).toLowerCase()
  const search = inputValue
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  const labelNorm = label.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  return labelNorm.includes(search)
}

export function ClientePedidoSelect({ options, users, value, onChange, disabled }: ClientePedidoSelectProps) {
  const selectedOption: ClientSelectOption | null =
    value?.kind === 'existing'
      ? (options.find((o) => o.value === value.id) ?? { value: value.id, label: value.label })
      : value?.kind === 'new'
        ? { value: newUserOptionValue(value.name), label: value.name }
        : null

  return (
    <div className="cliente-pedido-select-row d-flex align-items-center gap-2 flex-wrap">
      <div className="cliente-pedido-select-field flex-grow-1 min-w-0">
        <CreatableSelect<ClientSelectOption, false>
          options={options}
          value={selectedOption}
          onInputChange={(text, meta) => {
            if (meta.action !== 'input-change') return
            const trimmed = text.trim()
            if (!trimmed) {
              onChange(null)
              return
            }
            const hit = findUserByClientQuery(users, trimmed)
            if (hit) {
              onChange({
                kind: 'existing',
                id: hit.id,
                label: [hit.name, hit.email].filter(Boolean).join(' — ') || hit.email,
              })
              return
            }
            onChange({ kind: 'new', name: text.trimStart() })
          }}
          onChange={(opt, meta) => {
            if (meta.action === 'clear' || !opt) {
              onChange(null)
              return
            }
            if (isNewUserOption(opt, meta)) {
              const name = parseNewUserName(opt)
              onChange(name ? { kind: 'new', name } : null)
              return
            }
            onChange({ kind: 'existing', id: Number(opt.value), label: opt.label })
          }}
          getNewOptionData={(inputValue) => {
            const name = inputValue.trim()
            return {
              label: `Nuevo usuario: ${name}`,
              value: newUserOptionValue(name),
              __isNew__: true,
            }
          }}
          placeholder="Buscar cliente o escribir nombre..."
          isSearchable
          isClearable
          isDisabled={disabled}
          filterOption={(option, raw) => defaultFilterOption(option.data as SelectOption<number>, raw)}
          formatCreateLabel={(input) => `Nuevo usuario: ${input.trim()}`}
          styles={lepraStyles}
          menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
          menuPosition="fixed"
          noOptionsMessage={() => 'Sin coincidencias — Enter para nuevo usuario'}
          classNamePrefix="lepra-select"
        />
      </div>
      {value?.kind === 'new' && value.name.trim().length >= 2 ? (
        <Badge bg="success" className="cliente-pedido-new-badge d-inline-flex align-items-center gap-1 fw-normal">
          <UserPlus size={14} aria-hidden />
          Nuevo usuario
        </Badge>
      ) : null}
    </div>
  )
}
