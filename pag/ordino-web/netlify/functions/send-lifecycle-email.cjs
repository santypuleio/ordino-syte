const { getFirestore } = require("./lib/firebaseAdmin.cjs");
const { sendTemplate } = require("./lib/mail.cjs");

function getAdminAuth() {
  const admin = require("firebase-admin");
  const { getApps, initializeApp, cert } = require("firebase-admin/app");
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT");
    const cred = JSON.parse(raw.trim().replace(/^"|"$/g, ""));
    if (cred.private_key) cred.private_key = cred.private_key.replace(/\\n/g, "\n");
    initializeApp({ credential: cert(cred) });
  }
  return admin.auth();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken) {
      return { statusCode: 401, body: JSON.stringify({ error: "No autorizado" }) };
    }

    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const body = JSON.parse(event.body || "{}");
    const type = body.type || "welcome";
    const businessId = body.businessId || "";

    const db = getFirestore();
    const userSnap = await db.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists) {
      return { statusCode: 403, body: JSON.stringify({ error: "Sin perfil" }) };
    }
    const profile = userSnap.data();
    const bid = businessId || profile.businessId;
    if (!bid || profile.businessId !== bid) {
      return { statusCode: 403, body: JSON.stringify({ error: "Negocio no coincide" }) };
    }

    const bizSnap = await db.collection("businesses").doc(bid).get();
    const biz = bizSnap.exists ? bizSnap.data() : {};
    const to = decoded.email || profile.email || biz.ownerEmail;
    if (!to) {
      return { statusCode: 400, body: JSON.stringify({ error: "Sin email destino" }) };
    }

    // Evitar spam de bienvenida
    if (type === "welcome" && biz.welcomeEmailSentAt) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };
    }

    const result = await sendTemplate(type, {
      to,
      businessName: biz.name || bid,
      email: to,
    });

    if (type === "welcome") {
      await db.collection("businesses").doc(bid).set(
        { welcomeEmailSentAt: new Date().toISOString() },
        { merge: true }
      );
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
  } catch (err) {
    console.error("send-lifecycle-email:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Error enviando email" }),
    };
  }
};
