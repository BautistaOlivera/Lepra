import { describe, expect, it } from 'vitest'
import {
  CONEXION_SIN,
  esErrorDependenciaSincronizacion,
  formatErrorParaUsuario,
} from './connectionLabels'

describe('formatErrorParaUsuario', () => {
  it('traduce Offline y errores legacy de sync', () => {
    expect(formatErrorParaUsuario('Offline')).toBe(CONEXION_SIN)
    expect(formatErrorParaUsuario('Esperando sync de product (42)')).toBe(
      'Esperando sincronización de producto (42)'
    )
  })
})

describe('esErrorDependenciaSincronizacion', () => {
  it('detecta mensajes de dependencia en español e inglés legacy', () => {
    expect(esErrorDependenciaSincronizacion('Esperando sync de user (-1)')).toBe(true)
    expect(esErrorDependenciaSincronizacion('Esperando sincronización de cliente (-1)')).toBe(true)
    expect(esErrorDependenciaSincronizacion('Error de red')).toBe(false)
  })
})
