import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import {
  canStartImport,
  detectHeaderRow,
  headerLabels,
  parseCsv,
  parseLocalizedNumber,
  suggestMapping,
  validateImport,
  mappingHasDuplicateColumns,
} from './productImport.js'
import { sheetToMatrix } from './spreadsheet.js'

const simpleCsv = `Producto,Precio,Stock,EAN,Rubro
Filtro X,8500,12,07791234567890,Motor
Filtro Y,"9.200",8,7790000000001,Motor
`

describe('CSV simple', () => {
  it('lee texto y conserva el cero inicial del código', () => {
    const matrix = parseCsv(simpleCsv)
    const header = detectHeaderRow(matrix)
    assert.equal(header, 0)
    const mapping = suggestMapping(matrix, header)
    assert.equal(headerLabels(matrix, header)[Number(mapping.name)], 'Producto')
    assert.equal(headerLabels(matrix, header)[Number(mapping.barcode)], 'EAN')
    const result = validateImport({ matrix, headerRowIndex: header, mapping, existingProducts: [] })
    assert.equal(result.counts.ready, 2)
    assert.equal(result.ready[0].barcode, '07791234567890')
    assert.equal(result.ready[0].price, 8500)
    assert.equal(result.ready[1].price, 9200)
  })
})

describe('encabezado en otra fila', () => {
  it('detecta la fila de títulos y no usa el título de la planilla', () => {
    const matrix = [
      ['LISTA OCTUBRE', '', ''],
      ['Actualizado 16/10', '', ''],
      ['', '', ''],
      ['Articulo', 'P. Venta', 'Cantidad'],
      ['Aceite', '1500', '4'],
    ]
    const header = detectHeaderRow(matrix)
    assert.equal(header, 3)
    const mapping = suggestMapping(matrix, header)
    const result = validateImport({ matrix, headerRowIndex: header, mapping, existingProducts: [] })
    assert.equal(result.ready[0].title, 'Aceite')
    assert.equal(result.ready[0].price, 1500)
    assert.equal(result.ready[0].stock, 4)
  })
})

describe('columnas con otros nombres y mapeo manual', () => {
  it('sugiere rubro como categoría y permite remapear', () => {
    const matrix = [
      ['Item', 'Valor', 'Unidades', 'Familia'],
      ['Yerba', '4500', '10', 'Almacen'],
    ]
    const suggested = suggestMapping(matrix, 0)
    assert.equal(suggested.name, '0')
    assert.equal(suggested.category, '3')
    const manual = { ...suggested, price: '1', stock: '2' }
    const result = validateImport({ matrix, headerRowIndex: 0, mapping: manual, existingProducts: [] })
    assert.equal(result.ready[0].category, 'Almacen')
    assert.equal(result.ready[0].price, 4500)
  })
})

