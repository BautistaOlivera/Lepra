import { useEffect, useState } from 'react'
import { Form, type FormControlProps } from 'react-bootstrap'
import { displayDateToIso, isoDateToDisplay } from '@/lib/formatDate'

type DateInputArProps = Omit<FormControlProps, 'value' | 'onChange' | 'type'> & {
  /** Valor en formato API `YYYY-MM-DD` o vacío */
  value: string
  onChange: (iso: string) => void
}

/**
 * Campo de fecha con máscara visual dd/mm/aaaa.
 * El valor hacia el padre/API sigue siendo ISO `YYYY-MM-DD` (compatible con el backend).
 */
export function DateInputAr({ value, onChange, onBlur, ...rest }: DateInputArProps) {
  const [text, setText] = useState(() => isoDateToDisplay(value))

  useEffect(() => {
    setText(isoDateToDisplay(value))
  }, [value])

  function commit(nextText: string) {
    const trimmed = nextText.trim()
    if (!trimmed) {
      onChange('')
      setText('')
      return
    }
    const iso = displayDateToIso(trimmed)
    if (iso) {
      onChange(iso)
      setText(isoDateToDisplay(iso))
    } else {
      setText(isoDateToDisplay(value))
    }
  }

  return (
    <Form.Control
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => {
        commit(e.target.value)
        onBlur?.(e)
      }}
    />
  )
}
