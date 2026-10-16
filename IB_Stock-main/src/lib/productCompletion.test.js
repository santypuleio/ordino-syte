import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { IMPORT_PLACEHOLDER_IMAGE } from './productImport.js'
import { getProductCompletionStatus } from './productCompletion.js'

const complete = {
  producto: 'Yerba',
  precio: 100,
  stock: 4,
  categoria: 'Almacen',
  descripcion: 'Paquete de 1kg',
  imagenUrl: 'https://example.com/yerba.jpg',
  barcode: '',
}

describe('getProductCompletionStatus', () => {
  it('no muestra nada si la ficha recomendada está completa', () => {
    const status = getProductCompletionStatus(complete)
    assert.equal(status.show, false)
    assert.equal(status.count, 0)
  })

  it('no trata el código de barras vacío como pendiente', () => {
    const status = getProductCompletionStatus(complete)
    assert.equal(status.missing.some((item) => /barras|código/i.test(item.label)), false)
  })

  it('marca imagen placeholder', () => {
    const status = getProductCompletionStatus({ ...complete, imagenUrl: IMPORT_PLACEHOLDER_IMAGE })
    assert.equal(status.show, true)
    assert.ok(status.missing.some((item) => item.label === 'Falta imagen'))
  })

  it('marca descripción vacía o igual al nombre', () => {
    const empty = getProductCompletionStatus({ ...complete, descripcion: '' })
    const same = getProductCompletionStatus({ ...complete, descripcion: 'Yerba' })
    assert.ok(empty.missing.some((item) => item.label === 'Falta descripción'))
    assert.ok(same.missing.some((item) => item.label === 'Falta descripción'))
  })

  it('marca categoría vacía y no “General”', () => {
    const empty = getProductCompletionStatus({ ...complete, categoria: '' })
    const general = getProductCompletionStatus({ ...complete, categoria: 'General' })
    assert.ok(empty.missing.some((item) => item.label === 'Falta categoría'))
    assert.equal(general.show, false)
  })
})
