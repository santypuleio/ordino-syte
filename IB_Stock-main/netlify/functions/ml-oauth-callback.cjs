const RETURN_ORIGINS = new Set([
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://ordino-ar-stock.netlify.app',
  'https://stock.ordino.com.ar',
])

const MAX_ITEMS = 5000

function page(title, body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: `<!doctype html><html lang="es"><meta charset="utf-8"><title>${title}</title><body style="font-family:sans-serif;padding:24px">${body}</body></html>`,
  }
}

function safeOrigin(value) {
  const origin = String(value || '').trim()
  return RETURN_ORIGINS.has(origin) ? origin : ''
}

function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function donePage(returnTo, payload) {
  return page(
    'Ordino',
    `<p>Listo. Volvé a Ordino para revisar los productos.</p>
<script>
  const payload = ${scriptJson(payload)};
  const target = ${scriptJson(returnTo)};
  if (window.opener && target) {
    window.opener.postMessage(Object.assign({ source: 'ordino-ml' }, payload), target);
    setTimeout(function () { window.close(); }, 400);
  }
</script>`,
  )
}

async function mlFetch(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.message || data.error || `Mercado Libre respondió ${response.status}`
    throw new Error(message)
  }
  return data
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.ML_CLIENT_ID || '',
    client_secret: process.env.ML_CLIENT_SECRET || '',
    code,
    redirect_uri: process.env.ML_REDIRECT_URI || '',
  })
  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.access_token) {
    throw new Error(data.message || data.error_description || data.error || 'No se pudo autorizar Mercado Libre.')
  }
  return data.access_token
}

function barcodeFromItem(item) {
  const attributes = Array.isArray(item.attributes) ? item.attributes : []
  const hit = attributes.find((attribute) =>
    ['GTIN', 'EAN', 'UPC', 'ISBN'].includes(String(attribute.id || '').toUpperCase()),
  )
  return hit?.value_name || ''
}

function mapItem(item) {
  const picture = item.pictures?.[0]?.secure_url || item.secure_thumbnail || item.thumbnail || ''
  return {
    name: item.title || '',
    price: item.price ?? '',
    stock: item.available_quantity ?? '',
    barcode: barcodeFromItem(item),
    category: '',
    description: '',
    imageUrl: String(picture).startsWith('https://') ? picture : '',
  }
}

async function listItemIds(token, userId) {
  const ids = []
  let scrollId = ''
  while (ids.length < MAX_ITEMS) {
    const url = new URL(`https://api.mercadolibre.com/users/${userId}/items/search`)
    url.searchParams.set('search_type', 'scan')
    url.searchParams.set('limit', '100')
    if (scrollId) url.searchParams.set('scroll_id', scrollId)
    const data = await mlFetch(url, token)
    const batch = Array.isArray(data.results) ? data.results : []
    ids.push(...batch)
    if (!data.scroll_id || batch.length === 0) break
    scrollId = data.scroll_id
  }
  return ids.slice(0, MAX_ITEMS)
}

async function loadItems(token, ids) {
  const items = []
  for (let index = 0; index < ids.length; index += 20) {
    const slice = ids.slice(index, index + 20)
    const url = `https://api.mercadolibre.com/items?ids=${slice.map(encodeURIComponent).join(',')}`
    const rows = await mlFetch(url, token)
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row.code === 200 && row.body) items.push(mapItem(row.body))
    }
  }
  return items
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {}
  const returnTo = safeOrigin(params.state) || 'https://ordino-ar-stock.netlify.app'

  if (params.error) {
    return donePage(returnTo, { ok: false, message: 'Se canceló la autorización de Mercado Libre.' })
  }
  if (!params.code) {
    return page('Ordino', '<p>Falta el código de autorización de Mercado Libre.</p>', 400)
  }
  if (!process.env.ML_CLIENT_ID || !process.env.ML_CLIENT_SECRET || !process.env.ML_REDIRECT_URI) {
    return donePage(returnTo, {
      ok: false,
      message: 'Faltan las claves de Mercado Libre en el servidor.',
    })
  }

  try {
    const token = await exchangeCode(params.code)
    const me = await mlFetch('https://api.mercadolibre.com/users/me', token)
    const ids = await listItemIds(token, me.id)
    const items = await loadItems(token, ids)
    return donePage(returnTo, { ok: true, items })
  } catch (error) {
    return donePage(returnTo, {
      ok: false,
      message: error?.message || 'No se pudieron leer las publicaciones.',
    })
  }
}
