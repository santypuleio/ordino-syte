import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMercadoLibreAuthUrl,
  reviewMercadoLibreItems,
  safeProductImage,
  safeReturnOrigin,
} from './mercadolibre.js'

describe('Mercado Libre', () => {
  it('arma la url de autorización y solo acepta orígenes conocidos', () => {
    const url = new URL(
      buildMercadoLibreAuthUrl({
        clientId: '123',
        redirectUri: 'https://ordino-ar-stock.netlify.app/.netlify/functions/ml-oauth-callback',
        returnTo: 'http://localhost:5174',
      }),
    )
    assert.equal(url.searchParams.get('client_id'), '123')
    assert.equal(url.searchParams.get('response_type'), 'code')
    assert.equal(url.searchParams.get('state'), 'http://localhost:5174')
    assert.equal(safeReturnOrigin('https://evil.example'), '')
  })

  it('prepara los productos para la misma revisión que el Excel', () => {
    const result = reviewMercadoLibreItems(
      [
        {
          name: 'Yerba',
          price: 4500,
          stock: 3,
          barcode: '7790001001234',
          category: '',
          description: '',
          imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_1.jpg',
        },
        {
          name: 'Filtro',
          price: 1000,
          stock: 1,
          barcode: '',
          imageUrl: 'http://insecure.example/a.jpg',
        },
      ],
      [{ producto: 'Filtro' }],
    )
    assert.equal(result.ready.length, 1)
    assert.equal(result.skippedExisting.length, 1)
    assert.equal(result.ready[0].title, 'Yerba')
    assert.equal(result.ready[0].imageUrl, 'https://http2.mlstatic.com/D_NQ_NP_1.jpg')
    assert.match(safeProductImage('javascript:alert(1)'), /^data:image\/svg/)
  })
})
