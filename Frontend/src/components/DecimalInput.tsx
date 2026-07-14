import { forwardRef } from 'react'
import { Form, type FormControlProps } from 'react-bootstrap'

/**
 * Input para decimales (peso, precio) compatible con Android 4.4 / Chrome 81.
 *
 * `type="number"` en muchos teclados legacy abre un pad **sin punto ni coma**,
 * y el navegador a veces rechaza esos caracteres. Usamos texto + hint decimal;
 * el parseo (`parseWeightInput`, `parseUnitPriceInput`) ya acepta `.` y `,`.
 */
export const DecimalInput = forwardRef<HTMLInputElement, FormControlProps>(
  function DecimalInput({ type: _type, inputMode, autoComplete, ...props }, ref) {
    return (
      <Form.Control
        ref={ref}
        type="text"
        inputMode={inputMode ?? 'decimal'}
        autoComplete={autoComplete ?? 'off'}
        {...props}
      />
    )
  },
)
