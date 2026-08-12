const { getFirestore } = require("./lib/firebaseAdmin.cjs");

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.INVITE_FROM_EMAIL || "Ordino <onboarding@resend.dev>";
const LANDING_URL = (process.env.URL || "https://ordino-ar.netlify.app").replace(/\/$/, "");

async function verifyOwner(idToken, businessId) {
  if (!idToken) return false;
  const admin = require("firebase-admin");
  const { getApps, initializeApp, cert } = require("firebase-admin/app");
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) return false;
    const cred = JSON.parse(raw.trim().replace(/^"|"$/g, ""));
    if (cred.private_key) cred.private_key = cred.private_key.replace(/\\n/g, "\n");
    initializeApp({ credential: cert(cred) });
  }
  const decoded = await admin.auth().verifyIdToken(idToken);
  const db = getFirestore();
  const biz = await db.collection("businesses").doc(businessId).get();
  if (!biz.exists) return false;
  if (biz.data().ownerId === decoded.uid) return true;
  const userSnap = await db.collection("users").doc(decoded.uid).get();
  return (
    userSnap.exists &&
    userSnap.data().businessId === businessId &&
    userSnap.data().role === "owner"
  );
}

async function sendViaResend({ to, businessName, joinUrl, inviterEmail }) {
  if (!RESEND_API_KEY) return null;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: `Te invitaron a ${businessName} en Ordino`,
      html: `
        <p>Hola,</p>
        <p><strong>${inviterEmail || "Un dueño de negocio"}</strong> te invitó a colaborar en <strong>${businessName}</strong> usando Ordino.</p>
        <p>Con tu cuenta vas a poder usar el gestor de stock de la marca.</p>
        <p><a href="${joinUrl}">Aceptar invitación y crear cuenta</a></p>
        <p style="color:#666;font-size:12px;">Si el botón no funciona, copiá este link:<br>${joinUrl}</p>
        <p style="color:#666;font-size:12px;">El link vence en 7 días.</p>
      `,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 200) || "Resend error");
  }
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    const body = JSON.parse(event.body || "{}");
    const { token, email, businessName, businessId, joinUrl } = body;

    if (!token || !email || !businessId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Faltan token, email o businessId" }),
      };
    }

    const isOwner = await verifyOwner(idToken, businessId);
    if (!isOwner) {
      return { statusCode: 403, body: JSON.stringify({ error: "Solo el dueño puede invitar." }) };
    }

    const url = joinUrl || `${LANDING_URL}/join/${encodeURIComponent(token)}`;

    if (RESEND_API_KEY) {
      await sendViaResend({
        to: email,
        businessName: businessName || businessId,
        joinUrl: url,
        inviterEmail: body.inviterEmail || "",
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, via: "email", joinUrl: url }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        via: "link",
        joinUrl: url,
        message: "Configurá RESEND_API_KEY para enviar emails automáticos.",
      }),
    };
  } catch (err) {
    console.error("send-team-invite:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Error enviando invitación" }),
    };
  }
};
