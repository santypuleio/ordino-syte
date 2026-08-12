export function formatARS(n) {
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

/** Digits only for wa.me. Empty if invalid — caller should disable checkout. */
export function normalizeWhatsApp(raw) {
  return String(raw || "").replace(/\D/g, "");
}

export function buildProductWhatsAppMessage(product) {
  return [
    "Hola! Quiero comprar / consultar este producto:",
    `• ${product.nombre}`,
    `• Precio: ${formatARS(product.precio)}`,
    `• Stock: ${product.stock}`,
  ].join("\n");
}

export function buildCartWhatsAppMessage(items, { brandName } = {}) {
  const lines = items.map((item) => {
    const lineTotal = Number(item.precio) * Number(item.cantidad);
    return `• ${item.nombre} x${item.cantidad} — ${formatARS(lineTotal)}`;
  });
  const total = items.reduce(
    (sum, item) => sum + Number(item.precio) * Number(item.cantidad),
    0
  );
  const header = brandName
    ? `Hola! Quiero hacer este pedido en ${brandName}:`
    : "Hola! Quiero hacer este pedido:";
  return [header, "", ...lines, "", `Total: ${formatARS(total)}`].join("\n");
}

export function buildWhatsAppLink(whatsapp, message) {
  const phone = normalizeWhatsApp(whatsapp);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
