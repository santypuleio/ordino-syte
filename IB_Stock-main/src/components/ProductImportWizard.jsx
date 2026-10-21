import { useEffect, useMemo, useRef, useState } from 'react'
import { readSpreadsheetFile } from '../lib/spreadsheet'
import {
  IMPORT_FIELDS,
  MAX_PREVIEW_ROWS,
  canStartImport,
  columnLetter,
  detectHeaderRow,
  headerLabels,
  mappingHasDuplicateColumns,
  suggestMapping,
  validateImport,
} from '../lib/productImport'
import { getProductCompletionStatus } from '../lib/productCompletion'
import { reviewMercadoLibreItems } from '../lib/mercadolibre'

const EMPTY_MAPPING = {
  name: '',
  price: '',
  stock: '',
  barcode: '',
  category: '',
  description: '',
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('es-AR')}`
}

export default function ProductImportWizard({
  open,
  onClose,
  onManual,
  onImport,
  products,
  signedIn,
  canWrite,
  businessId,
}) {
  const [step, setStep] = useState('source')
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [headerRow, setHeaderRow] = useState(0)
  const [headerTouched, setHeaderTouched] = useState(false)
  const [mapping, setMapping] = useState(EMPTY_MAPPING)
  const [result, setResult] = useState(null)
  const [addedCount, setAddedCount] = useState(0)
  const [fromMl, setFromMl] = useState(false)
  const popupRef = useRef(null)

  const sheet = sheets[sheetIndex] || null
  const matrix = sheet?.matrix || []
  const labels = useMemo(
    () => (matrix.length ? headerLabels(matrix, headerRow) : []),
    [matrix, headerRow],
  )

  const resetAll = () => {
    setStep('source')
    setReading(false)
    setImporting(false)
    setError('')
    setFileName('')
    setSheets([])
    setSheetIndex(0)
    setHeaderRow(0)
    setHeaderTouched(false)
    setMapping(EMPTY_MAPPING)
    setResult(null)
    setAddedCount(0)
    setFromMl(false)
  }

  const close = () => {
    resetAll()
    onClose?.()
  }

  const startMercadoLibre = () => {
    const gate = canStartImport({ signedIn, canWrite, businessId })
    if (!gate.ok) {
      setError(gate.message)
      return
    }
    const startUrl = new URL('https://ordino-ar-stock.netlify.app/.netlify/functions/ml-oauth-start')
    startUrl.searchParams.set('returnTo', window.location.origin)
    const popup = window.open(startUrl.toString(), 'ordino-ml', 'width=520,height=720')
    if (!popup) {
      setError('El navegador bloqueó la ventana de Mercado Libre. Permití ventanas emergentes.')
      return
    }
    popupRef.current = popup
    setFromMl(true)
    setError('')
    setStep('ml')
  }

  useEffect(() => {
    if (!open || step !== 'ml') return undefined
    const onMessage = (event) => {
      if (event.origin !== 'https://ordino-ar-stock.netlify.app' && event.origin !== 'https://stock.ordino.com.ar') {
        return
      }
      if (event.data?.source !== 'ordino-ml') return
      if (!event.data.ok) {
        setError(event.data.message || 'No se pudieron leer las publicaciones.')
        setStep('source')
        return
      }
      const reviewed = reviewMercadoLibreItems(event.data.items, products)
      setResult(reviewed)
      setFileName('Mercado Libre')
      setError(reviewed.tooLarge ? reviewed.message : '')
      setStep(reviewed.tooLarge ? 'source' : 'review')
    }
    window.addEventListener('message', onMessage)
    const timer = window.setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        window.clearInterval(timer)
      }
    }, 500)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(timer)
    }
  }, [open, step, products])

  const applySheet = (nextSheets, index, keepMapping = false) => {
    const next = nextSheets[index]
    if (!next) return
    const detected = detectHeaderRow(next.matrix)
    setSheetIndex(index)
    setHeaderRow(detected)
    setHeaderTouched(false)
    if (!keepMapping) setMapping(suggestMapping(next.matrix, detected))
  }

  const loadFile = async (file) => {
    if (!file) return
    setError('')
    setReading(true)
    setResult(null)
    try {
      const parsed = await readSpreadsheetFile(file)
      setFileName(file.name)
      setSheets(parsed.sheets)
      applySheet(parsed.sheets, 0)
      setStep('map')
    } catch (err) {
      setSheets([])
      setError(err?.message || 'No pudimos leer el archivo.')
      setStep('upload')
    } finally {
      setReading(false)
    }
  }

  const onHeaderChange = (value) => {
    const next = Math.max(0, Math.min(matrix.length - 1, Number(value) - 1 || 0))
    setHeaderRow(next)
    setHeaderTouched(true)
    setMapping(suggestMapping(matrix, next))
  }

  const onMapChange = (field, value) => {
    setMapping((prev) => {
      const next = { ...prev, [field]: value }
      if (value !== '') {
        IMPORT_FIELDS.forEach((item) => {
          if (item.key !== field && next[item.key] === value) next[item.key] = ''
        })
      }
      return next
    })
  }

  const goReview = () => {
    if (!mapping.name) {
      setError('Elegí qué columna es el nombre del producto.')
      return
    }
    if (mappingHasDuplicateColumns(mapping)) {
      setError('Dos datos no pueden usar la misma columna.')
      return
    }
    const permission = canStartImport({ signedIn, canWrite, businessId })
    if (!permission.ok) {
      setError(permission.message)
      return
    }
    const checked = validateImport({
      matrix,
      headerRowIndex: headerRow,
      mapping,
      existingProducts: products,
    })
    if (!checked.ok) {
      setError(checked.message)
      return
    }
    setError('')
    setResult(checked)
    setStep('review')
  }

  const confirmImport = async () => {
    if (!result?.ready?.length || importing) return
    const permission = canStartImport({ signedIn, canWrite, businessId })
    if (!permission.ok) {
      setError(permission.message)
      return
    }
    setImporting(true)
    setError('')
    try {
      const response = await onImport(result.ready)
      setAddedCount(response?.added || 0)
      setStep(result.errors.length || result.skippedExisting.length ? 'partial' : 'done')
    } catch (err) {
      setError(err?.message || 'No se pudo completar la importación.')
    } finally {
      setImporting(false)
    }
  }

  if (!open) return null

  const previewRows = matrix.slice(0, MAX_PREVIEW_ROWS)
  const columnCount = previewRows.reduce((max, row) => Math.max(max, row.length), labels.length)

  return (
    <div className="modal-backdrop import-backdrop" onClick={close} role="presentation">
      <section
        className="modal-card import-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Importar productos"
      >
        <div className="card-header">
          <div>
            <h2>Importar productos</h2>
            <p className="section-help">Excel o CSV. Nada se guarda hasta que confirmes.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={close}>
            Cerrar
          </button>
        </div>

        {error ? <p className="field-error import-banner">{error}</p> : null}

        {step === 'source' && (
          <div className="import-choices">
            <button type="button" className="import-choice" onClick={onManual}>
              <strong>Cargar manualmente</strong>
              <span>Un producto por vez, como siempre.</span>
            </button>
            <button type="button" className="import-choice import-choice-active" onClick={() => setStep('upload')}>
              <strong>Importar desde Excel / CSV</strong>
              <span>Subí tu planilla y relacioná las columnas.</span>
            </button>
            <button type="button" className="import-choice" disabled>
              <strong>Tiendanube</strong>
              <span>Próximamente</span>
            </button>
            <button type="button" className="import-choice" onClick={startMercadoLibre}>
              <strong>Mercado Libre</strong>
              <span>Traé las publicaciones de tu cuenta.</span>
            </button>
          </div>
        )}

        {step === 'ml' && (
          <div className="import-step">
            <strong>Esperando la autorización de Mercado Libre</strong>
            <p className="sale-scan-hint">
              Iniciá sesión en la ventana que se abrió y aceptá el permiso. Después vas a ver la lista antes de importar.
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep('source')}>
                Volver
              </button>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="import-step">
            <label
              className="import-drop"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                loadFile(event.dataTransfer.files?.[0])
              }}
            >
              <strong>{reading ? 'Leyendo archivo…' : 'Subí tu archivo de productos'}</strong>
              <span>Formatos compatibles: Excel y CSV</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => loadFile(event.target.files?.[0])}
                disabled={reading}
              />
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep('source')}>
                Volver
              </button>
            </div>
          </div>
        )}

        {step === 'map' && sheet && (
          <div className="import-step">
            <div className="import-file-meta">
              <span>{fileName}</span>
              {sheets.length > 1 ? (
                <label>
                  Hoja
                  <select
                    value={sheetIndex}
                    onChange={(event) => applySheet(sheets, Number(event.target.value))}
                  >
                    {sheets.map((item, index) => (
                      <option key={item.name} value={index}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <p className="import-detected">
              {headerTouched
                ? `Encabezados en la fila ${headerRow + 1}`
                : `Detectamos los encabezados en la fila ${headerRow + 1}`}
              <label className="import-header-change">
                Cambiar
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, matrix.length)}
                  value={headerRow + 1}
                  onChange={(event) => onHeaderChange(event.target.value)}
                />
              </label>
            </p>

            <div className="import-sheet-wrap">
              <table className="import-sheet">
                <thead>
                  <tr>
                    <th />
                    {Array.from({ length: columnCount }, (_, index) => (
                      <th key={columnLetter(index)}>{columnLetter(index)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === headerRow ? 'is-header-row' : ''}>
                      <th>{rowIndex + 1}</th>
                      {Array.from({ length: columnCount }, (_, index) => (
                        <td key={index}>{row[index] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {matrix.length > MAX_PREVIEW_ROWS ? (
              <p className="sale-scan-hint">Mostramos las primeras {MAX_PREVIEW_ROWS} filas.</p>
            ) : null}

            <h3 className="import-subtitle">Qué dato corresponde a cada columna</h3>
            <div className="import-map">
              {IMPORT_FIELDS.map((field) => (
                <label key={field.key}>
                  {field.label}
                  {field.required ? '' : ' (opcional)'}
                  <select value={mapping[field.key]} onChange={(event) => onMapChange(field.key, event.target.value)}>
                    <option value="">{field.required ? 'Elegí una columna' : 'No importar'}</option>
                    {labels.map((label, index) => (
                      <option key={`${label}-${index}`} value={String(index)}>
                        {columnLetter(index)} · {label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="sale-scan-hint">
              El nombre es obligatorio. Precio de costo y código interno no forman parte del producto en Ordino.
            </p>

            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={goReview}>
                Ver cómo van a quedar
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('upload')}>
                Volver
              </button>
            </div>
          </div>
        )}

        {step === 'review' && result && (
          <div className="import-step">
            <div className="import-counts">
              <span>{result.counts.found} productos encontrados</span>
              <span>{result.counts.ready} listos para importar</span>
              <span>{result.counts.review} con avisos</span>
              <span>{result.counts.ignored} se omiten</span>
            </div>

            <div className="import-result-list">
              {result.ready.slice(0, 8).map((item) => (
                <article key={`${item.rowNumber}-${item.title}`}>
                  <strong>{item.title}</strong>
                  <span>
                    {formatMoney(item.price)} · stock {item.stock}
                    {item.barcode ? ` · ${item.barcode}` : ''} · {item.category}
                  </span>
                </article>
              ))}
            </div>

            {result.errors.length ? (
              <div className="import-issues">
                <h3>No se van a importar</h3>
                {result.errors.slice(0, 12).map((item) => (
                  <p key={`e-${item.rowNumber}`}>
                    Fila {item.rowNumber}: {item.messages.join(', ')}
                  </p>
                ))}
              </div>
            ) : null}

            {result.skippedExisting.length ? (
              <div className="import-issues">
                <h3>{result.skippedExisting.length} ya están en tu comercio y se omiten</h3>
                <p className="sale-scan-hint">No modificamos productos existentes.</p>
                {result.skippedExisting.slice(0, 8).map((item) => (
                  <p key={`s-${item.rowNumber}`}>
                    Fila {item.rowNumber}: {item.name} — {item.reason}
                  </p>
                ))}
              </div>
            ) : null}

            {result.warnings.length ? (
              <div className="import-issues import-issues-warn">
                <h3>Avisos</h3>
                {result.warnings.slice(0, 8).map((item) => (
                  <p key={`w-${item.rowNumber}`}>
                    Fila {item.rowNumber}: {item.messages.join(', ')}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmImport}
                disabled={!result.ready.length || importing}
              >
                {importing ? 'Importando…' : `Importar ${result.ready.length} productos nuevos`}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(fromMl ? 'source' : 'map')}
                disabled={importing}
              >
                {fromMl ? 'Volver' : 'Corregir columnas'}
              </button>
            </div>
          </div>
        )}

        {(step === 'done' || step === 'partial') && (
          <div className="import-step import-success">
            <h3>{step === 'partial' ? 'Importación parcial' : 'Importación completada'}</h3>
            <p>{addedCount} productos fueron agregados correctamente.</p>
            <p>Tus productos ya están listos para usar.</p>
            {(result?.ready || []).some((item) =>
              getProductCompletionStatus({
                producto: item.title,
                descripcion: item.description,
                categoria: item.category,
                imagenUrl: item.imageUrl,
              }).show,
            ) ? (
              <p className="sale-scan-hint">
                Algunos tienen datos opcionales que podés completar más adelante.
              </p>
            ) : null}
            {step === 'partial' ? (
              <p className="sale-scan-hint">
                Algunas filas no se importaron. Los productos que ya existían no se modificaron.
              </p>
            ) : null}
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={close}>
                Ver productos
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetAll}>
                Importar otro archivo
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
