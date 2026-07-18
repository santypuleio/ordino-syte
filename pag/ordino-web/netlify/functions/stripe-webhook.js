const Stripe = require("stripe");

/**
 * Netlify Function — Stripe webhook
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FIREBASE_SERVICE_ACCOUNT (JSON string)
 *
 * Events handled:
 * - checkout.session.completed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_failed
 */
function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function getFirestore() {
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error("Falta FIREBASE_SERVICE_ACCOUNT (JSON del service account)");
    }
    const cred = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(cred),
    });
  }
  return admin.firestore();
}

async function updateBusiness(businessId, data) {
  const db = await getFirestore();
  await db.collection("businesses").doc(businessId).set(
    { ...data, updatedAt: adminTimestamp() },
    { merge: true }
  );
}

function adminTimestamp() {
  const admin = require("firebase-admin");
  return admin.firestore.FieldValue.serverTimestamp();
}

function mapSubscriptionStatus(stripeStatus) {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "past_due";
  }
}

exports.handler = async (event) => {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret) {
    return json(500, { error: "Faltan secrets de Stripe" });
  }

  const stripe = new Stripe(secret);
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers["stripe-signature"] || event.headers["Stripe-Signature"],
      webhookSecret
    );
  } catch (err) {
    return json(400, { error: `Webhook signature: ${err.message}` });
  }

  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session = stripeEvent.data.object;
        const businessId = session.metadata?.businessId;
        if (businessId) {
          await updateBusiness(businessId, {
            subscriptionStatus: "active",
            stripeCustomerId: session.customer || null,
            stripeSubscriptionId: session.subscription || null,
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = stripeEvent.data.object;
        const businessId = sub.metadata?.businessId;
        if (businessId) {
          await updateBusiness(businessId, {
            subscriptionStatus: mapSubscriptionStatus(sub.status),
            stripeCustomerId: sub.customer || null,
            stripeSubscriptionId: sub.id,
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = stripeEvent.data.object;
        const businessId = invoice.subscription_details?.metadata?.businessId
          || invoice.lines?.data?.[0]?.metadata?.businessId;
        if (businessId) {
          await updateBusiness(businessId, { subscriptionStatus: "past_due" });
        }
        break;
      }
      default:
        break;
    }

    return json(200, { received: true });
  } catch (err) {
    return json(500, { error: err.message || "Webhook handler error" });
  }
};
