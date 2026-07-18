import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ecommerceUrlFor,
  isValidSlug,
  provisionTenant,
  resolveLogoUrl,
  slugify,
  stockUrlFor,
} from "../lib/tenants";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, loading, setProfile, setBusiness } = useAuth();

  const [brandName, setBrandName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#111111");
  const [accentColor, setAccentColor] = useState("#e11d48");
  const [whatsapp, setWhatsapp] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slugTouched && brandName) {
      setSlug(slugify(brandName));
    }
  }, [brandName, slugTouched]);

  const previewStock = useMemo(() => (isValidSlug(slug) ? stockUrlFor(slug) : ""), [slug]);
  const previewShop = useMemo(() => (isValidSlug(slug) ? ecommerceUrlFor(slug) : ""), [slug]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-zinc-950 text-zinc-300">
        Cargando…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (profile?.onboardingCompleted) return <Navigate to="/gestionar" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const cleanSlug = slugify(slug);
    if (!brandName.trim()) {
      setError("Ingresá el nombre de tu marca.");
      return;
    }
    if (!isValidSlug(cleanSlug)) {
      setError("El slug debe tener 3–32 caracteres (a-z, 0-9 y guiones).");
      return;
    }

    setBusy(true);
    try {
      const finalLogo = await resolveLogoUrl({
        logoUrl: logoUrl.trim(),
        logoFile,
      });

      const result = await provisionTenant({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || brandName.trim(),
        brandName: brandName.trim(),
        slug: cleanSlug,
        logoUrl: finalLogo,
        primaryColor,
        accentColor,
        whatsapp: whatsapp.trim(),
      });

      setProfile({
        email: user.email,
        displayName: user.displayName || brandName.trim(),
        businessId: result.businessId,
        role: "owner",
        onboardingCompleted: true,
      });
      setBusiness({
        id: result.businessId,
        name: brandName.trim(),
        slug: cleanSlug,
        logoUrl: finalLogo,
        primaryColor,
        accentColor,
        whatsapp: whatsapp.trim(),
        subscriptionStatus: "trial",
      });

      navigate("/gestionar", { replace: true });
    } catch (err) {
      const msg = err?.message || "No se pudo crear tu negocio";
      if (String(msg).includes("already") || String(msg).toLowerCase().includes("en uso")) {
        setError("Ese slug ya está en uso (quizá de un intento anterior). Probá otro.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 px-4 py-12">
      <div className="mx-auto max-w-xl">
        <Link to="/" className="text-sm text-emerald-300 hover:text-emerald-200">
          ← Ordino
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Configurá tu marca</h1>
        <p className="mt-2 text-zinc-400 text-sm">
          Con estos datos generamos tu gestor de stock y tu tienda.
        </p>
        <div className="mt-4 rounded-2xl border border-signal/40 bg-signal/10 px-4 py-4 text-center shadow-[0_0_40px_rgba(61,214,140,0.12)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">
            Plan Ordino
          </div>
          <p className="mt-2 text-base font-semibold text-white sm:text-lg">
            Primeros <span className="text-signal">2 meses gratis</span>
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Después, <span className="font-semibold text-white">USD 4.99</span> por mes.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Sin tarjeta para empezar. Tu stock y tienda se conservan si el trial vence.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
          <label className="block text-sm">
            <span className="text-zinc-400">Nombre de la marca</span>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-emerald-500"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="text-zinc-400">Slug / link (único)</span>
            <input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-emerald-500"
              required
            />
            <span className="mt-1 block text-xs text-zinc-500">
              Ej: mi-tienda → /t/mi-tienda
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-zinc-400">Color principal</span>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-400">Color acento</span>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-zinc-400">WhatsApp (opcional, para compras)</span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+54911..."
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block text-sm">
            <span className="text-zinc-400">Logo (opcional)</span>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://… enlace a tu logo"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-emerald-500"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="mt-2 block w-full text-sm text-zinc-400"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              Podés pegar una URL o elegir un archivo (se guarda en Firestore, sin Storage).
            </span>
          </label>

          {(previewStock || previewShop) && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400 space-y-1">
              <div>
                Stock: <span className="text-emerald-300 break-all">{previewStock}</span>
              </div>
              <div>
                Tienda: <span className="text-emerald-300 break-all">{previewShop}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy ? "Generando tu plataforma…" : "Crear stock + ecommerce"}
          </button>
        </form>
      </div>
    </div>
  );
}
