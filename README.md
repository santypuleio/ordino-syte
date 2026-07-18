# Ordino Syte

Plataforma multi-tenant SaaS: landing + gestor de stock + ecommerce.

## Estructura

- `pag/ordino-web` — Landing, registro, onboarding, panel `/gestionar`, billing
- `IB_Stock-main` — Gestor de stock (por tenant)
- `IB-ecommerce-main` — Tienda pública `/t/{slug}`
- `firestore.rules` / `storage.rules` — Reglas Firebase
- `docs/` — Arquitectura y variables de entorno

## Stack

Vite + React · Firebase (Auth, Firestore) · Netlify · Stripe (suscripción)

## Desarrollo local

Ver `docs/ENV.md`. En resumen, tres terminales:

```bash
cd pag/ordino-web && npm install && npm run dev   # :5173
cd IB_Stock-main && npm install && npm run dev    # :5174
cd IB-ecommerce-main && npm install && npm run dev # :5175
```

Publicá las reglas de Firestore del archivo `firestore.rules` en la consola de Firebase antes de registrar usuarios.
