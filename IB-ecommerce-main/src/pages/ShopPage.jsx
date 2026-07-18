import React, { useEffect, useMemo, useState } from "react";
import { fetchProductsFromFirebase } from "../lib/sheets.jsx";
import { Link } from "react-router-dom";
import { useTenant } from "../context/TenantContext.jsx";
import defaultLogo from "../img/ordino.png";

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

export default function ShopPage() {
  const {
    businessId,
    slug,
    loading: tenantLoading,
    error: tenantError,
    brandName,
    logoUrl,
    primaryColor,
    subscription,
  } = useTenant();

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Todas");
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [sortBy, setSortBy] = useState("categoria");

  const basePath = slug ? `/t/${encodeURIComponent(slug)}` : "";

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
        setStatus({ loading: false, error: e?.message || "Error cargando productos" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [businessId, tenantLoading, tenantError]);

  const categories = useMemo(() => {
    const set = new Set(items.map((p) => p.categoria || "General"));
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = items
      .filter((p) => (cat === "Todas" ? true : p.categoria === cat))
      .filter((p) => (onlyInStock ? p.stock > 0 : true))
      .filter((p) => {
        if (!q) return true;
        return (
          p.nombre.toLowerCase().includes(q) ||
          p.descripcion.toLowerCase().includes(q) ||
          p.categoria.toLowerCase().includes(q)
        );
      });

    if (sortBy === "precio-mayor") {
      result.sort((a, b) => b.precio - a.precio);
    } else if (sortBy === "precio-menor") {
      result.sort((a, b) => a.precio - b.precio);
    } else if (sortBy === "vendido") {
      result.sort((a, b) => b.stock - a.stock);
    } else {
      result.sort((a, b) => {
        const catCompare = a.categoria.localeCompare(b.categoria);
        if (catCompare !== 0) return catCompare;
        const sa = pStockRank(a);
        const sb = pStockRank(b);
        if (sa !== sb) return sa - sb;
        return a.nombre.localeCompare(b.nombre);
      });
    }

    return result;
  }, [items, cat, onlyInStock, query, sortBy]);

  const accent = primaryColor || "#10b981";

  return (
    <div style={{ ["--brand"]: accent }}>
      {subscription?.label ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100">
          {subscription.label}
        </div>
      ) : null}

      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-950 ring-2"
              style={{ boxShadow: `0 0 0 1px ${accent}55` }}
            >
              <img
                src={logoUrl || defaultLogo}
                alt={brandName}
                className="size-full scale-110 object-contain"
              />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{brandName}</div>
              <div className="text-xs" style={{ color: accent }}>
                Catálogo en vivo
              </div>
            </div>
          </div>

          <div className="hidden md:flex flex-1 max-w-xs">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
            />
          </div>
        </div>
      </header>

      <section className="md:hidden mx-auto max-w-6xl px-4 py-3 border-b border-zinc-800">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar productos..."
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 outline-none"
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-4 border-b border-zinc-800">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-zinc-200 bg-zinc-900/30 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={onlyInStock}
              onChange={(e) => setOnlyInStock(e.target.checked)}
              className="h-4 w-4"
              style={{ accentColor: accent }}
            />
            En stock
          </label>

          <div className="flex gap-3 items-center flex-wrap">
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c} className="bg-zinc-950">
                  {c}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 outline-none"
            >
              <option value="categoria" className="bg-zinc-950">
                Categoría
              </option>
              <option value="precio-mayor" className="bg-zinc-950">
                Mayor precio
              </option>
              <option value="precio-menor" className="bg-zinc-950">
                Menor precio
              </option>
              <option value="vendido" className="bg-zinc-950">
                Más vendido
              </option>
            </select>
            <span className="text-xs text-zinc-400">{filtered.length} producto(s)</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        {tenantLoading || status.loading ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-300">
            Cargando productos…
          </div>
        ) : status.error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-zinc-200">
            <div className="font-semibold">No se pudo cargar el catálogo</div>
            <div className="mt-2 text-sm text-zinc-300">{status.error}</div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to={`${basePath}/producto/${encodeURIComponent(p.id)}`}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden hover:bg-zinc-900/40 transition"
              >
                <div className="aspect-[16/10] bg-zinc-950/40 border-b border-zinc-800 overflow-hidden">
                  {p.imagen ? (
                    <img
                      src={p.imagen}
                      alt={p.nombre}
                      className="h-full w-full object-contain object-center group-hover:scale-[1.02] transition"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-zinc-600 text-sm">
                      Sin imagen
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm" style={{ color: accent }}>
                        {p.categoria}
                      </div>
                      <div className="mt-1 font-semibold leading-tight truncate">{p.nombre}</div>
                    </div>
                    <div className="text-sm font-semibold text-white">{formatARS(p.precio)}</div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={[
                        "text-xs rounded-full px-2 py-1 border",
                        p.stock > 0
                          ? "border-zinc-500/40 bg-zinc-200/10 text-zinc-100"
                          : "border-zinc-700 bg-zinc-950/30 text-zinc-400",
                      ].join(" ")}
                    >
                      {p.stock > 0 ? "Disponible" : "Sin stock"}
                    </span>
                    <span className="text-xs" style={{ color: accent }}>
                      Ver detalle →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function pStockRank(p) {
  return p.stock > 0 ? 0 : 1;
}
