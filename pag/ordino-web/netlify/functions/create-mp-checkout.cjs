/**
 * Crea una suscripción Mercado Pago (preapproval pending) y devuelve init_point.
 * Env: MP_ACCESS_TOKEN, MP_AMOUNT_ARS (default 7500), URL
 */
function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const token = process.env.MP_ACCESS_TOKEN;
  const amount = Number(process.env.MP_AMOUNT_ARS || 7500);
  const siteUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");

  if (!token) {
    return json(500, { error: "Falta MP_ACCESS_TOKEN en Netlify." });
  }
  if (!siteUrl) {
    return json(500, { error: "Falta URL del sitio para el back_url de Mercado Pago." });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return json(500, { error: "MP_AMOUNT_ARS inválido." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  const { businessId, email, uid } = payload;
  if (!businessId || !email) {
    return json(400, { error: "businessId y email son requeridos" });
  }

  try {
    const body = {
      reason: "Ordino — plan mensual",
      external_reference: String(businessId),
      payer_email: String(email),
      back_url: `${siteUrl}/dashboard?checkout=success`,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: "ARS",
      },
    };

    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data?.message ||
        data?.error ||
        (Array.isArray(data?.cause) && data.cause[0]?.description) ||
        `Mercado Pago error ${res.status}`;
      return json(502, { error: msg, details: data });
    }

    const initPoint = data.init_point || data.sandbox_init_point;
    if (!initPoint) {
      return json(502, { error: "Mercado Pago no devolvió init_point", details: data });
    }

    // Persistencia best-effort (no bloquea el redirect al checkout)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const { updateBusiness } = require("./lib/firebaseAdmin.cjs");
        await updateBusiness(businessId, {
          mpPreapprovalId: data.id || null,
          mpPayerEmail: email,
          mpLastCheckoutAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("No se pudo guardar mpPreapprovalId:", err.message);
      }
    }

    return json(200, {
      url: initPoint,
      id: data.id,
      status: data.status,
    });
  } catch (err) {
    return json(500, { error: err.message || "Error creando suscripción MP" });
  }
};
