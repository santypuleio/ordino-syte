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
  const priceId = process.env.STRIPE_PRICE_ID;
  const siteUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");

  if (!secret || !priceId) {
    return json(500, {
      error: "Faltan STRIPE_SECRET_KEY o STRIPE_PRICE_ID en Netlify.",
    });
  }
  if (!siteUrl) {
    return json(500, { error: "Falta URL del sitio para redirects de Stripe." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  const { businessId, email, uid } = payload;
  if (!businessId || !email) {
    return json(400, { error: "businessId y email son requeridos" });
  }

  try {
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard?checkout=success`,
      cancel_url: `${siteUrl}/dashboard?checkout=cancel`,
      metadata: { businessId, uid: uid || "" },
      subscription_data: {
        metadata: { businessId, uid: uid || "" },
      },
    });

    return json(200, { url: session.url, id: session.id });
  } catch (err) {
    return json(500, { error: err.message || "Error creando Checkout" });
  }
};
