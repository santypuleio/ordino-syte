/**
 * Crea una suscripción Mercado Pago (preapproval pending) y devuelve init_point.
 *
 * Env: MP_ACCESS_TOKEN, MP_AMOUNT_ARS, URL
 * Test: MP_TEST_USER_ID (User ID comprador), MP_TEST_PAYER_EMAIL, MP_MODE
 * Opcional: MP_PREAPPROVAL_PLAN_ID (si ya creaste un plan)
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

function yearsFromNow(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
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

  try {
    // 1) Plan (reutilizar env o crear uno)
    let planId = String(process.env.MP_PREAPPROVAL_PLAN_ID || "").trim() || null;
    if (!planId) {
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
      const { res: planRes, data: planData } = await mpPost(token, "/preapproval_plan", planBody);
      if (!planRes.ok) {
        return json(502, {
          error:
            planData?.message ||
            planData?.error ||
            `No se pudo crear el plan MP (${planRes.status})`,
          mpStatus: planRes.status,
          details: planData,
          step: "preapproval_plan",
          tokenKind: isTestToken ? "TEST" : "APP_USR_or_other",
        });
      }
      planId = planData.id;
    }

    // 2) Suscripción pending ligada al plan
    const subBody = {
      preapproval_plan_id: planId,
      reason: "Ordino plan mensual",
      external_reference: String(businessId),
      payer_email: payerEmail,
      back_url: backUrl,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        start_date: new Date().toISOString(),
        end_date: yearsFromNow(5),
        transaction_amount: amount,
        currency_id: "ARS",
      },
    };

    let { res, data } = await mpPost(token, "/preapproval", subBody);

    // Retry sin fechas si MP se queja / 500
    if (!res.ok && (res.status >= 500 || String(data?.message || "").includes("Internal"))) {
      delete subBody.auto_recurring.start_date;
      delete subBody.auto_recurring.end_date;
      ({ res, data } = await mpPost(token, "/preapproval", subBody));
    }

    if (!res.ok) {
      const cause = Array.isArray(data?.cause) ? data.cause : [];
      const causeMsg = cause
        .map((c) => c?.description || c?.code || c?.message)
        .filter(Boolean)
        .join(" | ");
      let msg = causeMsg || data?.message || data?.error || `Mercado Pago error ${res.status}`;

      if (data?.code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES") {
        msg +=
          " | Usá APP_USR del vendedor de prueba + MP_TEST_USER_ID del comprador.";
      }

      return json(502, {
        error: msg,
        mpStatus: res.status,
        details: data,
        payerEmailUsed: payerEmail,
        planId,
        step: "preapproval",
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
          mpPreapprovalPlanId: planId,
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
      planId,
      status: data.status,
      testMode: Boolean(data.sandbox_init_point) || forceTest,
      payerEmailUsed: payerEmail,
    });
  } catch (err) {
    return json(500, { error: err.message || "Error creando suscripción MP" });
  }
};
