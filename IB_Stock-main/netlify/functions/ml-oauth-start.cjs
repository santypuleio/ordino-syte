const RETURN_ORIGINS = new Set([
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://ordino-ar-stock.netlify.app',
  'https://stock.ordino.com.ar',
])

function page(message, statusCode = 500) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: `<!doctype html><html lang="es"><meta charset="utf-8"><title>Ordino</title><body style="font-family:sans-serif;padding:24px"><p>${message}</p></body></html>`,
  }
}

exports.handler = async (event) => {
  const returnTo = String(event.queryStringParameters?.returnTo || '').trim()
  if (!RETURN_ORIGINS.has(returnTo)) {
    return page('Esa dirección de retorno no está permitida.', 400)
  }

  const clientId = process.env.ML_CLIENT_ID || ''
  const redirectUri = process.env.ML_REDIRECT_URI || ''
  if (!clientId || !redirectUri) {
    return page('Faltan ML_CLIENT_ID o ML_REDIRECT_URI en Netlify.', 500)
  }

  const url = new URL('https://auth.mercadolibre.com.ar/authorization')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', returnTo)

  return {
    statusCode: 302,
    headers: {
      Location: url.toString(),
      'Cache-Control': 'no-store',
    },
    body: '',
  }
}
