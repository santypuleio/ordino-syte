const admin = require("firebase-admin");

function getAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error("Falta FIREBASE_SERVICE_ACCOUNT (JSON del service account)");
    }
    let cred = raw;
    if (typeof raw === "string") {
      try {
        cred = JSON.parse(raw);
      } catch {
        // A veces Netlify guarda el JSON con comillas escapadas de más
        cred = JSON.parse(raw.replace(/^"|"$/g, "").replace(/\\n/g, "\n"));
      }
    }
    admin.initializeApp({
      credential: admin.credential.cert(cred),
    });
  }
  return admin;
}

function getFirestore() {
  return getAdmin().firestore();
}

function serverTimestamp() {
  return getAdmin().firestore.FieldValue.serverTimestamp();
}

async function updateBusiness(businessId, data) {
  if (!businessId) return;
  await getFirestore()
    .collection("businesses")
    .doc(businessId)
    .set({ ...data, updatedAt: serverTimestamp() }, { merge: true });
}

module.exports = {
  getAdmin,
  getFirestore,
  serverTimestamp,
  updateBusiness,
};
