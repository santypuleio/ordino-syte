/**
 * Webhook Mercado Pago — suscripciones
 * Env: MP_ACCESS_TOKEN, FIREBASE_SERVICE_ACCOUNT
 *
 * Topics: subscription_preapproval, subscription_authorized_payment
 * Siempre re-fetch del recurso por id (no confiar solo en el body).
 */
const { updateBusiness } = require("./lib/firebaseAdmin.cjs");

const GRACE_DAYS = 2;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function mpGet(path) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Falta MP_ACCESS_TOKEN");
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `MP GET ${path} → ${res.status}`);
  }
  return data;
}

function parseNotification(event) {
  const qs = event.queryStringParameters || {};
  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    body = {};
  }

  const type =
    qs.type ||
    qs.topic ||
    body.type ||
    body.topic ||
    body.action ||
    "";
  const id =
    qs.id ||
    qs["data.id"] ||
    body?.data?.id ||
    body?.id ||
    "";

  return { type: String(type), id: String(id) };
}

function mapPreapprovalStatus(mpStatus) {
  switch (String(mpStatus || "").toLowerCase()) {
    case "authorized":
      return "active";
    case "paused":
      return "past_due";
    case "cancelled":
    case "canceled":
      return "canceled";
    case "pending":
      return null; // aún no pagó / no método
    default:
      return null;
  }
}

async function handlePreapproval(id) {
  const pre = await mpGet(`/preapproval/${id}`);
  const businessId = pre.external_reference;
  if (!businessId) return { skipped: true, reason: "sin external_reference" };

  const mapped = mapPreapprovalStatus(pre.status);
  const patch = {
    mpPreapprovalId: pre.id,
    mpPayerId: pre.payer_id || null,
    mpStatus: pre.status || null,
  };

  if (mapped === "active") {
    Object.assign(patch, {
      subscriptionStatus: "active",
      graceEndsAt: null,
      accessEndsAt: null,
      currentPeriodEnd: pre.next_payment_date || null,
    });
  } else if (mapped === "past_due") {
    Object.assign(patch, {
      subscriptionStatus: "past_due",
      graceEndsAt: addDays(new Date(), GRACE_DAYS).toISOString(),
    });
  } else if (mapped === "canceled") {
    const accessEndsAt =
      pre.next_payment_date && new Date(pre.next_payment_date) > new Date()
        ? pre.next_payment_date
        : new Date().toISOString();
    Object.assign(patch, {
      subscriptionStatus: "canceled",
      accessEndsAt,
      graceEndsAt: null,
    });
  }

  if (mapped) {
    await updateBusiness(businessId, patch);
  } else {
    await updateBusiness(businessId, patch);
  }

  return { businessId, mpStatus: pre.status, mapped };
}

async function handleAuthorizedPayment(id) {
  const payment = await mpGet(`/authorized_payments/${id}`);
  const preapprovalId = payment.preapproval_id;
  if (!preapprovalId) return { skipped: true, reason: "sin preapproval_id" };

  const pre = await mpGet(`/preapproval/${preapprovalId}`);
  const businessId = pre.external_reference;
  if (!businessId) return { skipped: true, reason: "sin external_reference" };

  const payStatus = String(payment.payment?.status || payment.status || "").toLowerCase();

  if (payStatus === "approved") {
    await updateBusiness(businessId, {
      subscriptionStatus: "active",
      mpPreapprovalId: preapprovalId,
      graceEndsAt: null,
      accessEndsAt: null,
      currentPeriodEnd: pre.next_payment_date || payment.next_retry_date || null,
      mpLastPaymentStatus: payStatus,
    });
    return { businessId, result: "active" };
  }

  if (
    payStatus === "rejected" ||
    payStatus === "cancelled" ||
    payStatus === "canceled" ||
    payStatus === "refunded"
  ) {
    await updateBusiness(businessId, {
      subscriptionStatus: "past_due",
      graceEndsAt: addDays(new Date(), GRACE_DAYS).toISOString(),
      mpPreapprovalId: preapprovalId,
      mpLastPaymentStatus: payStatus,
    });
    return { businessId, result: "past_due" };
  }

  return { businessId, result: "ignored", payStatus };
}

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    return json(200, { ok: true });
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (!process.env.MP_ACCESS_TOKEN) {
    return json(500, { error: "Falta MP_ACCESS_TOKEN" });
  }

  try {
    const { type, id } = parseNotification(event);
    if (!id) {
      return json(200, { received: true, note: "sin id" });
    }

    const t = type.toLowerCase();
    let result = null;

    if (
      t.includes("subscription_preapproval") ||
      t === "subscription_preapproval" ||
      t.includes("preapproval")
    ) {
      // No confundir con subscription_preapproval_plan
      if (t.includes("preapproval_plan")) {
        return json(200, { received: true, note: "plan ignored" });
      }
      result = await handlePreapproval(id);
    } else if (
      t.includes("subscription_authorized_payment") ||
      t.includes("authorized_payment")
    ) {
      result = await handleAuthorizedPayment(id);
    } else if (t === "payment" || t.includes("payment")) {
      // Pago puntual ligado a suscripción: re-sync preapproval si viene en metadata
      try {
        const payment = await mpGet(`/v1/payments/${id}`);
        const preId =
          payment.metadata?.preapproval_id ||
          payment.point_of_interaction?.transaction_data?.subscription_id;
        if (preId) {
          result = await handlePreapproval(preId);
        } else {
          result = { skipped: true, reason: "payment sin preapproval" };
        }
      } catch {
        result = { skipped: true, reason: "payment fetch failed" };
      }
    } else {
      // Intentar como preapproval por si el topic viene vacío
      try {
        result = await handlePreapproval(id);
      } catch {
        result = { skipped: true, reason: `topic desconocido: ${type}` };
      }
    }

    return json(200, { received: true, result });
  } catch (err) {
    console.error("mercadopago-webhook", err);
    return json(500, { error: err.message || "Webhook error" });
  }
};
