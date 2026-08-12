import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTenant } from "./TenantContext.jsx";

const CartContext = createContext(null);

function storageKey(slug) {
  return `ordino-cart-${slug || "default"}`;
}

function readCart(slug) {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(slug, items) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(items));
  } catch {
    /* ignore quota / private mode */
  }
}

export function CartProvider({ children }) {
  const { slug } = useTenant();
  const [items, setItems] = useState(() => readCart(slug));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setItems(readCart(slug));
    setOpen(false);
  }, [slug]);

  useEffect(() => {
    writeCart(slug, items);
  }, [slug, items]);

  const addItem = useCallback((product, qty = 1) => {
    if (!product?.id) return;
    const stock = Number(product.stock) || 0;
    if (stock <= 0) return;
    const amount = Math.max(1, Number(qty) || 1);

    setItems((prev) => {
      const idx = prev.findIndex((p) => String(p.id) === String(product.id));
      if (idx === -1) {
        return [
          ...prev,
          {
            id: product.id,
            nombre: product.nombre,
            precio: Number(product.precio) || 0,
            stock,
            imagen: product.imagen || "",
            cantidad: Math.min(amount, stock),
          },
        ];
      }
      const next = [...prev];
      const current = next[idx];
      next[idx] = {
        ...current,
        stock,
        precio: Number(product.precio) || current.precio,
        cantidad: Math.min(stock, current.cantidad + amount),
      };
      return next;
    });
    setOpen(true);
  }, []);

  const setQuantity = useCallback((id, cantidad) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (String(item.id) !== String(id)) return item;
          const max = Number(item.stock) || 0;
          const nextQty = Math.max(0, Math.min(max, Number(cantidad) || 0));
          if (nextQty <= 0) return null;
          return { ...item, cantidad: nextQty };
        })
        .filter(Boolean)
    );
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => String(item.id) !== String(id)));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const count = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.cantidad), 0),
    [items]
  );

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.precio) * Number(item.cantidad),
        0
      ),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      count,
      total,
      open,
      setOpen,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
    }),
    [items, count, total, open, addItem, setQuantity, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
