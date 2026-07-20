# Ordino SaaS — Arquitectura multi-tenant

## Decisión de repos

**Se mantienen 3 apps separadas** (landing, ecommerce, stock), mismo proyecto Firebase.

- Cada una ya tiene (o tendrá) su site en Netlify → deploys independientes, env vars por site.
- Un monorepo sumaría fricción sin beneficio inmediato.
- El modelo de datos compartido es la “fuente de verdad”; no hace falta compartir código vía package todavía.

## URLs por marca

| App | Patrón | Ejemplo |
|-----|--------|---------|
| Ecommerce (público) | `{ECOMMERCE_URL}/t/{slug}` | `…/t/mi-tienda` |
| Stock (owner) | `{STOCK_URL}` — tras login carga el tenant del usuario | también acepta `/t/{slug}` |
| Landing | `{LANDING_URL}/register` → onboarding → `/dashboard` | links a ambas apps |

Compat: ecommerce sin slug sigue usando `VITE_FIREBASE_BUSINESS_ID` (ej. `demo-business`).

## Roles

| Rol | Quién | Acceso |
|-----|-------|--------|
| `owner` | Usuario Auth dueño del tenant | CRUD stock/ventas/compras; dashboard; billing |
| Público | Sin Auth | Solo lectura del catálogo ecommerce de un `slug` |

No hay rol “comprador autenticado” por ahora (compra = WhatsApp).

## Firestore

```
businesses/{businessId}          # businessId === slug (v1)
  name, slug, ownerId, ownerEmail
  logoUrl, primaryColor, accentColor, whatsapp
  subscriptionStatus: trial|active|past_due|canceled
  trialEndsAt, mpPreapprovalId, graceEndsAt, accessEndsAt
  (legacy: stripeCustomerId, stripeSubscriptionId)

  createdAt, updatedAt
  products/{productId}           # fuente única stock ↔ ecommerce
  sales/{saleId}
  purchases/{purchaseId}

slugs/{slug} → { businessId }    # lookup público (hoy businessId === slug)

users/{uid}
  email, displayName, businessId, role: 'owner'
  onboardingCompleted, createdAt
```

## Storage

```
tenants/{businessId}/logo/{filename}
```

## Billing (Fase 4)

- Trial: 30 días desde `trialEndsAt`.
- Precio: $7.500 ARS/mes (equiv. USD 4.99) vía Mercado Pago.
- Cobro fallido: 2 días de gracia (`graceEndsAt`), después bloqueo.
- Cancelación: acceso hasta `accessEndsAt` (fin de período).
- Webhook Netlify Function (`mercadopago-webhook`) actualiza `subscriptionStatus`.
- Gateo: stock redirige a dashboard si no hay acceso; ecommerce puede mostrar banner.

## Checklist por fases

- [x] Fase 1 — modelo, rules, docs, env examples
- [x] Fase 2 — register / onboarding / provision / dashboard
- [x] Fase 3 — stock + ecommerce por tenant + branding
- [x] Fase 4 — trial + Stripe functions + gateo

## Deploy rules

Subí `firestore.rules` y `storage.rules` de esta carpeta `NUEVO/` con Firebase CLI al proyecto `bdian-5de88` (o el que uses).
