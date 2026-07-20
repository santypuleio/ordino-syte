/**
 * Crea una suscripción Mercado Pago (preapproval pending) y devuelve init_point.
 *
 * Env: MP_ACCESS_TOKEN, MP_AMOUNT_ARS, URL
 * Test: MP_TEST_USER_ID, MP_TEST_PAYER_EMAIL, MP_MODE
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
  if (/^\d+$/.test(explicit)) return `test_user_${explicit}@testuser.com`;
  if (/^testuser\d+$/i.test(explicit)) return `${explicit}@testuser.com`.toLowerCase();
  return explicit;
}

async function mpPost(token, path, body) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatMpError(data, status) {
  const cause = Array.isArray(data?.cause) ? data.cause : [];
  const causeMsg = cause
    .map((c) => c?.description || c?.code || c?.message)
    .filter(Boolean)
    .join(" | ");
  return causeMsg || data?.message || data?.error || `Mercado Pago error ${status}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const token = process.env.MP_ACCESS_TOKEN;
  const amount = Number(process.env.MP_AMOUNT_ARS || 7500);
  const siteUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");

  if (!token) return json(500, { error: "Falta MP_ACCESS_TOKEN en Netlify." });
  if (!siteUrl) return json(500, { error: "Falta URL del sitio para el back_url de Mercado Pago." });
  if (!Number.isFinite(amount) || amount <= 0) return json(500, { error: "MP_AMOUNT_ARS inválido." });

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
      error: "Modo prueba: poné MP_TEST_USER_ID = User ID del comprador (solo números).",
    });
  }

  const backUrl = `${siteUrl}/dashboard`;
  const tokenKind = isTestToken ? "TEST" : "APP_USR_or_other";

  try {
    // A) Preferir suscripción SIN plan (flujo "pending" documentado por MP)
    const withoutPlan = {
      reason: "Ordino plan mensual",
      external_reference: String(businessId),
      payer_email: payerEmail,
      back_url: backUrl,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: "ARS",
      },
    };

    let { res, data } = await mpPost(token, "/preapproval", withoutPlan);
    let mode = "without_plan";

    // B) Si falla, crear plan y suscribir SOLO con preapproval_plan_id (sin auto_recurring)
    if (!res.ok) {
      const planBody = {
        reason: "Ordino plan mensual",
        back_url: backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "ARS",
        },
      };
      const planResult = await mpPost(token, "/preapproval_plan", planBody);
      if (!planResult.res.ok) {
        return json(502, {
          error: formatMpError(data, res.status),
          mpStatus: res.status,
          details: { withoutPlan: data, plan: planResult.data },
          payerEmailUsed: payerEmail,
          step: "without_plan_and_plan",
          tokenKind,
        });
      }

      const planId = planResult.data.id;
      await sleep(1500);

      const withPlan = {
        preapproval_plan_id: planId,
        reason: "Ordino plan mensual",
        external_reference: String(businessId),
        payer_email: payerEmail,
        back_url: backUrl,
        status: "pending",
      };

      ({ res, data } = await mpPost(token, "/preapproval", withPlan));
      mode = "with_plan";

      if (!res.ok) {
        return json(502, {
          error: formatMpError(data, res.status),
          mpStatus: res.status,
          details: data,
          payerEmailUsed: payerEmail,
          planId,
          step: "preapproval_with_plan",
          tokenKind,
          firstError: withoutPlan ? formatMpError : undefined,
        });
      }

      data._planId = planId;
    }

    const initPoint = data.sandbox_init_point || data.init_point;
    if (!initPoint) {
      return json(502, {
        error: "Mercado Pago no devolvió init_point",
        details: data,
        step: mode,
      });
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const { updateBusiness } = require("./lib/firebaseAdmin.cjs");
        await updateBusiness(businessId, {
          mpPreapprovalId: data.id || null,
          mpPreapprovalPlanId: data._planId || null,
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
      mode,
      testMode: Boolean(data.sandbox_init_point) || forceTest,
      payerEmailUsed: payerEmail,
    });
  } catch (err) {
    return json(500, { error: err.message || "Error creando suscripción MP" });
  }
};
