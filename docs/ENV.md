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
VITE_STOCK_APP_URL=https://ordino-gestorstock.netlify.app
VITE_ECOMMERCE_APP_URL=https://ordino-importados.netlify.app
VITE_STRIPE_PUBLISHABLE_KEY=
```

Netlify Functions (server):

```
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=          # price_… del plan USD 5/mes
STRIPE_WEBHOOK_SECRET=
URL=                      # URL pública de la landing (Stripe redirects)
FIREBASE_SERVICE_ACCOUNT= # JSON string del service account (solo para stripe-webhook)
```

Webhook endpoint: `https://TU-LANDING.netlify.app/.netlify/functions/stripe-webhook`

## Subir reglas Firebase

Desde la carpeta `NUEVO/`:

```
firebase deploy --only firestore:rules,storage
```

(archivos `firestore.rules` y `storage.rules`)

## Stock (`IB_Stock-main`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_LANDING_APP_URL=https://TU-LANDING.netlify.app
```

## Ecommerce (`IB-ecommerce-main`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_BUSINESS_ID=demo-business   # fallback si entran sin /t/{slug}
```
