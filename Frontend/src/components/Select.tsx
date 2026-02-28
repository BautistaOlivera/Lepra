import ReactSelect, { StylesConfig, type CSSObjectWithLabel } from 'react-select'

export interface SelectOption<T = number | string> {
  value: T
  label: string
}

type FilterOptionFn<T> = (option: SelectOption<T>, inputValue: string) => boolean

interface SelectProps<T = number | string> {
  options: SelectOption<T>[]
  value: T | null | ''
  onChange: (value: T | null) => void
  placeholder?: string
  isSearchable?: boolean
  isClearable?: boolean
  filterOption?: FilterOptionFn<T> | null
  size?: 'sm' | 'lg'
  disabled?: boolean
  required?: boolean
}

const lepraStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderColor: state.isFocused ? 'var(--lepra-yellow-dark, #b38f00)' : '#dee2e6',
    boxShadow: state.isFocused ? '0 0 0 0.2rem rgba(230, 184, 0, 0.25)' : 'none',
    '&:hover': { borderColor: state.isFocused ? 'var(--lepra-yellow-dark)' : '#adb5bd' },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? 'var(--lepra-yellow-light, #ffe566)' : state.isFocused ? 'rgba(230, 184, 0, 0.15)' : base.backgroundColor,
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
}

function defaultFilterOption<T>(option: SelectOption<T>, inputValue: string): boolean {
  const label = String(option.label).toLowerCase()
  const search = inputValue
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  const labelNorm = label.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  return labelNorm.includes(search)
}

export function Select<T extends number | string = number | string>({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  isSearchable = true,
  isClearable = false,
  filterOption,
  size,
  disabled,
}: SelectProps<T>) {
  const selectedOption = value === '' || value === null
    ? null
    : options.find((o) => o.value === value) ?? null

  const computedStyles =
    size === 'sm'
      ? ({
          ...lepraStyles,
          control: (base: CSSObjectWithLabel, state: Parameters<NonNullable<typeof lepraStyles.control>>[1]) => ({
            ...lepraStyles.control!(base, state),
            minHeight: 31,
          }),
        } as unknown as StylesConfig<SelectOption<T>, false>)
      : (lepraStyles as unknown as StylesConfig<SelectOption<T>, false>)

  return (
    <ReactSelect<SelectOption<T>, false>
      options={options}
      value={selectedOption}
      onChange={(opt) => onChange(opt?.value ?? null)}
      placeholder={placeholder}
      isSearchable={isSearchable}
      isClearable={isClearable}
      filterOption={filterOption !== undefined ? filterOption : defaultFilterOption}
      isDisabled={disabled}
      styles={computedStyles}
      noOptionsMessage={() => 'Sin resultados'}
      classNamePrefix="lepra-select"
    />
  )
}
