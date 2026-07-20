/**
 * Sincroniza suscripción MP → Firestore.
 * POST { businessId, preapprovalId? }
 * Si MP redirige a /dashboard?preapproval_id=…, pasar ese id.
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

  const charged = Number(pre.summarized?.charged_quantity || 0);
  const looksPaid =
    mapped === "active" ||
    pre.summarized?.semaphore === "green" ||
    (charged > 0 && pre.status !== "cancelled" && pre.status !== "canceled");

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
  } else if (pre.status === "pending" && pre.card_id) {
    // Checkout completado con tarjeta, a veces queda pending un momento
    Object.assign(patch, {
      subscriptionStatus: "active",
      graceEndsAt: null,
      accessEndsAt: null,
      currentPeriodEnd: pre.next_payment_date || null,
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

  try {
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

    const businessId = payload.businessId;
    const preapprovalIdArg =
      payload.preapprovalId ||
      payload.preapproval_id ||
      event.queryStringParameters?.preapproval_id ||
      null;

    if (!businessId) return json(400, { error: "businessId es requerido" });

    const snap = await getFirestore().collection("businesses").doc(businessId).get();
    if (!snap.exists) return json(404, { error: "Negocio no encontrado" });
    const biz = snap.data() || {};

    const planId = biz.mpPreapprovalPlanId || null;
    const preId = preapprovalIdArg || biz.mpPreapprovalId || null;

    const candidates = [];

    if (preId) {
      try {
        candidates.push(await mpGet(`/preapproval/${encodeURIComponent(preId)}`));
      } catch (err) {
        console.warn("preapproval by id:", err.message);
      }
    }

    const queries = [];
    if (planId) {
      queries.push(
        `/preapproval/search?preapproval_plan_id=${encodeURIComponent(planId)}`
      );
    }
    queries.push(
      `/preapproval/search?external_reference=${encodeURIComponent(businessId)}`
    );

    for (const q of queries) {
      try {
        const search = await mpGet(q);
        const results = Array.isArray(search?.results) ? search.results : [];
        for (const item of results) {
          if (item?.id) candidates.push(item);
        }
      } catch (err) {
        console.warn("search", q, err.message);
      }
    }

    const byId = new Map();
    for (const pre of candidates) {
      if (pre?.id) byId.set(String(pre.id), pre);
    }
    const list = Array.from(byId.values());

    if (!list.length) {
      return json(200, {
        ok: false,
        found: false,
        message:
          "No encontramos la suscripción en Mercado Pago todavía. Reintentá en unos segundos.",
        triedPreapprovalId: preId,
        planId,
      });
    }

    list.sort((a, b) => {
      const score = (p) =>
        (p.status === "authorized" ? 100 : 0) +
        (p.card_id ? 40 : 0) +
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
          : `Suscripción en MP: ${best.status}. Si ya pagaste, reintentá en unos segundos.`,
    });
  } catch (err) {
    console.error("sync-mp-subscription", err);
    return json(500, { error: err.message || "Error sincronizando" });
  }
};
