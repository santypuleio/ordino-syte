/**
 * Firebase Admin para Netlify Functions (CJS + API modular).
 * Evita admin.credential.cert undefined con firebase-admin v12+.
 */
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error("Falta FIREBASE_SERVICE_ACCOUNT (JSON del service account)");
  }

  let cred;
  if (typeof raw !== "string") {
    cred = raw;
  } else {
    try {
      cred = JSON.parse(raw);
    } catch {
      // Netlify a veces guarda el JSON entrecomillado o con \\n
      const unquoted = raw.trim().replace(/^"|"$/g, "");
      cred = JSON.parse(unquoted);
    }
  }

  if (!cred || typeof cred !== "object") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT no es un JSON válido");
  }

  if (typeof cred.private_key === "string") {
    cred.private_key = cred.private_key.replace(/\\n/g, "\n");
  }

  if (!cred.client_email || !cred.private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT incompleto (faltan client_email o private_key)"
    );
  }

  return cred;
}

function ensureApp() {
  const apps = getApps();
  if (!apps.length) {
    initializeApp({
      credential: cert(parseServiceAccount()),
    });
  }
}

function getDb() {
  ensureApp();
  return getFirestore();
}

function serverTimestamp() {
  return FieldValue.serverTimestamp();
}

async function updateBusiness(businessId, data) {
  if (!businessId) return;
  await getDb()
    .collection("businesses")
    .doc(businessId)
    .set({ ...data, updatedAt: serverTimestamp() }, { merge: true });
}

module.exports = {
  getAdmin: () => {
    ensureApp();
    return require("firebase-admin");
  },
  getFirestore: getDb,
  serverTimestamp,
  updateBusiness,
};
