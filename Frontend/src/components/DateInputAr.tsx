import { forwardRef } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { es } from 'date-fns/locale/es'
import { Form, type FormControlProps } from 'react-bootstrap'
import { isoToPickerDate, pickerDateToIso } from '@/lib/formatDate'
import 'react-datepicker/dist/react-datepicker.css'

registerLocale('es-AR', es)

type DateInputArProps = Omit<FormControlProps, 'value' | 'onChange' | 'type'> & {
  /** Valor en formato API `YYYY-MM-DD` o vacío */
  value: string
  onChange: (iso: string) => void
}

const BootstrapInput = forwardRef<HTMLInputElement, FormControlProps>(function BootstrapInput(
  props,
  ref,
) {
  return <Form.Control {...props} ref={ref} />
})

/**
 * Fecha con calendario desplegable en formato argentino (dd/mm/aaaa).
 * El valor hacia el padre/API sigue siendo ISO `YYYY-MM-DD`.
 */
export function DateInputAr({ value, onChange, onBlur, className, ...rest }: DateInputArProps) {
  const selected = value ? isoToPickerDate(value) : null

  return (
    <DatePicker
      selected={selected}
      onChange={(date: Date | null) => {
        if (!date) {
          onChange('')
          return
        }
        onChange(pickerDateToIso(date))
      }}
      locale="es-AR"
      dateFormat="dd/MM/yyyy"
      placeholderText="dd/mm/aaaa"
      isClearable
      showPopperArrow={false}
      calendarStartDay={1}
      customInput={
        <BootstrapInput
          {...rest}
          className={className}
          autoComplete="off"
          onBlur={onBlur}
        />
      }
    />
  )
}
