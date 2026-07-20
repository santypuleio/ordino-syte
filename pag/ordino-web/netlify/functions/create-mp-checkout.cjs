/**
 * Crea una suscripción Mercado Pago (preapproval pending) y devuelve init_point.
 *
 * Env:
 * - MP_ACCESS_TOKEN
 * - MP_AMOUNT_ARS (default 7500)
 * - URL
 * Test (suscripciones):
 *   MP NO deja probar Suscripciones bien con el Access Token TEST- de la app real.
 *   Creá una cuenta de prueba tipo VENDEDOR → usá su Access Token (APP_USR-…).
 *   Creá un COMPRADOR → MP_TEST_USER_ID = su User ID numérico.
 * - MP_TEST_USER_ID
 * - MP_TEST_PAYER_EMAIL (override)
 * - MP_MODE=test
 */
function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function resolveTestPayerEmail() {
  const explicit = String(process.env.MP_TEST_PAYER_EMAIL || "").trim();
  const userId = String(process.env.MP_TEST_USER_ID || "").trim();

  if (userId && /^\d+$/.test(userId)) {
    return `test_user_${userId}@testuser.com`;
  }

  if (!explicit) return "";

  const lower = explicit.toLowerCase();
  if (lower.endsWith("@testuser.com")) return lower;

  if (/^\d+$/.test(explicit)) {
    return `test_user_${explicit}@testuser.com`;
  }

  if (/^testuser\d+$/i.test(explicit)) {
    return `${explicit}@testuser.com`.toLowerCase();
  }

  return explicit;
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

  const isTestToken = String(token).startsWith("TEST-");
  const hasTestPayerConfig = Boolean(
    process.env.MP_TEST_USER_ID || process.env.MP_TEST_PAYER_EMAIL
  );
  const forceTest =
    isTestToken ||
    String(process.env.MP_MODE || "").toLowerCase() === "test" ||
    hasTestPayerConfig;

  const testPayerEmail = resolveTestPayerEmail();
  const payerEmail = forceTest && testPayerEmail ? testPayerEmail : String(email);

  if (forceTest && !testPayerEmail) {
    return json(500, {
      error:
        "Modo prueba: poné MP_TEST_USER_ID = User ID del comprador de prueba (solo números).",
    });
  }

  // Suscripciones: el token TEST- de la app real suele dar PA_UNAUTHORIZED.
  // Mejor: Access Token APP_USR de una cuenta de prueba tipo Vendedor.
  if (isTestToken) {
    console.warn(
      "MP: usando token TEST-. Suscripciones suele requerir APP_USR de vendedor de prueba."
    );
  }

  try {
    const body = {
      reason: "Ordino plan mensual",
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
      const cause = Array.isArray(data?.cause) ? data.cause : [];
      const causeMsg = cause
        .map((c) => c?.description || c?.code || c?.message)
        .filter(Boolean)
        .join(" | ");
      let msg =
        causeMsg ||
        data?.message ||
        data?.error ||
        `Mercado Pago error ${res.status}`;

      if (
        data?.code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES" ||
        String(msg).toLowerCase().includes("unauthorized")
      ) {
        msg +=
          " | Para Suscripciones: creá cuenta de prueba VENDEDOR, usá su Access Token APP_USR (no el TEST- de tu app), y MP_TEST_USER_ID del COMPRADOR.";
      } else if (
        String(msg).toLowerCase().includes("payer") &&
        String(msg).toLowerCase().includes("collector")
      ) {
        msg +=
          " | Vendedor y comprador deben ser ambos de prueba o ambos reales. Revisá MP_TEST_USER_ID.";
      }

      return json(502, {
        error: msg,
        mpStatus: res.status,
        details: data,
        payerEmailUsed: payerEmail,
        tokenKind: isTestToken ? "TEST" : "APP_USR_or_other",
      });
    }

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
      testMode: Boolean(data.sandbox_init_point) || forceTest,
      payerEmailUsed: payerEmail,
    });
  } catch (err) {
    return json(500, { error: err.message || "Error creando suscripción MP" });
  }
};
