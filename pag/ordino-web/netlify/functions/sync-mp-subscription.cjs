/**
 * Sincroniza el estado de suscripción desde Mercado Pago → Firestore.
 * Útil cuando el webhook tarda o no llegó.
 *
 * POST { businessId }
 * Env: MP_ACCESS_TOKEN, FIREBASE_SERVICE_ACCOUNT
 */
const { getFirestore, updateBusiness } = require("./lib/firebaseAdmin.cjs");

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

function mapPreapprovalStatus(mpStatus) {
  switch (String(mpStatus || "").toLowerCase()) {
    case "authorized":
      return "active";
    case "paused":
      return "past_due";
    case "cancelled":
    case "canceled":
      return "canceled";
    default:
      return null;
  }
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

async function applyPreapproval(businessId, pre) {
  const mapped = mapPreapprovalStatus(pre.status);
  const patch = {
    mpPreapprovalId: pre.id,
    mpPreapprovalPlanId: pre.preapproval_plan_id || null,
    mpPayerId: pre.payer_id || null,
    mpStatus: pre.status || null,
  };

  // A veces el cobro ya pasó y el semaphore está green aunque status tarde
  const looksPaid =
    mapped === "active" ||
    pre.summarized?.semaphore === "green" ||
    (Number(pre.summarized?.charged_quantity) > 0 && pre.status !== "cancelled");

  if (looksPaid && mapped !== "canceled") {
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
    Object.assign(patch, {
      subscriptionStatus: "canceled",
      accessEndsAt:
        pre.next_payment_date && new Date(pre.next_payment_date) > new Date()
          ? pre.next_payment_date
          : new Date().toISOString(),
      graceEndsAt: null,
    });
  }

  await updateBusiness(businessId, patch);
  return {
    mpStatus: pre.status,
    subscriptionStatus: patch.subscriptionStatus || null,
    preapprovalId: pre.id,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (!process.env.MP_ACCESS_TOKEN) {
    return json(500, { error: "Falta MP_ACCESS_TOKEN" });
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return json(500, { error: "Falta FIREBASE_SERVICE_ACCOUNT" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  const { businessId } = payload;
  if (!businessId) return json(400, { error: "businessId es requerido" });

  try {
    const snap = await getFirestore().collection("businesses").doc(businessId).get();
    if (!snap.exists) return json(404, { error: "Negocio no encontrado" });
    const biz = snap.data() || {};

    const planId = biz.mpPreapprovalPlanId;
    const preId = biz.mpPreapprovalId;

    let candidates = [];

    if (preId) {
      try {
        candidates.push(await mpGet(`/preapproval/${preId}`));
      } catch (err) {
        console.warn("preapproval by id:", err.message);
      }
    }

    // Buscar por plan o por external_reference (= businessId)
    const queries = [];
    if (planId) {
      queries.push(`/preapproval/search?preapproval_plan_id=${encodeURIComponent(planId)}&status=authorized`);
      queries.push(`/preapproval/search?preapproval_plan_id=${encodeURIComponent(planId)}`);
    }
    queries.push(
      `/preapproval/search?external_reference=${encodeURIComponent(businessId)}`
    );

    for (const q of queries) {
      try {
        const search = await mpGet(q);
        const results = Array.isArray(search.results) ? search.results : [];
        candidates.push(...results);
      } catch (err) {
        console.warn("search", q, err.message);
      }
    }

    // Dedupar por id
    const byId = new Map();
    for (const pre of candidates) {
      if (pre?.id) byId.set(pre.id, pre);
    }
    const list = [...byId.values()];

    if (!list.length) {
      return json(200, {
        ok: false,
        found: false,
        message:
          "No encontramos la suscripción en Mercado Pago todavía. Esperá unos segundos y reintentá, o revisá el webhook.",
        planId: planId || null,
      });
    }

    // Preferir authorized / con cobros
    list.sort((a, b) => {
      const score = (p) =>
        (p.status === "authorized" ? 100 : 0) +
        (p.summarized?.semaphore === "green" ? 50 : 0) +
        Number(p.summarized?.charged_quantity || 0) * 10;
      return score(b) - score(a);
    });

    const best = list[0];
    const applied = await applyPreapproval(businessId, best);

    return json(200, {
      ok: true,
      found: true,
      ...applied,
      message:
        applied.subscriptionStatus === "active"
          ? "Plan activado."
          : `Suscripción en MP: ${best.status}. Si ya pagaste, puede demorar un momento.`,
    });
  } catch (err) {
    return json(500, { error: err.message || "Error sincronizando" });
  }
};
