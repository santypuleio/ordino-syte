import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { fetchProductsFromFirebase } from "../lib/sheets.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { CartButton } from "../components/CartDrawer.jsx";
import {
  buildProductWhatsAppMessage,
  buildWhatsAppLink,
  formatARS,
} from "../lib/whatsapp.js";

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
  const { addItem } = useCart();

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [qty, setQty] = useState(1);

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

  useEffect(() => {
    setQty(1);
  }, [product?.id]);

  const waLink = useMemo(() => {
    if (!product) return null;
    return buildWhatsAppLink(whatsapp, buildProductWhatsAppMessage(product));
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
  const maxQty = Math.max(1, Number(product.stock) || 1);

  return (
    <div>
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <Link to={basePath || "/"} className="text-sm hover:opacity-80" style={{ color: accent }}>
            ← Volver
          </Link>
          <CartButton />
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

            {inStock ? (
              <div className="mt-5 flex items-center gap-3">
                <span className="text-xs text-zinc-400">Cantidad</span>
                <div className="inline-flex items-center rounded-lg border border-zinc-700">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Menos"
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] text-center text-sm">{qty}</span>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                    disabled={qty >= maxQty}
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    aria-label="Más"
                  >
                    +
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!inStock}
                onClick={() => addItem(product, qty)}
                className={[
                  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold",
                  inStock
                    ? "text-zinc-950"
                    : "bg-zinc-800 text-zinc-300 cursor-not-allowed",
                ].join(" ")}
                style={inStock ? { background: accent } : undefined}
              >
                Agregar al carrito
              </button>

              <a
                href={waLink || "#"}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  if (!waLink || !inStock) e.preventDefault();
                }}
                className={[
                  "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold",
                  inStock && waLink
                    ? "border-zinc-700 text-zinc-100 hover:bg-zinc-900/50"
                    : "border-zinc-800 bg-zinc-950/30 text-zinc-500 cursor-not-allowed pointer-events-none",
                ].join(" ")}
              >
                Comprar solo este por WhatsApp
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
