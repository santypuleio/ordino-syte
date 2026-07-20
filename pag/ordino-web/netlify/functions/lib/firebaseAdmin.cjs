const admin = require("firebase-admin");

function getAdmin() {
  const apps = admin.apps;
  const hasApp = Array.isArray(apps) ? apps.length > 0 : Boolean(admin.app?.length || false);

  // firebase-admin v11+: admin.apps es un array; por las dudas no leemos .length si es undefined
  let alreadyInit = false;
  try {
    alreadyInit = Array.isArray(admin.apps) && admin.apps.length > 0;
  } catch {
    alreadyInit = false;
  }

  if (!alreadyInit) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error("Falta FIREBASE_SERVICE_ACCOUNT (JSON del service account)");
    }
    let cred = raw;
    if (typeof raw === "string") {
      try {
        cred = JSON.parse(raw);
      } catch {
        cred = JSON.parse(raw.replace(/^"|"$/g, "").replace(/\\n/g, "\n"));
      }
    }
    // private_key a veces llega con \\n literales
    if (cred && typeof cred.private_key === "string") {
      cred.private_key = cred.private_key.replace(/\\n/g, "\n");
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
