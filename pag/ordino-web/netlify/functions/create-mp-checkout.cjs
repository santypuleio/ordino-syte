/**
 * Crea una suscripción Mercado Pago (preapproval pending) y devuelve init_point.
 *
 * Env:
 * - MP_ACCESS_TOKEN
 * - MP_AMOUNT_ARS (default 7500)
 * - URL
 * Test:
 * - MP_TEST_USER_ID  → arma test_user_{id}@testuser.com (recomendado)
 * - MP_TEST_PAYER_EMAIL → override manual del email
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

  // Normalizar errores comunes al copiar el Usuario TESTUSER…
  const lower = explicit.toLowerCase();
  if (lower.endsWith("@testuser.com")) return lower;

  // Si pegaron solo el User ID
  if (/^\d+$/.test(explicit)) {
    return `test_user_${explicit}@testuser.com`;
  }

  // Si pegaron TESTUSER123… sin @
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
  const forceTest =
    isTestToken ||
    String(process.env.MP_MODE || "").toLowerCase() === "test" ||
    Boolean(process.env.MP_TEST_USER_ID || process.env.MP_TEST_PAYER_EMAIL);

  const testPayerEmail = resolveTestPayerEmail();
  const payerEmail = forceTest && testPayerEmail ? testPayerEmail : String(email);

  if (forceTest && !testPayerEmail) {
    return json(500, {
      error:
        "Modo prueba: en Netlify poné MP_TEST_USER_ID = User ID numérico del comprador de prueba (ej. 3248032089). Eso arma test_user_{id}@testuser.com.",
    });
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

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    // Requerido por MP en varias APIs de sandbox con token TEST-
    if (isTestToken || forceTest) {
      headers["X-Scope"] = "stage";
    }

    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const cause = Array.isArray(data?.cause) ? data.cause : [];
      const causeMsg = cause
        .map((c) => c?.description || c?.code || c?.message)
        .filter(Boolean)
        .join(" | ");
      const msg =
        causeMsg ||
        data?.message ||
        data?.error ||
        `Mercado Pago error ${res.status}`;

      let hint = "";
      if (String(msg).toLowerCase().includes("payer") && String(msg).toLowerCase().includes("collector")) {
        hint =
          " Usá MP_TEST_USER_ID = User ID del comprador (número de la tarjeta de prueba), no el nombre TESTUSER….";
      }

      return json(502, {
        error: msg + hint,
        mpStatus: res.status,
        details: data,
        payerEmailUsed: payerEmail,
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
      testMode: Boolean(data.sandbox_init_point) || isTestToken,
      payerEmailUsed: payerEmail,
    });
  } catch (err) {
    return json(500, { error: err.message || "Error creando suscripción MP" });
  }
};
