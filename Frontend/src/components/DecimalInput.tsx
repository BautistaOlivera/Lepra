import { forwardRef, useCallback, useRef } from 'react'
import { Button, Form, InputGroup, type FormControlProps } from 'react-bootstrap'
import { isLegacyClient } from '@/lib/legacyBrowser'

type DecimalInputProps = FormControlProps & {
  /** Botón "." para insertar separador. Default: activo en clientes legacy. */
  showSeparatorKey?: boolean
}

/**
 * Input decimal para Android 4.4 / Chrome 81 / tablets type tabE.
 *
 * En esos teclados `inputMode="decimal"` suele mostrar un pad con el "."
 * desactivado (a veces solo "," funciona, otras ninguna). Solución:
 * - sin `inputMode` en legacy → teclado completo
 * - botón "." junto al campo para insertar el separador
 *
 * El parseo del front ya acepta "." y ",".
 */
export const DecimalInput = forwardRef<HTMLInputElement, DecimalInputProps>(
  function DecimalInput(
    {
      type: _type,
      inputMode,
      autoComplete,
      showSeparatorKey,
      value,
      onChange,
      className,
      style,
      size,
      disabled,
      ...props
    },
    ref,
  ) {
    const legacy = isLegacyClient()
    /* Siempre mostrar el botón ".": en tabE el pad deja el punto desactivado aunque se quite inputMode. */
    const showKey = showSeparatorKey ?? true
    const inputRef = useRef<HTMLInputElement | null>(null)

    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
      },
      [ref],
    )

    function emit(next: string) {
      if (!onChange) return
      const fakeTarget = { value: next } as HTMLInputElement
      onChange({
        target: fakeTarget,
        currentTarget: fakeTarget,
      } as React.ChangeEvent<HTMLInputElement>)
    }

    function insertSeparator() {
      const current = String(value ?? '')
      if (/[.,]/.test(current)) {
        inputRef.current?.focus()
        return
      }
      emit(`${current}.`)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }

    const control = (
      <Form.Control
        ref={setRefs}
        type="text"
        /* Legacy: no pedir pad decimal — en tabE deja el "." gris / desactivado */
        inputMode={legacy ? undefined : (inputMode ?? 'decimal')}
        autoComplete={autoComplete ?? 'off'}
        value={value}
        onChange={onChange}
        className={showKey ? className : className}
        style={showKey ? undefined : style}
        size={size}
        disabled={disabled}
        {...props}
      />
    )

    if (!showKey) return control

    return (
      <InputGroup size={size} className="decimal-input-group" style={style}>
        {control}
        <Button
          type="button"
          variant="outline-secondary"
          className="decimal-input-sep-btn"
          onClick={insertSeparator}
          disabled={disabled}
          aria-label="Insertar punto decimal"
          title="Punto decimal (0.5)"
        >
          .
        </Button>
      </InputGroup>
    )
  },
)
