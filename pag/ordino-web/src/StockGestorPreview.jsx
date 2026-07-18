import React, { useMemo, useState } from "react";

const PREVIEW_PRODUCTS = [
  {
    id: 1,
    producto: "Yerba Mate Tradicional",
    stock: 12,
    precio: 4500,
    categoria: "Almacén",
    analisis: "Stock",
    imagenUrl:
      "https://images.unsplash.com/photo-1625943555404-b80e7f2f0e88?auto=format&fit=crop&w=80&q=80",
  },
  {
    id: 2,
    producto: "Aceite de Oliva Extra Virgen",
    stock: 8,
    precio: 9800,
    categoria: "Despensa",
    analisis: "Poco stock",
    imagenUrl:
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=80&q=80",
  },
  {
    id: 3,
    producto: "Arroz Largo Fino",
    stock: 0,
    precio: 1900,
    categoria: "Almacén",
    analisis: "Sin stock",
    imagenUrl:
      "https://images.unsplash.com/photo-1586201375761-83865001e31b?auto=format&fit=crop&w=80&q=80",
  },
];

const PREVIEW_SALES = [
  { fecha: "2026-05-18", cliente: "María G.", producto: "Yerba Mate Tradicional", cantidad: 2, total: 9000 },
  { fecha: "2026-05-19", cliente: "Local", producto: "Aceite de Oliva Extra Virgen", cantidad: 1, total: 9800 },
];

const PREVIEW_PURCHASES = [
  { fecha: "2026-05-17", producto: "Yerba Mate Tradicional", cantidad: 10, costo: 32000 },
  { fecha: "2026-05-19", producto: "Arroz Largo Fino", cantidad: 20, costo: 28000 },
];

const NAV_ITEMS = [
  { id: "stock", label: "Stock" },
  { id: "ventas", label: "Ventas" },
  { id: "compras", label: "Compras" },
  { id: "reportes", label: "Reportes" },
];

const VIEW_META = {
  stock: {
    title: "Hoja de Stock",
    subtitle: "Panel simple para controlar inventario, ventas y productos con reposición pendiente.",
  },
  ventas: {
    title: "Hoja de Ventas",
    subtitle: "Registrá ventas diarias y descontá automáticamente el stock vendido.",
  },
  compras: {
    title: "Hoja de Compras",
    subtitle: "Registrá compras y aumentá automáticamente el stock de los productos.",
  },
  reportes: {
    title: "Hoja de Reportes",
    subtitle: "Resumen simple del negocio: ventas, ganancias estimadas y productos clave.",
  },
};

