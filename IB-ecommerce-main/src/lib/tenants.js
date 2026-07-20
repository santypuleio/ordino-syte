import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function resolveTenantBySlug(slug) {
  if (!slug) return null;

  const slugSnap = await getDoc(doc(db, "slugs", slug));
  let businessId = slug;
  if (slugSnap.exists()) {
    businessId = slugSnap.data().businessId || slug;
  }

  const bizSnap = await getDoc(doc(db, "businesses", businessId));
  if (!bizSnap.exists()) {
    return null;
  }

  return { id: bizSnap.id, ...bizSnap.data() };
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getSubscriptionState(business) {
  if (!business) return { active: false, status: "unknown", label: "" };
  const status = business.subscriptionStatus || "trial";
  const trialEndsAt = toDate(business.trialEndsAt);
  const graceEndsAt = toDate(business.graceEndsAt);
  const accessEndsAt = toDate(business.accessEndsAt || business.currentPeriodEnd);
  const now = new Date();
  const trialValid = trialEndsAt ? trialEndsAt > now : status === "active";

  if (status === "active") return { active: true, status, label: "" };
  if (status === "trial" && trialValid) return { active: true, status: "trial", label: "" };
  if (status === "past_due") {
    const inGrace = graceEndsAt ? graceEndsAt > now : false;
    return {
      active: inGrace,
      status,
      label: inGrace
        ? "Pago pendiente (gracia) — tienda operativa."
        : "Pago pendiente — la tienda sigue visible en modo lectura.",
    };
  }
  if (status === "canceled") {
    const stillAccess = accessEndsAt ? accessEndsAt > now : false;
    return {
      active: stillAccess,
      status,
      label: stillAccess
        ? ""
        : "Suscripción cancelada — catálogo en solo lectura.",
    };
  }
  return {
    active: false,
    status: status === "trial" ? "trial_expired" : status,
    label: "Suscripción inactiva — catálogo en solo lectura.",
  };
}
