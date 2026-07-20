import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/** Trial Ordino: 1 mes */
export const TRIAL_DAYS = 30;
/** Días de gracia tras cobro fallido */
export const GRACE_DAYS = 2;
/** Precio de lista (referencia) y cobro local */
export const PLAN_PRICE_USD = 4.99;
export const PLAN_PRICE_ARS = 7500;

export const STOCK_APP_URL = (
  import.meta.env.VITE_STOCK_APP_URL || "https://ordino-ar-stock.netlify.app"
).replace(/\/$/, "");

export const ECOMMERCE_APP_URL = (
  import.meta.env.VITE_ECOMMERCE_APP_URL || "https://ordino-ar-shop.netlify.app"
).replace(/\/$/, "");

export function slugify(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function isValidSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 32;
}

export function stockUrlFor(slug) {
  return `${STOCK_APP_URL}/t/${encodeURIComponent(slug)}`;
}

export function ecommerceUrlFor(slug) {
  return `${ECOMMERCE_APP_URL}/t/${encodeURIComponent(slug)}`;
}

export function trialEndsAtFrom(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(date, now = new Date()) {
  if (!date) return null;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function getSubscriptionState(business) {
  if (!business) {
    return {
      status: "unknown",
      active: false,
      label: "Sin negocio",
      trialEndsAt: null,
      daysLeft: null,
      graceEndsAt: null,
      accessEndsAt: null,
    };
  }

  const status = business.subscriptionStatus || "trial";
  const trialEndsAt = toDate(business.trialEndsAt);
  const graceEndsAt = toDate(business.graceEndsAt);
  const accessEndsAt = toDate(business.accessEndsAt || business.currentPeriodEnd);
  const now = new Date();
  const trialValid = trialEndsAt ? trialEndsAt > now : false;
  const daysLeft = daysUntil(trialEndsAt, now);

  if (status === "active") {
    return {
      status,
      active: true,
      label: "Activo",
      trialEndsAt,
      daysLeft: null,
      graceEndsAt,
      accessEndsAt,
    };
  }

  if (status === "trial" && trialValid) {
    return {
      status: "trial",
      active: true,
      label: "Prueba gratis",
      trialEndsAt,
      daysLeft,
      graceEndsAt,
      accessEndsAt,
    };
  }

  if (status === "past_due") {
    const inGrace = graceEndsAt ? graceEndsAt > now : false;
    const graceDaysLeft = daysUntil(graceEndsAt, now);
    return {
      status: "past_due",
      active: inGrace,
      label: inGrace
        ? graceDaysLeft === 1
          ? "Pago pendiente — 1 día de gracia"
          : `Pago pendiente — ${graceDaysLeft} días de gracia`
        : "Pago pendiente",
      trialEndsAt,
      daysLeft: 0,
      graceEndsAt,
      accessEndsAt,
      graceDaysLeft,
    };
  }

  if (status === "canceled") {
    const stillAccess = accessEndsAt ? accessEndsAt > now : false;
    return {
      status: "canceled",
      active: stillAccess,
      label: stillAccess ? "Cancelada — acceso hasta fin de período" : "Suscripción cancelada",
      trialEndsAt,
      daysLeft: 0,
      graceEndsAt,
      accessEndsAt,
    };
  }

  if (status === "trial" && !trialValid) {
    return {
      status: "trial_expired",
      active: false,
      label: "Suscripción vencida",
      trialEndsAt,
      daysLeft: 0,
      graceEndsAt,
      accessEndsAt,
    };
  }

  return {
    status,
    active: false,
    label: status,
    trialEndsAt,
    daysLeft,
    graceEndsAt,
    accessEndsAt,
  };
}

export async function isSlugAvailable(slug) {
  try {
    const snap = await getDoc(doc(db, "slugs", slug));
    return !snap.exists();
  } catch (err) {
    if (String(err?.code || err?.message || "").includes("permission")) {
      throw new Error(
        "Firebase bloqueó la lectura (reglas). Publicá firestore.rules del proyecto NUEVO en la consola de Firebase."
      );
    }
    throw err;
  }
}

/**
 * Convierte un archivo de logo a data URL (sin Firebase Storage).
 * Evita CORS/404 cuando el bucket de Storage no está creado.
 */
export function fileToLogoDataUrl(file, maxSide = 512, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    if (!file.type?.startsWith("image/")) {
      reject(new Error("El logo debe ser una imagen."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo del logo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagen de logo inválida."));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          reject(e);
        }
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export async function resolveLogoUrl({ logoUrl = "", logoFile = null } = {}) {
  const fromUrl = String(logoUrl || "").trim();
  if (fromUrl) return fromUrl;
  if (!logoFile) return "";
  return fileToLogoDataUrl(logoFile);
}

export async function updateBusinessLogo(businessId, logoUrl) {
  if (!db || !businessId || !logoUrl) return;
  await setDoc(
    doc(db, "businesses", businessId),
    { logoUrl, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function updateBusinessColors(businessId, { primaryColor, accentColor }) {
  if (!db || !businessId) return;
  await setDoc(
    doc(db, "businesses", businessId),
    {
      primaryColor,
      accentColor,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Crea tenant + slug + user profile. businessId === slug en v1.
 */
export async function provisionTenant({
  uid,
  email,
  displayName,
  brandName,
  slug,
  logoUrl = "",
  primaryColor = "#10b981",
  accentColor = "#34d399",
  whatsapp = "",
}) {
  if (!db) throw new Error("Firebase no configurado");
  if (!isValidSlug(slug)) throw new Error("Slug inválido");

  const available = await isSlugAvailable(slug);
  if (!available) throw new Error("Ese link ya está en uso. Probá otro slug.");

  const businessId = slug;
  const trialEndsAt = Timestamp.fromDate(trialEndsAtFrom());

  try {
    // Crear user primero para que exista el perfil de owner
    await setDoc(doc(db, "users", uid), {
      email,
      displayName: displayName || brandName.trim(),
      businessId,
      role: "owner",
      onboardingCompleted: true,
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, "businesses", businessId), {
      name: brandName.trim(),
      slug,
      ownerId: uid,
      ownerEmail: email,
      logoUrl: logoUrl || "",
      primaryColor,
      accentColor,
      whatsapp: whatsapp || "",
      subscriptionStatus: "trial",
      trialEndsAt,
      mpPreapprovalId: null,
      graceEndsAt: null,
      accessEndsAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, "slugs", slug), {
      businessId,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    const code = err?.code || "";
    const msg = err?.message || String(err);
    if (code === "permission-denied" || msg.includes("insufficient permissions")) {
      throw new Error(
        "Missing or insufficient permissions: hay que publicar las reglas de Firestore (archivo NUEVO/firestore.rules) en Firebase Console → Firestore → Reglas."
      );
    }
    throw err;
  }

  return {
    businessId,
    slug,
    stockUrl: stockUrlFor(slug),
    ecommerceUrl: ecommerceUrlFor(slug),
  };
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getBusiness(businessId) {
  const snap = await getDoc(doc(db, "businesses", businessId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
