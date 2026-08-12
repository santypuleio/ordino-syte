import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { auth } from "./firebase";

export const INVITE_EXPIRY_DAYS = 7;
const INVITE_STORAGE_KEY = "ordino_pending_invite";

/** Persiste el token para que sobreviva el race post-registro → onboarding. */
export function rememberInviteToken(token) {
  if (!token || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(INVITE_STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function peekInviteToken() {
  if (typeof sessionStorage === "undefined") return "";
  try {
    return sessionStorage.getItem(INVITE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function clearInviteToken() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(INVITE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function landingBaseUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return (import.meta.env.VITE_LANDING_URL || "https://ordino-ar.netlify.app").replace(/\/$/, "");
}

export function generateInviteToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

export function joinUrlForToken(token) {
  return `${landingBaseUrl()}/join/${encodeURIComponent(token)}`;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function inviteExpiryDate(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + INVITE_EXPIRY_DAYS);
  return d;
}

export function isInviteValid(invite) {
  if (!invite) return { ok: false, reason: "Invitación no encontrada." };
  if (invite.status === "revoked") return { ok: false, reason: "Esta invitación fue cancelada." };
  if (invite.status === "accepted") return { ok: false, reason: "Esta invitación ya fue usada." };
  const exp = invite.expiresAt?.toDate?.() || (invite.expiresAt ? new Date(invite.expiresAt) : null);
  if (exp && exp < new Date()) return { ok: false, reason: "Esta invitación expiró." };
  return { ok: true };
}

export async function getInviteByToken(token) {
  if (!db || !token) return null;
  const snap = await getDoc(doc(db, "invites", token));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function listTeamMembers(businessId) {
  if (!db || !businessId) return [];
  const snap = await getDocs(collection(db, "businesses", businessId, "members"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      if (a.role === "owner") return -1;
      if (b.role === "owner") return 1;
      return String(a.email || "").localeCompare(String(b.email || ""));
    });
}

export async function listPendingInvites(businessId) {
  if (!db || !businessId) return [];
  const q = query(
    collection(db, "invites"),
    where("businessId", "==", businessId),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });
}

export async function isMemberOfBusiness(businessId, uid) {
  if (!db || !businessId || !uid) return false;
  const snap = await getDoc(doc(db, "businesses", businessId, "members", uid));
  return snap.exists();
}

/**
 * Owner crea invitación pendiente. Devuelve token + URL de join.
 */
export async function createTeamInvite({
  businessId,
  businessName,
  email,
  invitedByUid,
  invitedByEmail,
}) {
  if (!db) throw new Error("Firebase no configurado");
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Ingresá un email válido.");
  }

  const token = generateInviteToken();
  const expiresAt = Timestamp.fromDate(inviteExpiryDate());

  await setDoc(doc(db, "invites", token), {
    businessId,
    businessName: businessName || businessId,
    email: normalized,
    role: "staff",
    status: "pending",
    invitedByUid: invitedByUid || "",
    invitedByEmail: invitedByEmail || "",
    createdAt: serverTimestamp(),
    expiresAt,
  });

  return { token, joinUrl: joinUrlForToken(token) };
}

export async function revokeTeamInvite(token) {
  if (!db || !token) return;
  await updateDoc(doc(db, "invites", token), {
    status: "revoked",
    revokedAt: serverTimestamp(),
  });
}

export async function removeTeamMember(businessId, memberUid) {
  if (!db || !businessId || !memberUid) return;
  await deleteDoc(doc(db, "businesses", businessId, "members", memberUid));
}

/**
 * Tras registrarse o iniciar sesión, el invitado acepta y queda como staff.
 */
export async function acceptTeamInvite(token, { uid, email, displayName }) {
  if (!db) throw new Error("Firebase no configurado");
  if (!uid || !email) throw new Error("Tenés que iniciar sesión para aceptar.");

  const invite = await getInviteByToken(token);
  const check = isInviteValid(invite);
  if (!check.ok) throw new Error(check.reason);

  const userEmail = normalizeEmail(email);
  if (userEmail !== normalizeEmail(invite.email)) {
    throw new Error(
      `Esta invitación es para ${invite.email}. Iniciá sesión con ese email.`
    );
  }

  const existingProfile = await getDoc(doc(db, "users", uid));
  if (existingProfile.exists()) {
    const data = existingProfile.data();
    if (data.businessId && data.businessId !== invite.businessId) {
      throw new Error(
        "Tu cuenta ya pertenece a otro negocio. Usá otra cuenta para aceptar esta invitación."
      );
    }
    if (data.businessId === invite.businessId) {
      await updateDoc(doc(db, "invites", token), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        acceptedByUid: uid,
      });
      return { businessId: invite.businessId, alreadyMember: true };
    }
  }

  const businessId = invite.businessId;
  const userPayload = {
    email: userEmail,
    displayName: displayName || email.split("@")[0],
    businessId,
    role: "staff",
    onboardingCompleted: true,
    joinedViaInvite: token,
    updatedAt: serverTimestamp(),
  };

  if (existingProfile.exists()) {
    await updateDoc(doc(db, "users", uid), userPayload);
  } else {
    await setDoc(doc(db, "users", uid), {
      ...userPayload,
      createdAt: serverTimestamp(),
    });
  }

  await setDoc(doc(db, "businesses", businessId, "members", uid), {
    role: "staff",
    email: userEmail,
    displayName: displayName || email.split("@")[0],
    invitedBy: invite.invitedByUid || "",
    joinedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "invites", token), {
    status: "accepted",
    acceptedAt: serverTimestamp(),
    acceptedByUid: uid,
  });

  return { businessId, alreadyMember: false };
}

/** Crea doc de miembro owner al provisionar tenant. */
export async function ensureOwnerMember(businessId, { uid, email, displayName }) {
  if (!db || !businessId || !uid) return;
  await setDoc(doc(db, "businesses", businessId, "members", uid), {
    role: "owner",
    email: email || "",
    displayName: displayName || "",
    joinedAt: serverTimestamp(),
  });
}

export async function sendTeamInviteEmail({ token, email, businessName, businessId }) {
  const joinUrl = joinUrlForToken(token);
  const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;

  try {
    const res = await fetch("/.netlify/functions/send-team-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ token, email, businessName, businessId, joinUrl }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { via: "link", joinUrl, error: data.error || "No se pudo enviar el email." };
    }
    return { via: data.via || "email", joinUrl, ...data };
  } catch {
    return { via: "link", joinUrl };
  }
}

export function isOwnerRole(profile) {
  return profile?.role === "owner";
}

export function isStaffRole(profile) {
  return profile?.role === "staff";
}
