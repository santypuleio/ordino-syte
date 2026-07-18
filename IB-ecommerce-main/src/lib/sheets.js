import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRgCARZiE47P_VhqSUuHl3tspA7H-VrW2K8IJmAnIndz1uft01v1a3DhkdpNEGILujydPMgEDdQDEI9/pub?gid=2138097766&single=true&output=csv";

// Cambiá por tu WhatsApp real
const WHATSAPP_NUMBER = "5491100000000";

function formatARS(n) {
  const num = Number(n || 0);
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function normalizeKey(s) {
  return String(s || "").trim().toLowerCase();
}

function parseNumberLoose(v) {
  // Acepta: "300,000.00" "300000" "$ 300.000,00" etc
  const raw = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (!raw) return 0;

  // Si tiene coma y punto, asumimos coma miles y punto decimal (o viceversa)
  // Para simplificar: sacamos separador de miles y dejamos decimal.
  // Caso AR típico: 1.234.567,89
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  let normalized = raw;

  if (hasComma && hasDot) {
    // Si el último separador es coma => decimal coma (AR)
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else {
      // decimal punto
      normalized = raw.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // puede ser decimal coma
    normalized = raw.replace(",", ".");
  } else {
    // solo punto o nada: ok
    normalized = raw;
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function stockBadge(stock) {
  if (stock <= 0) return { label: "Sin stock", cls: "bg-red-500/15 text-red-200 border-red-500/30" };
  if (stock <= 10) return { label: "Bajo", cls: "bg-amber-500/15 text-amber-200 border-amber-500/30" };
  return { label: "En stock", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" };
}

function buildWhatsAppLink({ name, price }) {
  const text = `Hola! Quiero consultar por: ${name} (${formatARS(price)}). ¿Sigue disponible?`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function PlaceholderImg({ title }) {
  const initials = String(title || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-900/60">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-200">
        {initials || "IMG"}
      </div>
    </div>
  );
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todas");
  const [onlyInStock, setOnlyInStock] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
        const csv = await res.text();

        const parsed = Papa.parse(csv, {
          header: true,            // usa la fila 1 como headers
          skipEmptyLines: true,
        });

        // Esperamos headers EXACTOS como en tu sheet:
        // Producto | Stock | Precio Minorista | Categoria | ImagenURL | Descripcion
        const data = (parsed.data || [])
          .map((r) => {
            const name = r["Producto"]?.trim();
            if (!name) return null;

            const stock = parseNumberLoose(r["Stock"]);
            const price = parseNumberLoose(r["Precio Minorista"]);
            const categoria = (r["Categoria"] || "Sin categoría").trim();
            const imageUrl = (r["ImagenURL"] || "").trim();
            const descripcion = (r["Descripcion"] || "").trim();

            return {
              name,
              stock,
              price,
              categoria,
              imageUrl,
              descripcion,
            };
          })
          .filter(Boolean);

        if (!cancelled) setRows(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set(rows.map((r) => r.categoria).filter(Boolean));
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b, "es"))];
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = normalizeKey(q);

    return rows
      .filter((r) => (category === "Todas" ? true : r.categoria === category))
      .filter((r) => (onlyInStock ? r.stock > 0 : true))
      .filter((r) => {
        if (!qq) return true;
        return (
          normalizeKey(r.name).includes(qq) ||
          normalizeKey(r.categoria).includes(qq) ||
          normalizeKey(r.descripcion).includes(qq)
        );
      })
      .sort((a, b) => b.stock - a.stock);
  }, [rows, q, category, onlyInStock]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl border border-zinc-800 bg-zinc-900/60" />
            <div>
              <div className="text-sm font-semibold leading-none">Ordino</div>
              <div className="text-xs text-zinc-500 leading-none">Demo Ecommerce + Stock</div>
            </div>
          </div>

          <a
            className="inline-flex rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            href="#"
            onClick={(e) => e.preventDefault()}
          >
            Pedir demo
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Catálogo conectado a Google Sheets
          </div>

          <h1 className="mt-4 text-3xl font-semibold">
            Catálogo demo conectado a tu Stock (Google Sheets).
          </h1>
          <p className="mt-2 text-zinc-300">
            Mostrá productos, categorías y stock en vivo. El botón Comprar abre WhatsApp con el producto precargado.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Fuente</div>
              <div className="mt-1 text-sm font-semibold">Google Sheets (Stock)</div>
              <div className="mt-1 text-xs text-zinc-500">CSV publicado</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Catálogo</div>
              <div className="mt-1 text-sm font-semibold">Categorías + búsqueda</div>
              <div className="mt-1 text-xs text-zinc-500">Filtrado en tiempo real</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Compra</div>
              <div className="mt-1 text-sm font-semibold">WhatsApp precargado</div>
              <div className="mt-1 text-xs text-zinc-500">Sin pagos / sin login</div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6">
          <div className="grid gap-4 md:grid-cols-3 md:items-end">
            <div className="md:col-span-1">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Buscar</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ej: iphone, mac, pro..."
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </div>

            <div className="md:col-span-1">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Categoría</div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-zinc-950">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1 flex items-center justify-between gap-4">
              <label className="mt-6 flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="h-4 w-4 accent-emerald-400"
                />
                Mostrar solo en stock
              </label>

              <div className="mt-6 text-sm text-zinc-400">
                {loading ? "Cargando..." : `${filtered.length} producto(s)`}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-10 text-center text-zinc-300">
              Leyendo tu Google Sheets…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-10 text-center text-zinc-300">
              No hay productos para mostrar con estos filtros.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => {
                const badge = stockBadge(p.stock);
                return (
                  <div key={p.name} className="rounded-3xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
                    <div className="h-48 w-full bg-zinc-950/30">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-full w-full object-contain p-4"
                          loading="lazy"
                        />
                      ) : (
                        <PlaceholderImg title={p.name} />
                      )}
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-500">{p.categoria}</div>
                          <h3 className="mt-1 truncate text-lg font-semibold">{p.name}</h3>
                        </div>

                        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm text-zinc-400">Precio</div>
                        <div className="text-sm font-semibold">{formatARS(p.price)}</div>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-sm text-zinc-400">Stock</div>
                        <div className="text-sm font-semibold">{p.stock}</div>
                      </div>

                      {p.descripcion ? (
                        <p className="mt-4 line-clamp-3 text-sm text-zinc-300">
                          {p.descripcion}
                        </p>
                      ) : (
                        <p className="mt-4 text-sm text-zinc-500">
                          (Sin descripción todavía)
                        </p>
                      )}

                      <div className="mt-5 flex gap-3">
                        <a
                          href={buildWhatsAppLink(p)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
                        >
                          Comprar (WhatsApp)
                        </a>
                        <button
                          onClick={() => alert(`Demo: ${p.name}\n\n${p.descripcion || "Sin descripción"}`)}
                          className="inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-900/60"
                        >
                          Ver
                        </button>
                      </div>

                      <div className="mt-3 text-xs text-zinc-600">
                        Conectado a Sheets · se actualiza cuando cambia tu stock
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="mt-12 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          © {new Date().getFullYear()} Ordino — Demo Ecommerce conectado a Google Sheets
        </footer>
      </main>
    </div>
  );
}