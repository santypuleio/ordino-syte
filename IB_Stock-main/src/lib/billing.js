export const GRACE_DAYS = 2;

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
    return {
      status: "past_due",
      active: inGrace,
      label: inGrace ? "Pago pendiente — período de gracia" : "Pago pendiente",
      trialEndsAt,
      daysLeft: 0,
      graceEndsAt,
      accessEndsAt,
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

  return {
    status: status === "trial" ? "trial_expired" : status,
    active: false,
    label: "Suscripción vencida",
    trialEndsAt,
    daysLeft: 0,
    graceEndsAt,
    accessEndsAt,
  };
}

export function subscriptionCheckoutUrl(landingBase) {
  const base = String(landingBase || "").replace(/\/$/, "");
  return base ? `${base}/dashboard` : "/dashboard";
}
