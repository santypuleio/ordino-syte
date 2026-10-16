/**
 * Importación de productos desde planilla (Excel/CSV).
 * Pura: no toca Firebase. El caller pasa solo productos del comercio actual.
 *
 * Campos reales del producto Ordino:
 * title, price, stock, barcode, category, description, imageUrl.
 * No hay SKU ni precio de costo en el documento de producto.
 */

import { isValidBarcodeFormat, normalizeBarcode } from './barcode.js'

export const MAX_IMPORT_ROWS = 5000
export const MAX_PREVIEW_ROWS = 30
export const IMPORT_PLACEHOLDER_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="#111827" width="80" height="80"/><text x="40" y="46" text-anchor="middle" fill="#22c55e" font-size="11" font-family="sans-serif">Ordino</text></svg>',
  )

export const IMPORT_FIELDS = [
  { key: 'name', label: 'Nombre del producto', required: true },
  { key: 'price', label: 'Precio de venta', required: false },
  { key: 'stock', label: 'Stock', required: false },
  { key: 'barcode', label: 'Código de barras', required: false },
  { key: 'category', label: 'Categoría', required: false },
  { key: 'description', label: 'Descripción', required: false },
]

const SYNONYMS = {
  barcode: [
    'codigo de barras',
    'código de barras',
    'barcode',
    'ean13',
    'ean 13',
    'ean',
    'upc',
    'gtin',
    'cod barras',
    'cod. barras',
  ],
  name: [
    'producto',
    'nombre',
    'articulo',
    'artículo',
    'item',
    'ítem',
    'titulo',
    'título',
    'descripcion',
    'descripción',
  ],
  price: [
    'precio venta',
    'precio de venta',
    'p venta',
    'p. venta',
    'pvp',
    'precio final',
    'precio',
    'valor',
    'importe',
  ],
  stock: ['stock', 'cantidad', 'existencia', 'existencias', 'disponible', 'unidades', 'qty'],
  category: ['categoria', 'categoría', 'rubro', 'familia', 'grupo'],
  description: ['detalle', 'detalles', 'observacion', 'observación', 'comentario'],
}

