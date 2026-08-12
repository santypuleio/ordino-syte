/**
 * Envío de mails Ordino.
 * Preferido: Gmail SMTP con App Password (FROM = ordino.ar@gmail.com).
 * Alternativa: Resend (RESEND_API_KEY) si Gmail no está configurado.
 */
const nodemailer = (() => {
  try {
    return require("nodemailer");
  } catch {
    return null;
  }
})();

const FROM_EMAIL = process.env.MAIL_FROM || process.env.GMAIL_USER || "ordino.ar@gmail.com";
const FROM_NAME = process.env.MAIL_FROM_NAME || "Ordino";
const SUPPORT_EMAIL = "ordino.ar@gmail.com";
const SUPPORT_WA = "+54 9 11 2182-6396";
const LANDING_URL = (process.env.URL || "https://ordino-ar.netlify.app").replace(/\/$/, "");

function gmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && nodemailer);
}

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

async function sendViaGmail({ to, subject, html, text }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.GMAIL_USER || FROM_EMAIL}>`,
    to,
    subject,
    html,
    text: text || undefined,
  });
  return { via: "gmail" };
}

async function sendViaResend({ to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.INVITE_FROM_EMAIL || `${FROM_NAME} <onboarding@resend.dev>`,
      to: [to],
      reply_to: SUPPORT_EMAIL,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 240) || "Resend error");
  }
  return { via: "resend" };
}

async function sendMail({ to, subject, html, text }) {
  if (!to) throw new Error("Falta destinatario");
  if (gmailConfigured()) return sendViaGmail({ to, subject, html, text });
  if (resendConfigured()) return sendViaResend({ to, subject, html });
  throw new Error(
    "Mail no configurado. En Netlify seteá GMAIL_USER + GMAIL_APP_PASSWORD (recomendado) o RESEND_API_KEY."
  );
}

function layout({ title, bodyHtml }) {
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <p style="font-size:20px;font-weight:700;margin:0 0 16px">Ordino</p>
    <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
    <p style="font-size:12px;color:#666;line-height:1.5">
      Soporte: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
      · WhatsApp <a href="https://wa.me/5491121826396">${SUPPORT_WA}</a><br/>
      <a href="${LANDING_URL}/cancelar">Cómo cancelar</a> ·
      <a href="${LANDING_URL}/terminos">Términos</a> ·
      <a href="${LANDING_URL}/privacidad">Privacidad</a>
    </p>
  </div>`;
}

function templates() {
  return {
    welcome({ businessName, email }) {
      const name = businessName || "tu marca";
      return {
        subject: `Bienvenido a Ordino — ${name}`,
        html: layout({
          title: `¡Listo, ${name} ya está en Ordino!`,
          bodyHtml: `
            <p>Tu cuenta (${email || ""}) quedó creada.</p>
            <p>Checklist rápido:</p>
            <ol>
              <li>Cargá tus primeros productos en el <a href="${LANDING_URL}/gestionar">Gestor Stock</a>.</li>
              <li>Compartí el link de tu tienda.</li>
              <li>Configurá el WhatsApp de pedidos en Configuración.</li>
            </ol>
            <p>Tenés un mes de prueba. Después: USD 4.99 / mes vía Mercado Pago.</p>
            <p><a href="${LANDING_URL}/gestionar" style="display:inline-block;background:#10b981;color:#042f1a;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Ir al panel</a></p>
          `,
        }),
      };
    },
    trial_7d({ businessName, daysLeft, trialEndsAtLabel }) {
      return {
        subject: `Tu prueba de Ordino termina en ${daysLeft ?? 7} días`,
        html: layout({
          title: "Tu prueba se está por terminar",
          bodyHtml: `
            <p>Hola${businessName ? `, equipo de <strong>${businessName}</strong>` : ""}.</p>
            <p>Tu prueba gratis termina el <strong>${trialEndsAtLabel || "próximamente"}</strong>.</p>
            <p>Para no perder el acceso, activá el plan desde Suscripción.</p>
            <p><a href="${LANDING_URL}/dashboard" style="display:inline-block;background:#10b981;color:#042f1a;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Activar plan</a></p>
          `,
        }),
      };
    },
    trial_1d({ businessName, trialEndsAtLabel }) {
      return {
        subject: "Tu prueba de Ordino termina mañana",
        html: layout({
          title: "Queda 1 día de prueba",
          bodyHtml: `
            <p>Hola${businessName ? `, <strong>${businessName}</strong>` : ""}.</p>
            <p>Mañana vence tu trial (${trialEndsAtLabel || ""}). Activá el plan para seguir usando stock y tienda.</p>
            <p><a href="${LANDING_URL}/dashboard" style="display:inline-block;background:#10b981;color:#042f1a;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Ir a Suscripción</a></p>
          `,
        }),
      };
    },
    payment_failed({ businessName }) {
      return {
        subject: "No pudimos cobrar tu suscripción Ordino",
        html: layout({
          title: "Pago pendiente",
          bodyHtml: `
            <p>Hubo un problema al cobrar la suscripción de <strong>${businessName || "tu negocio"}</strong>.</p>
            <p>Tenés un breve período de gracia. Actualizá el medio de pago o escribinos.</p>
            <p><a href="${LANDING_URL}/dashboard">Ver Suscripción</a></p>
          `,
        }),
      };
    },
    staff_welcome({ businessName }) {
      return {
        subject: `Te sumaste a ${businessName || "un equipo"} en Ordino`,
        html: layout({
          title: "Ya sos parte del equipo",
          bodyHtml: `
            <p>Tu cuenta de empleado quedó lista para <strong>${businessName || "la marca"}</strong>.</p>
            <p>Entrá al panel y abrí el Gestor Stock.</p>
            <p><a href="${LANDING_URL}/gestionar" style="display:inline-block;background:#10b981;color:#042f1a;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Ir al panel</a></p>
          `,
        }),
      };
    },
  };
}

async function sendTemplate(type, { to, ...vars }) {
  const tpl = templates()[type];
  if (!tpl) throw new Error(`Template desconocido: ${type}`);
  const { subject, html } = tpl(vars);
  return sendMail({ to, subject, html });
}

module.exports = {
  sendMail,
  sendTemplate,
  gmailConfigured,
  resendConfigured,
  LANDING_URL,
  SUPPORT_EMAIL,
};
