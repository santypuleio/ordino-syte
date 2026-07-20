# Variables de entorno — Ordino SaaS

## Landing (`pag/ordino-web`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_STOCK_APP_URL=https://ordino-ar-stock.netlify.app
VITE_ECOMMERCE_APP_URL=https://ordino-ar-shop.netlify.app
```

### Netlify Functions (server) — Mercado Pago

En el site **ordino-ar** (landing):

```
MP_ACCESS_TOKEN=          # Access Token (test o prod) de la app Ordino
MP_AMOUNT_ARS=7500        # Precio mensual en ARS
MP_TEST_USER_ID=          # Solo pruebas: User ID numérico del comprador (ej. 3248032089)
MP_TEST_PAYER_EMAIL=      # Alternativa: test_user_{id}@testuser.com
MP_MODE=test              # Opcional, fuerza modo prueba
URL=https://ordino-ar.netlify.app
FIREBASE_SERVICE_ACCOUNT= # JSON completo del service account (una sola línea)
```

**Importante (pruebas):** no uses el nombre `TESTUSER…` como email. En la tarjeta del comprador copiá el **User ID** (solo números) → `MP_TEST_USER_ID`. El backend arma `test_user_{id}@testuser.com`.

Webhook Mercado Pago (Tus integraciones → Webhooks):

`https://ordino-ar.netlify.app/.netlify/functions/mercadopago-webhook`

(Functions en `.cjs` por compatibilidad con `"type": "module"` del frontend; la URL no cambia.)

Topics recomendados:
- `subscription_preapproval`
- `subscription_authorized_payment`
- `payment` (opcional)

### Stripe (deshabilitado en UI por ahora)

Las funciones `create-checkout` / `stripe-webhook` siguen en el repo por si más adelante sumás USD, pero el dashboard usa solo Mercado Pago.

## Subir reglas Firebase

Desde la carpeta `NUEVO/`:

```
firebase deploy --only firestore:rules,storage
```

## Stock (`IB_Stock-main`)

```
VITE_FIREBASE_*=…
VITE_LANDING_APP_URL=https://ordino-ar.netlify.app
```

## Ecommerce (`IB-ecommerce-main`)

```
VITE_FIREBASE_*=…
VITE_FIREBASE_BUSINESS_ID=demo-business
```

## Sites en producción

| App | URL |
|-----|-----|
| Landing | https://ordino-ar.netlify.app |
| Stock | https://ordino-ar-stock.netlify.app |
| Ecommerce | https://ordino-ar-shop.netlify.app |

## Billing (comportamiento)

- Trial: **30 días** desde el alta
- Precio: **$7.500 ARS / mes** (referencia USD 4.99)
- Cobro fallido: **2 días de gracia**, después bloqueo
- Cancelación: acceso hasta fin del período pagado
- Datos del negocio: se conservan