const formatCurrency = (value) =>
  `$${Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

function analisisClass(analisis) {
  if (analisis === "Sin stock") return "bg-red-500/15 text-red-200 border-red-500/30";
  if (analisis === "Poco stock") return "bg-amber-500/15 text-amber-200 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-200 border-emerald-500/30";
}

export default function StockGestorPreview({ appUrl = "https://ordino-gestorstock.netlify.app/" }) {
  const [view, setView] = useState("stock");

  const metrics = useMemo(() => {
    const stockTotal = PREVIEW_PRODUCTS.reduce((acc, p) => acc + p.stock, 0);
    const alertas = PREVIEW_PRODUCTS.filter((p) => p.analisis !== "Stock").length;
    const valor = PREVIEW_PRODUCTS.reduce((acc, p) => acc + p.stock * p.precio, 0);
    return {
      productos: PREVIEW_PRODUCTS.length,
      stockTotal,
      alertas,
      valor,
    };
  }, []);

  const meta = VIEW_META[view];

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-700 bg-[#0b1220] text-sm text-zinc-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-emerald-300">Stock Ordino</span>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
            Vista previa
          </span>
        </div>
        <a
          href={appUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
        >
          Abrir app completa →
        </a>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-zinc-800 px-3 py-2" aria-label="Menú del gestor de stock">
        {NAV_ITEMS.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={[
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "border-emerald-600/60 bg-emerald-800/40 text-emerald-100"
                  : "border-zinc-700 bg-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="max-h-[min(520px,65vh)] overflow-y-auto p-4">
        <header className="mb-4">
          <h4 className="text-lg font-bold text-zinc-100">{meta.title}</h4>
          <p className="mt-1 text-xs text-zinc-400">{meta.subtitle}</p>
        </header>

        {view === "stock" && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Productos registrados", value: metrics.productos },
                { label: "Unidades en stock", value: metrics.stockTotal },
                { label: "Productos con alerta", value: metrics.alertas, warn: true },
                { label: "Valor del inventario", value: formatCurrency(metrics.valor) },
              ].map((m) => (
                <div
                  key={m.label}
                  className={[
                    "rounded-lg border p-3",
                    m.warn ? "border-amber-700/50 bg-amber-950/20" : "border-zinc-700 bg-zinc-900/50",
                  ].join(" ")}
                >
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{m.label}</div>
                  <div className="mt-1 text-base font-bold text-zinc-100">{m.value}</div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-700">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400">
                  <tr>
                    <th className="px-2 py-2">Producto</th>
                    <th className="px-2 py-2">Categoría</th>
                    <th className="px-2 py-2">Stock</th>
                    <th className="px-2 py-2">Precio</th>
                    <th className="px-2 py-2">Análisis</th>
                  </tr>
                </thead>
                <tbody>
                  {PREVIEW_PRODUCTS.map((p) => (
                    <tr key={p.id} className="border-t border-zinc-800">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <img src={p.imagenUrl} alt="" className="h-8 w-8 rounded object-cover" />
                          <span className="font-medium text-zinc-100">{p.producto}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-zinc-400">{p.categoria}</td>
                      <td className="px-2 py-2">{p.stock}</td>
                      <td className="px-2 py-2">{formatCurrency(p.precio)}</td>
                      <td className="px-2 py-2">
                        <span
                          className={[
                            "inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            analisisClass(p.analisis),
                          ].join(" ")}
                        >
                          {p.analisis}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view === "ventas" && (
          <div className="space-y-2">
            {PREVIEW_SALES.map((s, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2"
              >
                <div>
                  <div className="font-medium text-zinc-100">{s.producto}</div>
                  <div className="text-[11px] text-zinc-500">
                    {s.fecha} · {s.cliente} · {s.cantidad} uds
                  </div>
                </div>
                <div className="font-semibold text-emerald-300">{formatCurrency(s.total)}</div>
              </div>
            ))}
            <p className="text-[11px] text-zinc-500">
              En la app real cada venta actualiza el stock al instante en la base de datos.
            </p>
          </div>
        )}

        {view === "compras" && (
          <div className="space-y-2">
            {PREVIEW_PURCHASES.map((c, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2"
              >
                <div>
                  <div className="font-medium text-zinc-100">{c.producto}</div>
                  <div className="text-[11px] text-zinc-500">
                    {c.fecha} · +{c.cantidad} uds ingresadas
                  </div>
                </div>
                <div className="font-semibold text-zinc-300">{formatCurrency(c.costo)}</div>
              </div>
            ))}
          </div>
        )}

        {view === "reportes" && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Ingresos por ventas", value: formatCurrency(46800) },
                { label: "Ganancia estimada", value: formatCurrency(12400) },
                { label: "Margen estimado", value: "26,5%" },
                { label: "Ticket promedio", value: formatCurrency(9400) },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{m.label}</div>
                  <div className="mt-1 text-base font-bold text-zinc-100">{m.value}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { title: "Ventas registradas", value: "2" },
                { title: "Unidades vendidas", value: "3" },
                { title: "Producto estrella", value: "Yerba Mate" },
              ].map((box) => (
                <div key={box.title} className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3">
                  <div className="text-[10px] uppercase text-zinc-500">{box.title}</div>
                  <div className="mt-1 font-bold text-zinc-100">{box.value}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-500">
        Datos de ejemplo. En producción cada negocio tiene su usuario y base de datos privada.
      </p>
    </div>
  );
}
