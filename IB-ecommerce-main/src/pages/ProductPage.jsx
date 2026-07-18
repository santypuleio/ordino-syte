import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { fetchProductsFromFirebase } from "../lib/sheets.jsx";
import { useTenant } from "../context/TenantContext.jsx";

function formatARS(n) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$ ${n}`;
  }
}

function normalizeWhatsApp(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits || "5491121826396";
}

export default function ProductPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const {
    businessId,
    slug,
    loading: tenantLoading,
    error: tenantError,
    primaryColor,
    whatsapp,
  } = useTenant();

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });

  const basePath = slug ? `/t/${encodeURIComponent(slug)}` : "";
  const accent = primaryColor || "#10b981";

  useEffect(() => {
    let alive = true;
    (async () => {
      if (tenantLoading) return;
      if (tenantError || !businessId) {
        setStatus({ loading: false, error: tenantError || "Sin tenant" });
        return;
      }
      try {
        setStatus({ loading: true, error: "" });
        const data = await fetchProductsFromFirebase(businessId);
        if (!alive) return;
        setItems(data);
        setStatus({ loading: false, error: "" });
      } catch (e) {
        if (!alive) return;
        setStatus({ loading: false, error: e?.message || "Error cargando producto" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [businessId, tenantLoading, tenantError]);

  const product = useMemo(() => {
    return items.find((p) => String(p.id) === String(id));
  }, [items, id]);

  const waLink = useMemo(() => {
    if (!product) return "#";
    const msg = [
      "Hola! Quiero comprar / consultar este producto:",
      `• ${product.nombre}`,
      `• Precio: ${formatARS(product.precio)}`,
      `• Stock: ${product.stock}`,
    ].join("\n");

    return `https://wa.me/${normalizeWhatsApp(whatsapp)}?text=${encodeURIComponent(msg)}`;
  }, [product, whatsapp]);

  if (tenantLoading || status.loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-zinc-300">Cargando…</div>
    );
  }

  if (status.error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="font-semibold">Error</div>
          <div className="mt-2 text-sm text-zinc-300">{status.error}</div>
          <button
            onClick={() => nav(basePath || "/")}
            className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-zinc-950"
            style={{ background: accent }}
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          Producto no encontrado.
          <div className="mt-4">
            <Link
              to={basePath || "/"}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-950"
              style={{ background: accent }}
            >
              Volver al catálogo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inStock = product.stock > 0;

  return (
    <div>
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <Link to={basePath || "/"} className="text-sm hover:opacity-80" style={{ color: accent }}>
            ← Volver
          </Link>
          <div className="text-xs text-zinc-500">Producto</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/30">
            <div className="aspect-[4/3] bg-zinc-950/40">
              {product.imagen ? (
                <img
                  src={product.imagen}
                  alt={product.nombre}
                  className="h-full w-full object-contain object-center"
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-zinc-600 text-sm">
                  Sin imagen
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/30 p-6">
            <div className="text-sm" style={{ color: accent }}>
              {product.categoria}
            </div>
            <h1 className="mt-2 text-3xl font-semibold">{product.nombre}</h1>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-2xl font-semibold text-white">{formatARS(product.precio)}</div>
              <span
                className={[
                  "text-xs rounded-full px-2 py-1 border",
                  inStock
                    ? "border-zinc-500/40 bg-zinc-200/10 text-zinc-100"
                    : "border-zinc-700 bg-zinc-950/30 text-zinc-400",
                ].join(" ")}
              >
                {inStock ? `Stock: ${product.stock}` : "Sin stock"}
              </span>
            </div>

            {product.descripcion ? (
              <p className="mt-4 text-sm leading-relaxed text-zinc-300">{product.descripcion}</p>
            ) : (
              <p className="mt-4 text-sm text-zinc-400">(Sin descripción)</p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className={[
                  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold",
                  inStock
                    ? "text-zinc-950"
                    : "bg-zinc-800 text-zinc-300 cursor-not-allowed pointer-events-none",
                ].join(" ")}
                style={inStock ? { background: accent } : undefined}
              >
                Comprar por WhatsApp
              </a>

              <Link
                to={basePath || "/"}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/30 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-900/50"
              >
                Seguir mirando
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
