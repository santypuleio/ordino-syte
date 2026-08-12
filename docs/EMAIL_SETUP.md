# Emails automáticos desde ordino.ar@gmail.com

Sí se pueden enviar **desde tu Gmail** usando una **Contraseña de aplicaciones** (no la contraseña normal de la cuenta).

## Por qué App Password

Gmail no deja que una app (Netlify) use tu contraseña normal. Con verificación en 2 pasos + App Password, Nodemailer envía SMTP y el destinatario ve:

**De: Ordino &lt;ordino.ar@gmail.com&gt;**

## Setup (una vez)

1. Entrá a la cuenta Google **ordino.ar@gmail.com**
2. Activá **verificación en 2 pasos** (si no está)
3. Google Account → Seguridad → **Contraseñas de aplicaciones**
4. Creá una para “Ordino Netlify” → copiá las 16 letras
5. En Netlify (site **ordino-ar**) → Environment variables:

```
GMAIL_USER=ordino.ar@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
MAIL_FROM_NAME=Ordino
```

(Podés pegar el app password con o sin espacios.)

6. Redeploy del site landing (para que las functions tomen las vars y `nodemailer`).

## Qué mails envía Ordino

| Evento | Cuándo |
|--------|--------|
| Bienvenida | Al terminar onboarding (crear marca) |
| Trial 7 días | Cron diario si quedan ≤7 y ≥2 días |
| Trial 1 día | Cron diario si queda ≤1 día |
| Pago fallido | Cron diario si `subscriptionStatus == past_due` |
| Invite equipo | Al invitar (usa el mismo mailer si Gmail está ok; si no, link copiable) |

Cron: function `check-trial-emails` schedule `@daily` en `netlify.toml`.

## Probar

1. Completá onboarding con un mail tuyo → debería llegar bienvenida.
2. Opcional: en Netlify Functions, invocar `check-trial-emails` a mano.

## Límites / tips

- Gmail tiene cupos diarios (suficiente al principio; si crecés mucho, pasá a Resend/Brevo con dominio propio).
- No subas el App Password al repo ni al chat.
- Si falla el envío, el producto sigue funcionando (invite con link, etc.).

## Alternativa Resend

Si preferís no usar SMTP de Gmail:

```
RESEND_API_KEY=re_...
INVITE_FROM_EMAIL=Ordino <onboarding@resend.dev>
```

El `From` no será @gmail.com hasta que verifiques un dominio propio. El código usa Gmail si está configurado; si no, Resend.
