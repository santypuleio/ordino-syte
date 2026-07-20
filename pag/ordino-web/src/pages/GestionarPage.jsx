import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ecommerceUrlFor, getSubscriptionState, stockUrlFor, updateBusinessColors } from "../lib/tenants";

function parseHex(hex) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function luminance({ r, g, b }) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function resolveBrandColors(business, override) {
  const primary = override?.primaryColor || business?.primaryColor || "#101010";
  const accent = override?.accentColor || business?.accentColor || "#ef4444";
  const p = parseHex(primary);
  const a = parseHex(accent);
  const primaryDark = !p || luminance(p) < 0.18;
  const accentDark = !a || luminance(a) < 0.18;
  const brand = primaryDark ? (accentDark ? "#ef4444" : accent) : primary;
  const brandSoft = accentDark && !primaryDark ? primary : accent;
  return { primary, accent: brandSoft, brand, primaryDark, rawAccent: accent };
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export default function GestionarPage() {
  const navigate = useNavigate();
  const { user, profile, business, loading, logout, setBusiness } = useAuth();

  const [configOpen, setConfigOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#111111");
  const [accentColor, setAccentColor] = useState("#e11d48");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [pinHint, setPinHint] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (!business) return;
    setPrimaryColor(business.primaryColor || "#111111");
    setAccentColor(business.accentColor || "#e11d48");
  }, [business?.primaryColor, business?.accentColor, business?.id]);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (!configOpen) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setConfigOpen(false);
        setColorsOpen(false);
        setPinHint("");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [configOpen]);

  const live = useMemo(
    () => resolveBrandColors(business, { primaryColor, accentColor }),
    [business, primaryColor, accentColor]
  );

  const sub = useMemo(() => getSubscriptionState(business), [business]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-950 text-zinc-300 font-sans">
        Cargando…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.onboardingCompleted) return <Navigate to="/onboarding" replace />;

  const name = business?.name || profile?.displayName || "tu negocio";
  const slug = business?.slug || profile?.businessId || "";
  const stockLink = slug ? stockUrlFor(slug) : "#";
  const shopLink = slug ? ecommerceUrlFor(slug) : "#";
  const { brand, accent, primaryDark } = live;
  const businessId = profile?.businessId || business?.id || slug;

  async function saveColors() {
    setSaveMsg("");
    setSaveErr("");
    if (!businessId) {
      setSaveErr("No se encontró el negocio.");
      return;
    }
    setSaving(true);
    try {
      await updateBusinessColors(businessId, { primaryColor, accentColor });
      setBusiness({
        ...(business || {}),
        id: businessId,
        primaryColor,
        accentColor,
      });
      setSaveMsg("Colores guardados.");
    } catch (err) {
      setSaveErr(err?.message || "No se pudieron guardar los colores.");
    } finally {
      setSaving(false);
    }
  }

  async function pinToHome() {
    setPinHint("");
    if (isStandalone()) {
      setPinHint("Esta app ya está en tu pantalla de inicio.");
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice?.outcome === "accepted") {
        setPinHint("Listo: se agregó a la pantalla de inicio.");
      } else {
        setPinHint("Cancelaste la instalación.");
      }
      return;
    }
    if (isIos()) {
      setPinHint(
        "En iPhone/iPad: tocá Compartir (□↑) → “Agregar a pantalla de inicio”."
      );
      return;
    }
    setPinHint(
      "En Chrome del celular: menú ⋮ → “Instalar app” o “Agregar a la pantalla de inicio”. Abrí esta página en el navegador del teléfono."
    );
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden font-sans text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-500"
        style={{
          background: primaryDark
            ? `radial-gradient(ellipse 70% 55% at 50% -5%, ${brand}55, transparent 55%), linear-gradient(165deg, #0a0a0a 0%, #141414 50%, #0a0a0a 100%)`
            : `radial-gradient(ellipse 70% 55% at 50% -5%, ${brand}40, transparent 55%), linear-gradient(165deg, #0a0a0a 0%, #121212 100%)`,
        }}
      />
      <div
        className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full blur-3xl opacity-40"
        style={{ background: brand }}
      />
      <div
        className="pointer-events-none absolute -left-16 bottom-10 h-56 w-56 rounded-full blur-3xl opacity-25"
        style={{ background: accent }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-lg font-bold tracking-tight text-white/90">
            Ordino
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className="text-zinc-500 hover:text-zinc-300">
              Suscripción
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  setConfigOpen((v) => !v);
                  setColorsOpen(false);
                  setPinHint("");
                  setSaveMsg("");
                  setSaveErr("");
                }}
                className={`inline-flex items-center gap-1.5 transition ${
                  configOpen ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
                aria-expanded={configOpen}
                aria-haspopup="menu"
              >
                Configuración
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-4 w-4 transition-transform duration-200 ${
                    configOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {configOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#121212] shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setColorsOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm text-zinc-200 hover:bg-white/5"
                  >
                    <span>Colores</span>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ background: primaryColor }}
                      />
                      <span
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ background: accentColor }}
                      />
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${
                          colorsOpen ? "rotate-180" : ""
                        }`}
                        aria-hidden
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  </button>

                  {colorsOpen ? (
                    <div className="border-t border-white/10 bg-black/40 px-4 py-3">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block text-xs text-zinc-400">
                          Principal
                          <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent"
                          />
                        </label>
                        <label className="block text-xs text-zinc-400">
                          Acento
                          <input
                            type="color"
                            value={accentColor}
                            onChange={(e) => setAccentColor(e.target.value)}
                            className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={saveColors}
                        className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        style={{ background: brand }}
                      >
                        {saving ? "Guardando…" : "Guardar colores"}
                      </button>
                      {saveMsg && <p className="mt-2 text-xs text-signal">{saveMsg}</p>}
                      {saveErr && <p className="mt-2 text-xs text-red-300">{saveErr}</p>}
                    </div>
                  ) : null}

                  <div className="border-t border-white/10">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={pinToHome}
                      className="w-full px-4 py-3.5 text-left text-sm text-zinc-200 hover:bg-white/5"
                    >
                      Anclar a pantalla de inicio
                    </button>
                    {pinHint ? (
                      <p className="border-t border-white/10 px-4 py-2.5 text-xs leading-relaxed text-zinc-500">
                        {pinHint}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full px-4 py-3.5 text-left text-sm font-semibold text-white"
                    style={{ background: brand }}
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : null}
            </div>
          </nav>
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="text-center">
            {business?.logoUrl ? (
              <img
                src={business.logoUrl}
                alt=""
                className="mx-auto mb-6 h-20 w-20 rounded-2xl object-contain bg-black/40 ring-2"
                style={{ boxShadow: `0 0 0 1px ${brand}88, 0 12px 40px ${brand}33` }}
              />
            ) : (
              <div
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl font-display text-2xl font-extrabold text-white"
                style={{
                  background: `linear-gradient(145deg, ${brand}, ${accent})`,
                  boxShadow: `0 12px 40px ${brand}44`,
                }}
              >
                {String(name).slice(0, 1).toUpperCase()}
              </div>
            )}

            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
              Panel de tu marca
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              Gestioná <span style={{ color: brand }}>{name}</span>
            </h1>
            <p className="mt-3 text-zinc-400">Elegí dónde entrar. Todo está listo.</p>

            {sub.active && sub.status === "trial" && sub.daysLeft != null ? (
              <div className="mt-5 inline-flex flex-col items-center gap-1">
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold tracking-wide text-ink-950"
                  style={{ background: brand }}
                >
                  {sub.daysLeft === 0
                    ? "Tu prueba termina hoy"
                    : sub.daysLeft === 1
                      ? "Te queda 1 día de prueba"
                      : `Te quedan ${sub.daysLeft} días de prueba`}
                </span>
                <Link
                  to="/dashboard"
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Después: $7.500 ARS / mes → Suscripción
                </Link>
              </div>
            ) : null}

            {!sub.active ? (
              <div className="mt-5 inline-flex flex-col items-center gap-2">
                <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100">
                  Prueba finalizada
                </span>
                <Link
                  to="/dashboard?reason=trial_expired"
                  className="text-sm font-semibold hover:opacity-90"
                  style={{ color: brand }}
                >
                  Activar plan $7.500 →
                </Link>
              </div>
            ) : null}
          </div>

          <div className="mt-12 grid gap-4">
            <a
              href={stockLink}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/35 px-6 py-6 backdrop-blur-sm transition hover:border-white/25"
            >
              <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: brand }} />
              <div className="pl-3">
                <div className="font-display text-xl font-bold text-white transition group-hover:translate-x-0.5">
                  Gestor Stock
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  Cargá productos, ventas y compras
                </div>
              </div>
            </a>

            <a
              href={shopLink}
              className="group relative overflow-hidden rounded-2xl px-6 py-6 text-white transition"
              style={{
                background: `linear-gradient(120deg, ${brand} 0%, ${accent} 100%)`,
                boxShadow: `0 16px 48px ${brand}40`,
              }}
            >
              <div className="font-display text-xl font-bold">Tienda Online</div>
              <div className="mt-1 text-sm text-white/80">
                Catálogo público con tu marca
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
