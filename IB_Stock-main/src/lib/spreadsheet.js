import * as XLSX from 'xlsx'
import { MAX_IMPORT_ROWS, parseCsv, sanitizeText } from './productImport.js'

const ALLOWED = new Set(['xlsx', 'xls', 'csv'])
const MAX_BYTES = 8 * 1024 * 1024

function extensionOf(name) {
  const parts = String(name || '').toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() : ''
}

function plainNumber(value) {
  if (!Number.isFinite(value)) return ''
  if (Number.isInteger(value)) return String(value)
  return String(value)
}

function cellToText(cell) {
  if (!cell || cell.v == null) return ''
  if (cell.t === 'n' && typeof cell.v === 'number') {
    const formatted = cell.w != null ? String(cell.w).trim() : ''
    if (formatted && !/e\+|e-/i.test(formatted)) return sanitizeText(formatted, 500)
    return sanitizeText(plainNumber(cell.v), 500)
  }
  if (cell.w != null && !/e\+|e-/i.test(String(cell.w))) return sanitizeText(cell.w, 500)
  return sanitizeText(cell.v, 500)
}

export function sheetToMatrix(sheet) {
  if (!sheet || !sheet['!ref']) return []
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const rows = []
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row = []
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      row.push(cellToText(cell))
    }
    rows.push(row)
  }
  let last = rows.length - 1
  while (last >= 0 && rows[last].every((cell) => !String(cell || '').trim())) last -= 1
  return rows.slice(0, last + 1)
}

export async function readSpreadsheetFile(file) {
  const ext = extensionOf(file?.name)
  if (ext === 'xlsm' || ext === 'xlsb') {
    throw new Error('Ese formato puede incluir macros. Guardá el archivo como .xlsx o .csv.')
  }
  if (!ALLOWED.has(ext)) {
    throw new Error('Formato no compatible. Usá Excel (.xlsx, .xls) o CSV.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('El archivo es demasiado grande (máximo 8 MB).')
  }

  const buffer = await file.arrayBuffer()
  if (ext === 'csv') {
    const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '')
    const matrix = parseCsv(text)
    if (!matrix.length) throw new Error('El archivo no tiene filas para importar.')
    if (matrix.length > MAX_IMPORT_ROWS + 30) {
      throw new Error(`El archivo supera las ${MAX_IMPORT_ROWS} filas. Dividilo e importá por partes.`)
    }
    return { sheets: [{ name: 'CSV', matrix }] }
  }

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, dense: false })
  const sheets = (workbook.SheetNames || [])
    .map((name) => ({
      name,
      matrix: sheetToMatrix(workbook.Sheets[name]),
    }))
    .filter((sheet) => sheet.matrix.some((row) => row.some((cell) => String(cell || '').trim())))

  if (!sheets.length) throw new Error('No encontramos hojas con datos.')
  const oversized = sheets.find((sheet) => sheet.matrix.length > MAX_IMPORT_ROWS + 30)
  if (oversized) {
    throw new Error(
      `La hoja “${oversized.name}” supera las ${MAX_IMPORT_ROWS} filas. Dividila e importá por partes.`,
    )
  }
  return { sheets }
}
