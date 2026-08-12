import React, { useMemo } from "react";
import { useCart } from "../context/CartContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import {
  buildCartWhatsAppMessage,
  buildWhatsAppLink,
  formatARS,
} from "../lib/whatsapp.js";

export default function CartDrawer() {
  const { items, count, total, open, setOpen, setQuantity, removeItem, clearCart } =
    useCart();
  const { whatsapp, brandName, primaryColor } = useTenant();
  const accent = primaryColor || "#10b981";

  const waLink = useMemo(() => {
    if (!items.length) return null;
    return buildWhatsAppLink(
      whatsapp,
      buildCartWhatsAppMessage(items, { brandName })
    );
  }, [items, whatsapp, brandName]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Carrito">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Cerrar carrito"
        onClick={() => setOpen(false)}
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-4">
          <div>
            <div className="text-sm font-semibold text-white">Tu pedido</div>
            <div className="text-xs text-zinc-500">
              {count === 0
                ? "Vacío"
                : count === 1
                  ? "1 producto"
                  : `${count} productos`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            Cerrar
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Agregá productos desde el catálogo para armar tu pedido.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3"
                >
                  <div className="flex gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                      {item.imagen ? (
                        <img
                          src={item.imagen}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-[10px] text-zinc-600">
                          Sin img
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">
                        {item.nombre}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-400">
                        {formatARS(item.precio)} c/u
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center rounded-lg border border-zinc-700">
                          <button
                            type="button"
                            className="px-2.5 py-1 text-sm text-zinc-200 hover:bg-zinc-800"
                            onClick={() =>
                              setQuantity(item.id, item.cantidad - 1)
                            }
                            aria-label="Menos"
                          >
                            −
                          </button>
                          <span className="min-w-[1.5rem] text-center text-sm">
                            {item.cantidad}
                          </span>
                          <button
                            type="button"
                            className="px-2.5 py-1 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                            disabled={item.cantidad >= item.stock}
                            onClick={() =>
                              setQuantity(item.id, item.cantidad + 1)
                            }
                            aria-label="Más"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-xs text-zinc-500 hover:text-red-300"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {formatARS(item.precio * item.cantidad)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-zinc-800 px-4 py-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-zinc-400">Total</span>
            <span className="text-lg font-semibold text-white">
              {formatARS(total)}
            </span>
          </div>

          {!whatsapp ? (
            <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Esta tienda todavía no configuró un número de WhatsApp.
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <a
              href={waLink || "#"}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (!waLink) e.preventDefault();
              }}
              className={[
                "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold",
                waLink
                  ? "text-zinc-950"
                  : "cursor-not-allowed bg-zinc-800 text-zinc-400 pointer-events-none",
              ].join(" ")}
              style={waLink ? { background: accent } : undefined}
            >
              Enviar pedido por WhatsApp
            </a>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Vaciar carrito
              </button>
            ) : null}
          </div>
        </footer>
      </aside>
    </div>
  );
}

export function CartButton({ className = "" }) {
  const { count, setOpen } = useCart();
  const { primaryColor } = useTenant();
  const accent = primaryColor || "#10b981";

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={[
        "relative inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-900",
        className,
      ].join(" ")}
      aria-label="Abrir carrito"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-4 w-4"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-1.2 6h12.4M10 19a1 1 0 100 2 1 1 0 000-2zm7 0a1 1 0 100 2 1 1 0 000-2z"
        />
      </svg>
      <span className="hidden sm:inline">Carrito</span>
      {count > 0 ? (
        <span
          className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-zinc-950"
          style={{ background: accent }}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
