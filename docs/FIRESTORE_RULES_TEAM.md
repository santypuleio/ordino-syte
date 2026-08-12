# Firestore rules — equipo (staff + invitaciones)

Publicá el archivo `firestore.rules` de la raíz del monorepo en Firebase Console → Firestore → Reglas.

## Qué agrega respecto a la versión anterior

| Recurso | Cambio |
|---------|--------|
| `invites/{token}` | Invitaciones públicas por link (lectura abierta; el token es secreto) |
| `businesses/{id}/members/{uid}` | Miembros owner/staff; fuente de verdad para acceso al stock |
| `products`, `sales`, `purchases` | Escritura para **owner o staff** (`canUseStock`) |
| `businesses` update | Solo **owner** (`canManageBusiness`) |
| `users` create | Permite crear perfil `staff` al aceptar invitación |

## Índice compuesto (puede pedirlo Firebase)

Al listar invitaciones pendientes se usa:

- Colección: `invites`
- Campos: `businessId` (Ascending) + `status` (Ascending)

Si la consola muestra un link para crear el índice, aceptalo.

## Cuentas owner existentes (antes de este cambio)

Los dueños viejos pueden no tener doc en `members/{uid}`. El stock sigue funcionando por `ownerId` en el business (`isOwnerField`). Al abrir **Equipo** en `/gestionar`, se crea el doc de owner automáticamente.

## Emails de invitación (opcional)

En Netlify (site landing), variable `RESEND_API_KEY`. Sin eso, la UI muestra el **link para copiar** y compartir manualmente.

Variable opcional: `INVITE_FROM_EMAIL` (ej. `Ordino <hola@tudominio.com>`).

## Probar

1. Publicar reglas
2. Dueño → `/gestionar` → **Equipo** → invitar email
3. Abrir link `/join/{token}` en incógnito
4. Crear cuenta con ese email → debe entrar como empleado
5. Empleado entra al **Gestor Stock**; no ve Suscripción ni Configuración completa
