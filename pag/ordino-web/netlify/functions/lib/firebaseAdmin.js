const admin = require("firebase-admin");

function getAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error("Falta FIREBASE_SERVICE_ACCOUNT (JSON del service account)");
    }
    const cred = typeof raw === "string" ? JSON.parse(raw) : raw;
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
