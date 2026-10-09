/**
 * Utilidades de código de barras (MVP Ordino).
 * Scope: un solo negocio (products ya vienen filtrados por businessId).
 * Cámara: ver components/BarcodeCameraScanner.jsx (@zxing/browser).
 * Lector físico: input + Enter (emulación de teclado).
 */

/** Trim; siempre string. Vacío => ''. */
export function normalizeBarcode(raw) {
  if (raw == null) return "";
  return String(raw).trim();
}

/**
 * Formato flexible: EAN/UPC/Code128/alfanumérico.
 * Vacío es válido (campo opcional).
 */
export function isValidBarcodeFormat(raw) {
  const code = normalizeBarcode(raw);
  if (!code) return true;
  if (code.length > 64) return false;
  // Evitar caracteres de control / espacios internos raros
  return /^[A-Za-z0-9\-./]+$/.test(code);
}

export function findProductByBarcode(products, rawBarcode) {
  const code = normalizeBarcode(rawBarcode);
  if (!code || !Array.isArray(products)) return null;
  return (
    products.find((p) => normalizeBarcode(p?.barcode) === code) || null
  );
}

/** Otro producto del mismo listado (mismo comercio) con ese barcode. */
export function findDuplicateBarcode(products, rawBarcode, excludeProductId = null) {
  const code = normalizeBarcode(rawBarcode);
  if (!code || !Array.isArray(products)) return null;
  return (
    products.find(
      (p) =>
        String(p.id) !== String(excludeProductId ?? "") &&
        normalizeBarcode(p?.barcode) === code
    ) || null
  );
}

/**
 * Agrega producto a ítems de venta o incrementa cantidad.
 * @returns {{ items: Array, action: 'added'|'incremented'|'stock_limit' }}
 */
export function addProductToSaleItems(items, product) {
  const id = String(product.id);
  const stock = Number(product.stock ?? 0);
  const list = Array.isArray(items) ? items : [];

  const existingIdx = list.findIndex((i) => String(i.productoId) === id);
  if (existingIdx >= 0) {
    const currentQty = Number(list[existingIdx].cantidad) || 0;
    if (stock > 0 && currentQty + 1 > stock) {
      return { items: list, action: "stock_limit" };
    }
    const next = list.map((item, i) =>
      i === existingIdx
        ? {
            ...item,
            cantidad: String(currentQty + 1),
            precioUnitario: String(product.precio ?? item.precioUnitario ?? ""),
          }
        : item
    );
    return { items: next, action: "incremented" };
  }

  if (stock <= 0) {
    return { items: list, action: "stock_limit" };
  }

  const emptyIdx = list.findIndex((i) => !i.productoId);
  const newLine = {
    productoId: id,
    cantidad: "1",
    precioUnitario: String(product.precio ?? ""),
  };

  if (emptyIdx >= 0) {
    const next = list.map((item, i) => (i === emptyIdx ? newLine : item));
    return { items: next, action: "added" };
  }

  return { items: [...list, newLine], action: "added" };
}

/** Resultado de procesar un escaneo en venta. */
export function resolveSaleBarcodeScan(products, items, rawBarcode) {
  const code = normalizeBarcode(rawBarcode);
  if (!code) {
    return { ok: false, reason: "empty", items };
  }
  if (!isValidBarcodeFormat(code)) {
    return { ok: false, reason: "invalid", items, code };
  }
  const product = findProductByBarcode(products, code);
  if (!product) {
    return { ok: false, reason: "not_found", items, code };
  }
  const { items: nextItems, action } = addProductToSaleItems(items, product);
  if (action === "stock_limit") {
    return { ok: false, reason: "stock_limit", items: nextItems, product, code };
  }
  return { ok: true, reason: action, items: nextItems, product, code };
}
