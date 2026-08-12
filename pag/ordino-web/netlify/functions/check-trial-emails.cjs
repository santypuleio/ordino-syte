/**
 * Cron diario: avisos de trial (7 días / 1 día) y pago fallido.
 * Schedule en netlify.toml → check-trial-emails.
 */
const { getFirestore } = require("./lib/firebaseAdmin.cjs");
const { sendTemplate } = require("./lib/mail.cjs");

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(date, now = new Date()) {
  if (!date) return null;
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatAr(date) {
  if (!date) return "";
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

exports.handler = async () => {
  try {
    const db = getFirestore();
    const snap = await db.collection("businesses").get();
    const now = new Date();
    let sent = 0;
    const errors = [];

    for (const doc of snap.docs) {
      const biz = doc.data() || {};
      const to = biz.ownerEmail;
      if (!to) continue;

      const status = biz.subscriptionStatus || "trial";
      const trialEndsAt = toDate(biz.trialEndsAt);
      const left = daysUntil(trialEndsAt, now);

      try {
        if (status === "trial" && trialEndsAt && left != null) {
          if (left <= 7 && left >= 2 && !biz.trial7dEmailSentAt) {
            await sendTemplate("trial_7d", {
              to,
              businessName: biz.name,
              daysLeft: left,
              trialEndsAtLabel: formatAr(trialEndsAt),
            });
            await doc.ref.set({ trial7dEmailSentAt: now.toISOString() }, { merge: true });
            sent += 1;
          }
          if (left <= 1 && left >= 0 && !biz.trial1dEmailSentAt) {
            await sendTemplate("trial_1d", {
              to,
              businessName: biz.name,
              trialEndsAtLabel: formatAr(trialEndsAt),
            });
            await doc.ref.set({ trial1dEmailSentAt: now.toISOString() }, { merge: true });
            sent += 1;
          }
        }

        if (status === "past_due" && !biz.paymentFailedEmailSentAt) {
          await sendTemplate("payment_failed", {
            to,
            businessName: biz.name,
          });
          await doc.ref.set({ paymentFailedEmailSentAt: now.toISOString() }, { merge: true });
          sent += 1;
        }
      } catch (e) {
        errors.push({ id: doc.id, error: e.message });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, sent, errors: errors.slice(0, 10) }),
    };
  } catch (err) {
    console.error("check-trial-emails:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Cron mail failed" }),
    };
  }
};
