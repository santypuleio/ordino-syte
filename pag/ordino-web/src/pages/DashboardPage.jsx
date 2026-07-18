import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ecommerceUrlFor,
  getSubscriptionState,
  stockUrlFor,
} from "../lib/tenants";

export default function DashboardPage() {
  const { user, profile, business, loading, logout, refreshBusiness } = useAuth();
  const [billingMsg, setBillingMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchParams] = useSearchParams();
  const fromExpired = searchParams.get("reason") === "trial_expired";

  const sub = useMemo(() => getSubscriptionState(business), [business]);
  const slug = business?.slug || profile?.businessId || "";

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
  const needsPay = !sub.active || sub.status === "trial_expired" || sub.status === "past_due";

  async function startCheckout() {
    setBillingMsg("");
    setBusy(true);
    try {
      const res = await fetch("/.netlify/functions/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: profile.businessId,
          email: user.email,
          uid: user.uid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el pago");
      if (data.url) window.location.href = data.url;
      else throw new Error("Respuesta inválida de Stripe");
    } catch (err) {
      setBillingMsg(err.message || "Error al conectar con Stripe. Configurá las env vars en Netlify.");
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBillingMsg("");
    setBusy(true);
    try {
      const res = await fetch("/.netlify/functions/create-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: profile.businessId,
          customerId: business?.stripeCustomerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo abrir el portal");
      if (data.url) window.location.href = data.url;
      else throw new Error("Respuesta inválida de Stripe");
    } catch (err) {
      setBillingMsg(err.message || "Error al abrir el portal de facturación.");
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
        <section>
          <h1 className="text-3xl font-semibold tracking-tight">Tu panel Ordino</h1>
          <p className="mt-2 text-zinc-400 text-sm">
            Stock y ecommerce ya están provisionados para{" "}
            <span className="text-emerald-300">/{slug}</span>.
          </p>
        </section>

        {(fromExpired || needsPay) && (
          <section className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-4">
            <div className="text-sm font-semibold text-amber-100">
              {fromExpired || sub.status === "trial_expired"
                ? "Tu prueba gratis terminó"
                : sub.label}
            </div>
            <p className="mt-1 text-sm text-amber-100/80">
              Activá el plan de USD 4.99/mes para seguir usando el gestor. Tu tienda y todo lo
              que cargaste en stock se conservan.
            </p>
          </section>
        )}

        <section
          className={`rounded-2xl border p-5 ${
            needsPay
              ? "border-signal/40 bg-signal/10"
              : "border-zinc-800 bg-zinc-950/50"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">Suscripción</div>
              <div className="mt-1 text-lg font-medium">{sub.label}</div>
              {sub.status === "trial" && sub.daysLeft != null && (
                <div className="mt-1 text-sm font-medium text-emerald-300">
                  {sub.daysLeft === 1
                    ? "Te queda 1 día de prueba"
                    : `Te quedan ${sub.daysLeft} días de prueba`}
                </div>
              )}
              {sub.trialEndsAt && (
                <div className="text-sm text-zinc-400">
                  Trial hasta{" "}
                  {sub.trialEndsAt.toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              )}
              <div className="mt-1 text-sm text-zinc-500">USD 4.99 / mes después del trial</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!sub.active || sub.status === "trial" || sub.status === "trial_expired" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={startCheckout}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {busy ? "…" : "Activar plan USD 4.99"}
                </button>
              ) : null}
              {business?.stripeCustomerId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={openPortal}
                  className="rounded-xl border border-zinc-600 px-4 py-2 text-sm hover:border-zinc-400 disabled:opacity-60"
                >
                  Gestionar suscripción
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => refreshBusiness()}
                className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Actualizar
              </button>
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

        <section className="rounded-2xl border border-zinc-800 p-5 text-sm text-zinc-400">
          <div className="font-medium text-zinc-200">Happy path</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Entrá al gestor de stock con la misma cuenta.</li>
            <li>Cargá productos (quedan en Firebase bajo tu tenant).</li>
            <li>Abrí la tienda: el catálogo se lee de la misma colección.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
