/**
 * Crea una suscripción Mercado Pago (preapproval pending) y devuelve init_point.
 * Env: MP_ACCESS_TOKEN, MP_AMOUNT_ARS (default 7500), URL
 * Test: MP_TEST_PAYER_EMAIL (email del comprador de prueba), MP_MODE=test (opcional)
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

  const { businessId, email } = payload;
  if (!businessId || !email) {
    return json(400, { error: "businessId y email son requeridos" });
  }

  // En sandbox, payer_email DEBE ser el email del usuario comprador de prueba
  // (test_user_…@testuser.com). Si mandamos el Gmail de Ordino y pagás con
  // otra cuenta, MP deja Confirmar deshabilitado / rechaza el pago.
  const testPayerEmail = String(process.env.MP_TEST_PAYER_EMAIL || "").trim();
  const forceTest =
    String(token).startsWith("TEST-") ||
    String(process.env.MP_MODE || "").toLowerCase() === "test" ||
    Boolean(testPayerEmail);
  const payerEmail = forceTest && testPayerEmail ? testPayerEmail : String(email);

  if (forceTest && !testPayerEmail) {
    return json(500, {
      error:
        "Modo prueba: agregá en Netlify MP_TEST_PAYER_EMAIL con el email del comprador de prueba (Cuentas de prueba → Comprador).",
    });
  }

  try {
    const body = {
      reason: "Ordino — plan mensual",
      external_reference: String(businessId),
      payer_email: payerEmail,
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

    // Si existe sandbox_init_point, usarlo (credenciales de prueba).
    // En producción suele venir solo init_point.
    const initPoint = data.sandbox_init_point || data.init_point;
    if (!initPoint) {
      return json(502, { error: "Mercado Pago no devolvió init_point", details: data });
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const { updateBusiness } = require("./lib/firebaseAdmin.cjs");
        await updateBusiness(businessId, {
          mpPreapprovalId: data.id || null,
          mpPayerEmail: payerEmail,
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
      testMode: Boolean(data.sandbox_init_point),
    });
  } catch (err) {
    return json(500, { error: err.message || "Error creando suscripción MP" });
  }
};
