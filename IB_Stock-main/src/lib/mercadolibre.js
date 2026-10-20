import { IMPORT_PLACEHOLDER_IMAGE, validateImport } from './productImport.js'

export const ML_AUTH_URL = 'https://auth.mercadolibre.com.ar/authorization'

export const ML_RETURN_ORIGINS = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://ordino-ar-stock.netlify.app',
  'https://stock.ordino.com.ar',
]

const ML_MAPPING = {
  name: '0',
  price: '1',
  stock: '2',
  barcode: '3',
  category: '4',
  description: '5',
}

export function safeReturnOrigin(value) {
  const origin = String(value || '').trim()
  return ML_RETURN_ORIGINS.includes(origin) ? origin : ''
}

export function buildMercadoLibreAuthUrl({ clientId, redirectUri, returnTo }) {
  const url = new URL(ML_AUTH_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', String(clientId || '').trim())
  url.searchParams.set('redirect_uri', String(redirectUri || '').trim())
  const origin = safeReturnOrigin(returnTo)
  if (origin) url.searchParams.set('state', origin)
  return url.toString()
}

export function safeProductImage(url) {
  try {
    const parsed = new URL(String(url || ''))
    if (parsed.protocol !== 'https:') return IMPORT_PLACEHOLDER_IMAGE
    return parsed.toString()
  } catch {
    return IMPORT_PLACEHOLDER_IMAGE
  }
}

export function reviewMercadoLibreItems(items, existingProducts) {
  const list = Array.isArray(items) ? items : []
  const matrix = [
    ['Nombre', 'Precio', 'Stock', 'Código de barras', 'Categoría', 'Descripción'],
    ...list.map((item) => [
      item?.name || '',
      item?.price == null ? '' : String(item.price),
      item?.stock == null ? '' : String(item.stock),
      item?.barcode || '',
      item?.category || '',
      item?.description || '',
    ]),
  ]
  const result = validateImport({
    matrix,
    headerRowIndex: 0,
    mapping: ML_MAPPING,
    existingProducts,
  })
  const images = new Map(list.map((item, index) => [index + 2, safeProductImage(item?.imageUrl)]))
  result.ready = result.ready.map((product) => ({
    ...product,
    imageUrl: images.get(product.rowNumber) || IMPORT_PLACEHOLDER_IMAGE,
  }))
  return result
}