describe('validaciones', () => {
  const mapping = { name: '0', price: '1', stock: '2', barcode: '3', category: '4', description: '' }

  it('precio inválido, stock inválido y filas vacías', () => {
    const matrix = [
      ['Producto', 'Precio', 'Stock', 'EAN', 'Rubro'],
      ['Ok', '100', '2', '', 'Kiosco'],
      ['', '', '', '', ''],
      ['Sin precio', '', '1', '', 'Kiosco'],
      ['Mal stock', '10', 'dos', '', 'Kiosco'],
      ['Negativo', '-5', '1', '', 'Kiosco'],
    ]
    const result = validateImport({ matrix, headerRowIndex: 0, mapping, existingProducts: [] })
    assert.equal(result.counts.ready, 1)
    assert.ok(result.errors.some((row) => row.messages.includes('precio vacío')))
    assert.ok(result.errors.some((row) => row.messages.includes('stock no válido')))
    assert.ok(result.errors.some((row) => row.messages.includes('precio no válido')))
  })

  it('barcode duplicado dentro del archivo', () => {
    const matrix = [
      ['Producto', 'Precio', 'Stock', 'EAN', 'Rubro'],
      ['A', '10', '1', '779', 'G'],
      ['B', '10', '1', '779', 'G'],
    ]
    const result = validateImport({ matrix, headerRowIndex: 0, mapping, existingProducts: [] })
    assert.equal(result.ready.length, 1)
    assert.ok(result.errors[0].messages[0].includes('repetido'))
  })

  it('omite productos que ya existen en ESTE comercio', () => {
    const matrix = [
      ['Producto', 'Precio', 'Stock', 'EAN', 'Rubro'],
      ['Yerba', '10', '1', '779111', 'G'],
      ['Nuevo', '10', '1', '779222', 'G'],
    ]
    const existing = [{ id: 'p1', producto: 'Yerba vieja', barcode: '779111' }]
    const result = validateImport({ matrix, headerRowIndex: 0, mapping, existingProducts: existing })
    assert.equal(result.skippedExisting.length, 1)
    assert.equal(result.ready.length, 1)
    assert.equal(result.ready[0].title, 'Nuevo')
  })

  it('el mismo barcode en otro comercio no bloquea si no se pasa ese catálogo', () => {
    const matrix = [
      ['Producto', 'Precio', 'Stock', 'EAN', 'Rubro'],
      ['Local', '10', '1', '555', 'G'],
    ]
    const otherBusiness = [{ id: 'x', producto: 'Ajeno', barcode: '555' }]
    const result = validateImport({
      matrix,
      headerRowIndex: 0,
      mapping,
      existingProducts: [],
    })
    assert.equal(result.ready.length, 1)
    assert.equal(otherBusiness[0].barcode, '555')
  })
})

describe('permisos', () => {
  it('bloquea si no puede escribir o no hay comercio', () => {
    assert.equal(canStartImport({ signedIn: false, canWrite: true, businessId: 'a' }).ok, false)
    assert.equal(canStartImport({ signedIn: true, canWrite: false, businessId: 'a' }).ok, false)
    assert.equal(canStartImport({ signedIn: true, canWrite: true, businessId: '' }).ok, false)
    assert.equal(canStartImport({ signedIn: true, canWrite: true, businessId: 'tienda' }).ok, true)
  })
})

describe('Excel', () => {
  it('lee una hoja, conserva texto y permite elegir entre varias hojas', () => {
    const book = XLSX.utils.book_new()
    const cover = XLSX.utils.aoa_to_sheet([['Portada']])
    const data = XLSX.utils.aoa_to_sheet([
      ['Artículo', 'P. Venta', 'Cantidad'],
      ['Filtro', 8500, 3],
    ])
    const barcode = XLSX.utils.aoa_to_sheet([['Codigo de barras'], ['000123456789']])
    barcode.A2.t = 's'
    barcode.A2.v = '000123456789'
    barcode.A2.w = '000123456789'
    XLSX.utils.book_append_sheet(book, cover, 'Portada')
    XLSX.utils.book_append_sheet(book, data, 'Productos')
    XLSX.utils.book_append_sheet(book, barcode, 'Codigos')

    const productos = sheetToMatrix(book.Sheets.Productos)
    assert.equal(detectHeaderRow(productos), 0)
    const mapping = suggestMapping(productos, 0)
    const result = validateImport({
      matrix: productos,
      headerRowIndex: 0,
      mapping,
      existingProducts: [],
    })
    assert.equal(result.ready[0].title, 'Filtro')
    assert.equal(result.ready[0].stock, 3)

    const codes = sheetToMatrix(book.Sheets.Codigos)
    assert.equal(codes[1][0], '000123456789')
    assert.equal(book.SheetNames.length, 3)
  })
})

describe('números y columnas', () => {
  it('interpreta miles con punto', () => {
    assert.equal(parseLocalizedNumber('$ 8.500').value, 8500)
    assert.equal(parseLocalizedNumber('8.500,50').value, 8500.5)
  })

  it('detecta dos campos en la misma columna', () => {
    assert.equal(mappingHasDuplicateColumns({ name: '0', price: '0', stock: '' }), true)
    assert.equal(mappingHasDuplicateColumns({ name: '0', price: '1', stock: '' }), false)
  })
})
