import { useState } from 'react'
import { getProductCompletionStatus } from '../lib/productCompletion'

export default function ProductCompletionHint({ product }) {
  const status = getProductCompletionStatus(product)
  const [open, setOpen] = useState(false)

  if (!status.show) return null

  return (
    <span className={`completion-hint${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="completion-hint-btn"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="completion-dot" aria-hidden="true" />
        Completar
      </button>
      <span className="completion-popover" role="tooltip">
        <strong>Podés completar esta ficha cuando quieras</strong>
        {status.missing.map((item) => (
          <span key={item.key}>{item.label}</span>
        ))}
      </span>
    </span>
  )
}
