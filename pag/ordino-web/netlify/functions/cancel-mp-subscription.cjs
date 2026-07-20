/**
 * Cancela la suscripción MP del negocio.
 * Acceso en Ordino hasta fin de período (accessEndsAt / next_payment_date).
 * Env: MP_ACCESS_TOKEN, FIREBASE_SERVICE_ACCOUNT
 */
const { getFirestore, updateBusiness } = require("./lib/firebaseAdmin.cjs");

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
  if (!token) {
    return json(500, { error: "Falta MP_ACCESS_TOKEN" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  const { businessId, preapprovalId: preapprovalIdArg } = payload;
  if (!businessId) {
    return json(400, { error: "businessId es requerido" });
  }

  try {
    let preapprovalId = preapprovalIdArg;
    if (!preapprovalId) {
      const snap = await getFirestore().collection("businesses").doc(businessId).get();
      if (!snap.exists) {
        return json(404, { error: "Negocio no encontrado" });
      }
      preapprovalId = snap.data()?.mpPreapprovalId;
    }
    if (!preapprovalId) {
      return json(400, { error: "Este negocio no tiene suscripción de Mercado Pago." });
    }

    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json(502, {
        error: data?.message || `No se pudo cancelar (${res.status})`,
        details: data,
      });
    }

    const accessEndsAt =
      data.next_payment_date && new Date(data.next_payment_date) > new Date()
        ? data.next_payment_date
        : new Date().toISOString();

    await updateBusiness(businessId, {
      subscriptionStatus: "canceled",
      mpPreapprovalId: preapprovalId,
      mpStatus: "cancelled",
      accessEndsAt,
      graceEndsAt: null,
    });

    return json(200, {
      ok: true,
      status: "canceled",
      accessEndsAt,
    });
  } catch (err) {
    return json(500, { error: err.message || "Error cancelando suscripción" });
  }
};
