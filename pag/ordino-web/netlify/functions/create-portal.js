const Stripe = require("stripe");

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

  const secret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");

  if (!secret) {
    return json(500, { error: "Falta STRIPE_SECRET_KEY" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  const { businessId, customerId } = payload;
  if (!businessId && !customerId) {
    return json(400, { error: "businessId o customerId requerido" });
  }

  try {
    const stripe = new Stripe(secret);

    // Prefer explicit customerId; otherwise look up via metadata search is limited —
    // client should pass stripeCustomerId from business doc when available.
    let stripeCustomerId = customerId;
    if (!stripeCustomerId && businessId) {
      // Fallback: list recent customers by email is not reliable here.
      return json(400, {
        error: "Pasá customerId (business.stripeCustomerId) o esperá el webhook tras el primer pago.",
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${siteUrl}/dashboard`,
    });

    return json(200, { url: session.url });
  } catch (err) {
    return json(500, { error: err.message || "Error creando portal" });
  }
};
