import CreatableSelect from 'react-select/creatable'
import type { StylesConfig } from 'react-select'
import type { SelectOption } from '@/components/Select'
import { brandKeysEqual, canonicalizeBrand } from '@/lib/productBrand'

type BrandSelectProps = {
  options: SelectOption<string>[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

const lepraStyles: StylesConfig<SelectOption<string>, false> = {
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
    zIndex: 2100,
  }),
}

function brandSearchKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function filterBrandOption(option: SelectOption<string>, inputValue: string): boolean {
  return brandSearchKey(String(option.label)).includes(brandSearchKey(inputValue))
}

function findBrandIgnoreCase(options: SelectOption<string>[], raw: string): SelectOption<string> | null {
  const key = raw.trim()
  if (!key) return null
  return options.find((o) => brandKeysEqual(o.value, key)) ?? null
}

/**
 * Marca de producto: lista existente filtrable al escribir, o alta de marca nueva.
 * Si coincide con una existente (sin importar mayúsculas), reutiliza esa.
 */
export function BrandSelect({
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Buscar o escribir marca...',
}: BrandSelectProps) {
  const known = options.map((o) => o.value)
  const trimmed = value.trim()
  const selected: SelectOption<string> | null = trimmed
    ? findBrandIgnoreCase(options, trimmed) ?? { value: trimmed, label: trimmed }
    : null

  function commit(raw: string) {
    onChange(canonicalizeBrand(raw, known))
  }

  return (
    <CreatableSelect<SelectOption<string>, false>
      options={options}
      value={selected}
      onChange={(opt) => commit(opt?.value ? String(opt.value) : '')}
      onCreateOption={(input) => commit(input)}
      placeholder={placeholder}
      isSearchable
      isClearable
      isDisabled={disabled}
      filterOption={(option, raw) => filterBrandOption(option.data, raw)}
      formatCreateLabel={(input) => {
        const canon = canonicalizeBrand(input, known)
        return findBrandIgnoreCase(options, input)
          ? `Usar marca: ${canon}`
          : `Nueva marca: ${canon}`
      }}
      styles={lepraStyles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      menuPosition="fixed"
      noOptionsMessage={() => 'Sin coincidencias — Enter para nueva marca'}
      classNamePrefix="lepra-select"
    />
  )
}
