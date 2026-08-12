# Checklist de soporte Ordino

Contacto público: **ordino.ar@gmail.com** · WhatsApp **+54 9 11 2182-6396**

Usá esto cuando un cliente escriba. Respondé en menos de 24h si podés.

---

## 1. Pagó y no se activó

1. Pedí email de la cuenta y nombre de la marca / slug.
2. Firebase → `businesses/{slug}` → mirá `subscriptionStatus`, `mpPreapprovalId`.
3. En la app del cliente: `/dashboard` → **Actualizar** (sync MP).
4. Si sigue mal: Netlify function `sync-mp-subscription` con ese `businessId` / `preapproval_id`.
5. Último recurso: en Firestore poné a mano `subscriptionStatus: "active"` si confirmás el pago en Mercado Pago.

Respuesta tipo: *“Revisamos tu pago; si no se activó solo, tocá Actualizar en Suscripción. Si sigue igual, avisanos.”*

---

## 2. Trial vencido / no puede entrar al stock

1. Confirmar `trialEndsAt` y `subscriptionStatus`.
2. Si venció: explicar que tiene que activar plan en `/dashboard`.
3. Si es caso especial (amigo / piloto): extender `trialEndsAt` en Firestore unos días.

---

## 3. Invitación a empleado no funciona

1. Confirmar que las **reglas nuevas** de Firestore están publicadas.
2. Nueva invitación desde Equipo (la anterior puede estar accepted/expired).
3. El empleado debe registrarse con **el mismo email** de la invitación.
4. No debe pasar por “configurá tu marca”; si pasa, que vuelva a abrir el link `/join/...`.
5. Si la cuenta quedó a medias: borrar Auth user + `users/{uid}` y reinvitar.

---

## 4. WhatsApp de pedidos / carrito

1. Dueño → Gestionar → Configuración → **WhatsApp de pedidos** (con `549…`).
2. Probar tienda: agregar 2 productos → Enviar pedido por WhatsApp.
3. Si el botón está deshabilitado: falta número configurado.

---

## 5. Quiere cancelar

1. Guiarlo a `/dashboard` → **Cancelar suscripción**, o a `/cancelar`.
2. Explicar: acceso hasta fin de período pagado; datos no se borran solos.
3. Si no puede entrar: cancelar desde Mercado Pago / panel y marcar `canceled` + `accessEndsAt` en Firestore.

---

## 6. Borrar datos / privacidad

1. Pedir email de la cuenta y confirmación por escrito.
2. Borrar o anonimizar `users/{uid}`, miembros, y evaluar `businesses/{id}` (productos).
3. Confirmar por mail cuando esté hecho.

---

## 7. “No me llega el mail”

1. Spam / promociones.
2. Verificar en Netlify: `GMAIL_USER` + `GMAIL_APP_PASSWORD` (ver `docs/EMAIL_SETUP.md`).
3. Mientras tanto: el invite tiene **link copiable** aunque falle el mail.

---

## Datos útiles a pedir siempre

- Email de la cuenta  
- Nombre / slug del negocio  
- Captura del error (si hay)  
- ¿Dueño o empleado invitado?
