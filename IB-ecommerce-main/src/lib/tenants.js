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

export function getSubscriptionState(business) {
  if (!business) return { active: false, status: "unknown", label: "" };
  const status = business.subscriptionStatus || "trial";
  const trialEndsAt = business.trialEndsAt?.toDate
    ? business.trialEndsAt.toDate()
    : business.trialEndsAt
      ? new Date(business.trialEndsAt)
      : null;
  const now = new Date();
  const trialValid = trialEndsAt ? trialEndsAt > now : status === "active";

  if (status === "active") return { active: true, status, label: "" };
  if (status === "trial" && trialValid) return { active: true, status: "trial", label: "" };
  if (status === "past_due") {
    return { active: false, status, label: "Pago pendiente — la tienda sigue visible en modo lectura." };
  }
  return {
    active: false,
    status: status === "trial" ? "trial_expired" : status,
    label: "Suscripción inactiva — catálogo en solo lectura.",
  };
}
