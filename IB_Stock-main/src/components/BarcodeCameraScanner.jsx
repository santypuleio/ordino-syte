import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'

const SCAN_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_39,
]

/**
 * Modal de escaneo por cámara (ZXing).
 * Permisos se piden solo al abrir; prioriza cámara trasera.
 */
export default function BarcodeCameraScanner({ open, onDetected, onClose }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const handledRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  const onCloseRef = useRef(onClose)
  const [status, setStatus] = useState('starting')
  const [error, setError] = useState('')

  onDetectedRef.current = onDetected
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined

    handledRef.current = false
    setStatus('starting')
    setError('')

    let cancelled = false
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, SCAN_FORMATS)
    hints.set(DecodeHintType.TRY_HARDER, true)
    const reader = new BrowserMultiFormatReader(hints)

    const stopScanner = () => {
      try {
        controlsRef.current?.stop()
      } catch {
        /* ignore */
      }
      controlsRef.current = null
      try {
        BrowserMultiFormatReader.releaseAllStreams()
      } catch {
        /* ignore */
      }
    }

    ;(async () => {
      try {
        // Esperar un frame para que el <video> esté montado
        await new Promise((resolve) => requestAnimationFrame(() => resolve()))
        if (cancelled || !videoRef.current) return

        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result, _err, ctrl) => {
            if (cancelled || handledRef.current || !result) return
            const text = String(result.getText() || '').trim()
            if (!text) return

            handledRef.current = true
            try {
              ctrl?.stop()
            } catch {
              /* ignore */
            }
            controlsRef.current = null
            onDetectedRef.current?.(text)
            onCloseRef.current?.()
          },
        )

        if (cancelled) {
          controls.stop()
          return
        }

        controlsRef.current = controls
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        const denied =
          err?.name === 'NotAllowedError' ||
          err?.name === 'PermissionDeniedError' ||
          /permission|denied|NotAllowed/i.test(String(err?.message || err))
        setError(
          denied
            ? 'Permiso de cámara denegado. Habilitá la cámara en el navegador e intentá de nuevo.'
            : 'No se pudo abrir la cámara. Probá de nuevo o usá el lector / teclado.',
        )
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="barcode-camera-backdrop"
      onClick={() => onCloseRef.current?.()}
      role="presentation"
    >
      <section
        className="barcode-camera-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Escanear código de barras"
      >
        <div className="barcode-camera-header">
          <h3>Escanear código</h3>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => onClose()}>
            Cancelar
          </button>
        </div>

        <div className="barcode-camera-viewport">
          <video ref={videoRef} className="barcode-camera-video" muted playsInline autoPlay />
          <div className="barcode-camera-frame" aria-hidden="true" />
          {status === 'starting' ? (
            <p className="barcode-camera-overlay-msg">Abriendo cámara…</p>
          ) : null}
        </div>

        {error ? <p className="field-error barcode-camera-error">{error}</p> : null}
        {!error ? (
          <p className="barcode-camera-hint">Apuntá al código. Se cierra solo al leerlo.</p>
        ) : null}
      </section>
    </div>,
    document.body,
  )
}
