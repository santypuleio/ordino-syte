/**
 * Crea un PLAN de suscripción MP y redirige a su init_point.
 * (No crea /preapproval con card_token: ese flujo exige Brick/tokenizar tarjeta.)
 *
 * Env: MP_ACCESS_TOKEN, MP_AMOUNT_ARS, URL
 * Test opcional: MP_TEST_USER_ID no es necesario para el link del plan
 *   (el comprador elige cuenta en el checkout de MP).
 */
function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const token = process.env.MP_ACCESS_TOKEN;
  const amount = Number(process.env.MP_AMOUNT_ARS || 7500);
  const siteUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");

  if (!token) return json(500, { error: "Falta MP_ACCESS_TOKEN en Netlify." });
  if (!siteUrl) return json(500, { error: "Falta URL del sitio." });
  if (!Number.isFinite(amount) || amount <= 0) return json(500, { error: "MP_AMOUNT_ARS inválido." });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  const { businessId, email } = payload;
  if (!businessId) {
    return json(400, { error: "businessId es requerido" });
  }

  const isTestToken = String(token).startsWith("TEST-");
  const backUrl = `${siteUrl}/dashboard`;

  try {
    // Reutilizar plan fijo si está configurado (producción)
    let planId = String(process.env.MP_PREAPPROVAL_PLAN_ID || "").trim() || null;
    let initPoint = null;
    let planData = null;

    if (planId) {
      const getRes = await fetch(`https://api.mercadopago.com/preapproval_plan/${planId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      planData = await getRes.json().catch(() => ({}));
      if (getRes.ok) {
        initPoint = planData.init_point || planData.sandbox_init_point || null;
      } else {
        planId = null;
      }
    }

    if (!planId) {
      const planBody = {
        reason: "Ordino plan mensual",
        external_reference: String(businessId),
        back_url: backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "ARS",
        },
      };

      const { res, data } = await mpPost(token, "/preapproval_plan", planBody);
      if (!res.ok) {
        const msg =
          data?.message ||
          data?.error ||
          (Array.isArray(data?.cause) && data.cause[0]?.description) ||
          `Mercado Pago error ${res.status}`;
        return json(502, {
          error: msg,
          mpStatus: res.status,
          details: data,
          step: "preapproval_plan",
          tokenKind: isTestToken ? "TEST" : "APP_USR_or_other",
        });
      }
      planId = data.id;
      planData = data;
      initPoint = data.init_point || data.sandbox_init_point || null;
    }

    if (!initPoint) {
      return json(502, {
        error: "El plan no devolvió init_point",
        details: planData,
        planId,
      });
    }

    // Append external ref in back_url query for return UX (plan already has external_reference)
    // init_point is owned by MP; we only persist mapping.

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const { updateBusiness } = require("./lib/firebaseAdmin.cjs");
        await updateBusiness(businessId, {
          mpPreapprovalPlanId: planId,
          mpPayerEmail: email || null,
          mpLastCheckoutAt: new Date().toISOString(),
          mpCheckoutMode: "plan_init_point",
        });
      } catch (err) {
        console.warn("No se pudo guardar mpPreapprovalPlanId:", err.message);
      }
    }

    return json(200, {
      url: initPoint,
      planId,
      status: planData?.status || "active",
      mode: "plan_init_point",
      testMode: isTestToken || Boolean(planData?.sandbox_init_point),
    });
  } catch (err) {
    return json(500, { error: err.message || "Error creando plan MP" });
  }
};