export function foldText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function sanitizeText(value, max = 300) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function columnLetter(index) {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function canStartImport({ signedIn, canWrite, businessId }) {
  if (!signedIn || !businessId || !canWrite) {
    return {
      ok: false,
      message: 'No tenés permiso para importar productos en este comercio.',
    }
  }
  return { ok: true }
}

/** CSV simple: respeta comillas y no convierte números. */
export function detectDelimiter(text) {
  const sample = String(text || '')
    .split(/\r?\n/)
    .slice(0, 8)
    .join('\n')
  const counts = {
    ',': (sample.match(/,/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length,
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

export function parseCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '')
  if (!raw.trim()) return []
  const delimiter = detectDelimiter(raw)
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    const next = raw[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === delimiter) {
      row.push(cell.trim())
      cell = ''
      continue
    }
    if (ch === '\n') {
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    if (ch === '\r') continue
    cell += ch
  }
  if (cell.length || row.length) {
    row.push(cell.trim())
    rows.push(row)
  }
  return trimMatrix(rows)
}

function trimMatrix(rows) {
  const matrix = rows.map((row) => row.map((cell) => sanitizeText(cell, 500)))
  let last = matrix.length - 1
  while (last >= 0 && matrix[last].every((cell) => !cell)) last -= 1
  return matrix.slice(0, last + 1)
}

function rowNonEmpty(row) {
  return (row || []).some((cell) => String(cell || '').trim())
}

function synonymScore(field, header) {
  const folded = foldText(header)
  if (!folded) return 0
  const list = SYNONYMS[field] || []
  for (const synonym of list) {
    const target = foldText(synonym)
    if (folded === target) return 3
  }
  for (const synonym of list) {
    const target = foldText(synonym)
    if (target.length >= 4 && (folded.includes(target) || target.includes(folded))) return 2
  }
  return 0
}

export function detectHeaderRow(matrix) {
  const limit = Math.min(matrix.length, 25)
  let bestIndex = 0
  let bestScore = -1
  for (let i = 0; i < limit; i += 1) {
    const row = matrix[i] || []
    const filled = row.filter((cell) => String(cell || '').trim())
    if (filled.length < 2) continue
    let score = filled.length
    for (const cell of filled) {
      const text = String(cell)
      const numeric = /^-?\d+([.,]\d+)?$/.test(text.replace(/\s/g, ''))
      if (!numeric) score += 1
      for (const field of Object.keys(SYNONYMS)) {
        score += synonymScore(field, text) * 4
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }
  if (bestScore < 0) {
    const fallback = matrix.findIndex((row) => rowNonEmpty(row))
    return fallback >= 0 ? fallback : 0
  }
  return bestIndex
}

export function headerLabels(matrix, headerRowIndex) {
  const row = matrix[headerRowIndex] || []
  const seen = new Map()
  return row.map((cell, index) => {
    const base = sanitizeText(cell, 80) || `Columna ${columnLetter(index)}`
    const count = (seen.get(foldText(base)) || 0) + 1
    seen.set(foldText(base), count)
    return count === 1 ? base : `${base} (${count})`
  })
}

function columnSamples(matrix, headerRowIndex, columnIndex) {
  const values = []
  for (let r = headerRowIndex + 1; r < matrix.length && values.length < 40; r += 1) {
    const value = String(matrix[r]?.[columnIndex] ?? '').trim()
    if (value) values.push(value)
  }
  return values
}

function looksLikeBarcodeColumn(samples) {
  if (samples.length < 2) return false
  const hits = samples.filter((value) => /^\d{8,14}$/.test(value.replace(/\s/g, ''))).length
  return hits / samples.length >= 0.7
}

function looksLikeStockColumn(samples) {
  if (samples.length < 2) return false
  const hits = samples.filter((value) => {
    const parsed = parseLocalizedNumber(value)
    return parsed.ok && Number.isInteger(parsed.value) && parsed.value >= 0 && parsed.value < 100000
  }).length
  return hits / samples.length >= 0.7
}

function looksLikePriceColumn(samples) {
  if (samples.length < 2) return false
  const hits = samples.filter((value) => {
    const parsed = parseLocalizedNumber(value)
    return parsed.ok && parsed.value >= 0 && !Number.isInteger(parsed.value)
  }).length
  return hits / samples.length >= 0.6
}

export function suggestMapping(matrix, headerRowIndex) {
  const headers = headerLabels(matrix, headerRowIndex)
  const mapping = {
    name: '',
    price: '',
    stock: '',
    barcode: '',
    category: '',
    description: '',
  }
  const used = new Set()
  const fields = ['barcode', 'name', 'price', 'stock', 'category', 'description']

  fields.forEach((field) => {
    let best = -1
    let bestScore = 0
    headers.forEach((header, index) => {
      if (used.has(index)) return
      const score = synonymScore(field, header)
      if (score > bestScore) {
        bestScore = score
        best = index
      }
    })
    if (best >= 0 && bestScore > 0) {
      mapping[field] = String(best)
      used.add(best)
    }
  })

  headers.forEach((_, index) => {
    if (used.has(index)) return
    const samples = columnSamples(matrix, headerRowIndex, index)
    if (!mapping.barcode && looksLikeBarcodeColumn(samples)) {
      mapping.barcode = String(index)
      used.add(index)
      return
    }
    if (!mapping.price && looksLikePriceColumn(samples)) {
      mapping.price = String(index)
      used.add(index)
      return
    }
    if (!mapping.stock && looksLikeStockColumn(samples)) {
      mapping.stock = String(index)
      used.add(index)
    }
  })

  return mapping
}

export function parseLocalizedNumber(raw) {
  if (raw == null || String(raw).trim() === '') return { ok: false, empty: true, value: null }
  let source = String(raw)
    .trim()
    .replace(/\s/g, '')
    .replace(/[$€]/g, '')
    .replace(/^ars/i, '')
  if (!/^[-+]?\d[\d.,]*$/.test(source)) return { ok: false, empty: false, value: null }
  const negative = source.startsWith('-')
  source = source.replace(/^[-+]/, '')
  const lastComma = source.lastIndexOf(',')
  const lastDot = source.lastIndexOf('.')
  let normalized = source
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? source.replace(/\./g, '').replace(',', '.')
        : source.replace(/,/g, '')
  } else if (lastComma >= 0) {
    const parts = source.split(',')
    normalized =
      parts.length === 2 && parts[1].length <= 2
        ? `${parts[0].replace(/\./g, '')}.${parts[1]}`
        : source.replace(/,/g, '')
  } else if (lastDot >= 0) {
    const parts = source.split('.')
    const grouped = parts.length > 2 || (parts.length === 2 && parts[1].length === 3)
    normalized = grouped ? source.replace(/\./g, '') : source
  }
  const value = Number(normalized)
  if (!Number.isFinite(value)) return { ok: false, empty: false, value: null }
  return { ok: true, empty: false, value: negative ? -value : value }
}

function cellAt(row, mappingValue) {
  if (mappingValue === '' || mappingValue == null) return ''
  const index = Number(mappingValue)
  if (!Number.isInteger(index) || index < 0) return ''
  return sanitizeText(row?.[index] ?? '', 500)
}

function sameName(a, b) {
  return foldText(a) !== '' && foldText(a) === foldText(b)
}

export function validateImport({ matrix, headerRowIndex, mapping, existingProducts }) {
  const catalog = Array.isArray(existingProducts) ? existingProducts : []
  const dataRows = (matrix || []).slice((headerRowIndex ?? 0) + 1)
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      tooLarge: true,
      message: `El archivo tiene más de ${MAX_IMPORT_ROWS} filas. Dividilo e importá por partes.`,
      ready: [],
      errors: [],
      warnings: [],
      skippedExisting: [],
      counts: { found: dataRows.length, ready: 0, review: 0, ignored: dataRows.length },
    }
  }

  const ready = []
  const errors = []
  const warnings = []
  const skippedExisting = []
  const seenBarcodes = new Map()
  const seenNames = new Map()
  let ignoredEmpty = 0

  dataRows.forEach((row, offset) => {
    const rowNumber = (headerRowIndex ?? 0) + offset + 2
    if (!rowNonEmpty(row)) {
      ignoredEmpty += 1
      return
    }

    const issues = []
    const notes = []
    const name = cellAt(row, mapping?.name)
    const priceRaw = cellAt(row, mapping?.price)
    const stockRaw = cellAt(row, mapping?.stock)
    const barcodeRaw = cellAt(row, mapping?.barcode)
    const categoryRaw = cellAt(row, mapping?.category)
    const descriptionRaw = cellAt(row, mapping?.description)

    if (!name) issues.push('falta el nombre')

    let price = 0
    if (mapping?.price === '' || mapping?.price == null) {
      notes.push('sin columna de precio: se guarda en $0')
    } else if (!priceRaw) {
      issues.push('precio vacío')
    } else {
      const parsed = parseLocalizedNumber(priceRaw)
      if (!parsed.ok || parsed.value < 0) issues.push('precio no válido')
      else price = parsed.value
    }

    let stock = 0
    if (mapping?.stock === '' || mapping?.stock == null) {
      notes.push('sin columna de stock: se guarda en 0')
    } else if (!stockRaw) {
      notes.push('stock vacío: se guarda en 0')
    } else {
      const parsed = parseLocalizedNumber(stockRaw)
      if (!parsed.ok || parsed.value < 0 || !Number.isInteger(parsed.value)) issues.push('stock no válido')
      else stock = parsed.value
    }

    let barcode = ''
    if (barcodeRaw) {
      if (/e\+|e-/i.test(barcodeRaw)) {
        issues.push('el código se leyó en notación científica. Guardalo como texto en el Excel')
      } else {
        barcode = normalizeBarcode(barcodeRaw)
        if (!isValidBarcodeFormat(barcode)) issues.push('código de barras no válido')
      }
    }

    let category = categoryRaw
    if (!category) {
      category = 'General'
      notes.push('sin categoría: se usa “General”')
    }
    let description = descriptionRaw
    if (!description) {
      description = name || 'Sin descripción'
      notes.push('sin descripción: se usa el nombre')
    }

    if (barcode && seenBarcodes.has(barcode)) {
      issues.push(`código de barras repetido (también en la fila ${seenBarcodes.get(barcode)})`)
    }
    if (name && seenNames.has(foldText(name))) {
      notes.push(`nombre repetido en el archivo (fila ${seenNames.get(foldText(name))})`)
    }

    const existingBarcode = barcode
      ? catalog.find((product) => normalizeBarcode(product?.barcode) === barcode)
      : null
    const existingName = name
      ? catalog.find((product) => sameName(product?.producto || product?.title, name))
      : null

    if (name) seenNames.set(foldText(name), rowNumber)
    if (barcode) seenBarcodes.set(barcode, rowNumber)

    if (issues.length) {
      errors.push({ rowNumber, messages: issues, name })
      return
    }

    if (existingBarcode || existingName) {
      skippedExisting.push({
        rowNumber,
        name,
        reason: existingBarcode
          ? `el código ya está en “${existingBarcode.producto || existingBarcode.title || 'otro producto'}”`
          : 'ya hay un producto con este nombre',
      })
      return
    }

    const product = {
      title: sanitizeText(name, 180),
      price,
      stock,
      barcode: barcode || null,
      category: sanitizeText(category, 80),
      description: sanitizeText(description, 2000),
      imageUrl: IMPORT_PLACEHOLDER_IMAGE,
      rowNumber,
      notes,
    }
    ready.push(product)
    if (notes.length) warnings.push({ rowNumber, messages: notes, name: product.title })
  })

  const found = dataRows.length - ignoredEmpty
  return {
    ok: true,
    tooLarge: false,
    ready,
    errors,
    warnings,
    skippedExisting,
    counts: {
      found,
      ready: ready.length,
      review: warnings.length,
      ignored: errors.length + skippedExisting.length,
    },
  }
}

export function mappingHasDuplicateColumns(mapping) {
  const values = Object.values(mapping || {}).filter((value) => value !== '' && value != null)
  return new Set(values).size !== values.length
}
