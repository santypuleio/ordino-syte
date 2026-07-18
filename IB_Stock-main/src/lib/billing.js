export function getSubscriptionState(business) {
  if (!business) {
    return {
      status: "unknown",
      active: false,
      label: "Sin negocio",
      trialEndsAt: null,
      daysLeft: null,
    };
  }

  const status = business.subscriptionStatus || "trial";
  const trialEndsAt = business.trialEndsAt?.toDate
    ? business.trialEndsAt.toDate()
    : business.trialEndsAt
      ? new Date(business.trialEndsAt)
      : null;

  const now = new Date();
  const trialValid = trialEndsAt ? trialEndsAt > now : false;
  const daysLeft =
    trialEndsAt != null
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

  if (status === "active") {
    return { status, active: true, label: "Activo", trialEndsAt, daysLeft: null };
  }
  if (status === "trial" && trialValid) {
    return {
      status: "trial",
      active: true,
      label: "Prueba gratis",
      trialEndsAt,
      daysLeft,
    };
  }
  if (status === "past_due") {
    return { status, active: false, label: "Pago pendiente", trialEndsAt, daysLeft: 0 };
  }
  return {
    status: status === "trial" ? "trial_expired" : status,
    active: false,
    label: "Suscripción vencida",
    trialEndsAt,
    daysLeft: 0,
  };
}

export function subscriptionCheckoutUrl(landingBase) {
  const base = String(landingBase || "").replace(/\/$/, "");
  return base ? `${base}/dashboard` : "/dashboard";
}
