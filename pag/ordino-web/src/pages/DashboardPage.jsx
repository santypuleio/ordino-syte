import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ecommerceUrlFor,
  getSubscriptionState,
  PLAN_PRICE_ARS,
  PLAN_PRICE_USD,
  stockUrlFor,
} from "../lib/tenants";

function formatArs(amount) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date) {
  if (!date) return "";
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { user, profile, business, loading, logout, refreshBusiness } = useAuth();
  const [billingMsg, setBillingMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showActivated, setShowActivated] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const fromExpired = searchParams.get("reason") === "trial_expired";
  const checkout = searchParams.get("checkout");

  const sub = useMemo(() => getSubscriptionState(business), [business]);
  const slug = business?.slug || profile?.businessId || "";
  const priceLabel = `USD ${PLAN_PRICE_USD} / mes`;
  const priceHint = `Equiv. ${formatArs(PLAN_PRICE_ARS)} · cobro vía Mercado Pago`;

  useEffect(() => {
    if (checkout !== "success") return;

    setShowActivated(true);
    let tries = 0;
    const tick = async () => {
      await refreshBusiness?.();
      tries += 1;
    };
    tick();
    const id = setInterval(() => {
      if (tries >= 8) {
        clearInterval(id);
        return;
      }
      tick();
    }, 2500);

    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    setSearchParams(next, { replace: true });

    return () => clearInterval(id);
  }, [checkout]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sub.status === "active" && showActivated) {
      // Keep banner visible briefly after sync
    }
  }, [sub.status, showActivated]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-zinc-950 text-zinc-300">
        Cargando panel…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.onboardingCompleted) return <Navigate to="/onboarding" replace />;

  const stockLink = slug ? stockUrlFor(slug) : "#";
  const shopLink = slug ? ecommerceUrlFor(slug) : "#";
  const needsPay =
    !sub.active ||
    sub.status === "trial_expired" ||
    (sub.status === "past_due" && !sub.active) ||
    sub.status === "trial";

  const canActivate =
    sub.status === "trial" ||
    sub.status === "trial_expired" ||
    sub.status === "past_due" ||
    sub.status === "canceled";

  const canCancel = Boolean(business?.mpPreapprovalId) && sub.status === "active";

  async function startCheckout() {
    setBillingMsg("");
    setBusy(true);
    try {
      const res = await fetch("/.netlify/functions/create-mp-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: profile.businessId,
          email: user.email,
          uid: user.uid,
        }),
      });
      const raw = await res.text();
      let data = {};
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          raw?.slice(0, 180) ||
            `Error del servidor (${res.status}). Revisá MP_ACCESS_TOKEN y el deploy de Netlify.`
        );
      }
      if (!res.ok) {
        const extra = data.payerEmailUsed ? ` (payer: ${data.payerEmailUsed})` : "";
        throw new Error(
          (data.error || `No se pudo iniciar el pago (${res.status})`) + extra
        );
      }
      if (data.url) window.location.href = data.url;
      else throw new Error("Respuesta inválida de Mercado Pago");
    } catch (err) {
      setBillingMsg(
        err.message ||
          "Error al conectar con Mercado Pago. Configurá MP_ACCESS_TOKEN en Netlify."
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelSubscription() {
    if (
      !window.confirm(
        "¿Cancelar la suscripción? Seguirás teniendo acceso hasta el fin del período ya pagado."
      )
    ) {
      return;
    }
    setBillingMsg("");
    setBusy(true);
    try {
      const res = await fetch("/.netlify/functions/cancel-mp-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: profile.businessId,
          preapprovalId: business?.mpPreapprovalId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cancelar");
      await refreshBusiness?.();
      setBillingMsg(
        data.accessEndsAt
          ? `Suscripción cancelada. Acceso hasta ${formatDate(new Date(data.accessEndsAt))}.`
          : "Suscripción cancelada."
      );
    } catch (err) {
      setBillingMsg(err.message || "Error al cancelar la suscripción.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            {business?.logoUrl ? (
              <img
                src={business.logoUrl}
                alt=""
                className="h-10 w-10 rounded-lg object-contain bg-zinc-900"
              />
            ) : (
              <div
                className="h-10 w-10 rounded-lg"
                style={{ background: business?.primaryColor || "#10b981" }}
              />
            )}
            <div>
              <div className="font-semibold">{business?.name || "Tu marca"}</div>
              <div className="text-xs text-zinc-500">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/gestionar" className="text-zinc-400 hover:text-zinc-200">
              Gestionar
            </Link>
            <Link to="/" className="text-zinc-400 hover:text-zinc-200">
              Landing
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:border-zinc-500"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        {showActivated && (
          <section className="relative overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-transparent px-5 py-5 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
            <button
              type="button"
              onClick={() => setShowActivated(false)}
              className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-200"
              aria-label="Cerrar"
            >
              ×
            </button>
            <div className="text-lg font-semibold text-emerald-100">
              {sub.status === "active"
                ? "¡Plan activado!"
                : "Pago recibido — estamos confirmando…"}
            </div>
            <p className="mt-1 text-sm text-emerald-100/80">
              {sub.status === "active"
                ? "Tu suscripción de Ordino ya está activa. Stock y tienda desbloqueados."
                : "Si Mercado Pago ya aprobó el pago, en unos segundos se actualiza el estado. Podés tocar Actualizar."}
            </p>
          </section>
        )}

        <section>
          <h1 className="text-3xl font-semibold tracking-tight">Suscripción</h1>
          <p className="mt-2 text-zinc-400 text-sm">
            Stock y ecommerce para{" "}
            <span className="text-emerald-300">/{slug}</span>. Cobros con Mercado Pago
            (Argentina).
          </p>
        </section>

        {(fromExpired || (needsPay && sub.status !== "trial")) && (
          <section className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-4">
            <div className="text-sm font-semibold text-amber-100">
              {fromExpired || sub.status === "trial_expired"
                ? "Tu prueba gratis terminó"
                : sub.label}
            </div>
            <p className="mt-1 text-sm text-amber-100/80">
              Activá el plan ({priceLabel}) para seguir usando el gestor. Tu tienda y todo lo
              que cargaste se conservan.
            </p>
          </section>
        )}

        <section
          className={`rounded-2xl border p-5 ${
            !sub.active
              ? "border-signal/40 bg-signal/10"
              : "border-zinc-800 bg-zinc-950/50"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-[220px] space-y-1">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Estado</div>
              <div className="text-lg font-medium">{sub.label}</div>

              {sub.status === "trial" && sub.daysLeft != null && (
                <div className="text-sm font-medium text-emerald-300">
                  {sub.daysLeft === 1
                    ? "Te queda 1 día de prueba"
                    : `Te quedan ${sub.daysLeft} días de prueba`}
                </div>
              )}

              {sub.trialEndsAt && sub.status === "trial" && (
                <div className="text-sm text-zinc-400">
                  Trial hasta {formatDate(sub.trialEndsAt)}
                </div>
              )}

              {sub.status === "past_due" && sub.graceEndsAt && (
                <div className="text-sm text-amber-200/90">
                  Gracia hasta {formatDate(sub.graceEndsAt)}
                </div>
              )}

              {sub.status === "canceled" && sub.accessEndsAt && sub.active && (
                <div className="text-sm text-zinc-400">
                  Acceso hasta {formatDate(sub.accessEndsAt)}
                </div>
              )}

              {sub.status === "active" && business?.currentPeriodEnd && (
                <div className="text-sm text-zinc-400">
                  Próximo cobro: {formatDate(toDateSafe(business.currentPeriodEnd))}
                </div>
              )}

              <div className="pt-2 text-sm text-zinc-300">{priceLabel}</div>
              <div className="text-xs text-zinc-500">{priceHint}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canActivate ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={startCheckout}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {busy ? "…" : `Activar plan · USD ${PLAN_PRICE_USD}`}
                </button>
              ) : null}

              {canCancel ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelSubscription}
                  className="rounded-xl border border-zinc-600 px-4 py-2 text-sm hover:border-zinc-400 disabled:opacity-60"
                >
                  Cancelar suscripción
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => refreshBusiness?.()}
                className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Actualizar
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-zinc-800/80 pt-4 text-sm text-zinc-400 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-600">Trial</div>
              <div className="mt-0.5 text-zinc-300">1 mes gratis al registrarte</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-600">Si falla el cobro</div>
              <div className="mt-0.5 text-zinc-300">2 días de gracia, después se bloquea</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-600">Si cancelás</div>
              <div className="mt-0.5 text-zinc-300">Acceso hasta fin del período pagado</div>
            </div>
          </div>

          {billingMsg && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {billingMsg}
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <a
            href={stockLink}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-emerald-500/40 transition"
          >
            <div className="text-xs uppercase tracking-wide text-zinc-500">Gestor de stock</div>
            <div className="mt-2 text-xl font-semibold">Abrir stock</div>
            <div className="mt-2 text-xs text-emerald-300/90 break-all">{stockLink}</div>
          </a>
          <a
            href={shopLink}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-emerald-500/40 transition"
          >
            <div className="text-xs uppercase tracking-wide text-zinc-500">Ecommerce</div>
            <div className="mt-2 text-xl font-semibold">Abrir tienda</div>
            <div className="mt-2 text-xs text-emerald-300/90 break-all">{shopLink}</div>
          </a>
        </section>
      </main>
    </div>
  );
}

function toDateSafe(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
