import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

function parseNumberLoose(v) {
  const raw = String(v ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!raw) return 0;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  let normalized = raw;

  if (hasComma && hasDot) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = raw.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    normalized = raw.replace(",", ".");
  } else {
    normalized = raw;
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function getField(docData, candidates) {
  for (const key of candidates) {
    if (docData[key] !== undefined && docData[key] !== null) {
      return docData[key];
    }
  }
  return "";
}

/**
 * @param {string} businessId
 */
export async function fetchProductsFromFirebase(businessId) {
  const id = businessId || import.meta.env.VITE_FIREBASE_BUSINESS_ID || "";
  if (!id) {
    throw new Error(
      "Falta el tenant. Abrí la tienda desde /t/{slug} o configurá VITE_FIREBASE_BUSINESS_ID."
    );
  }

  const snapshot = await getDocs(collection(db, "businesses", id, "products"));

  return snapshot.docs
    .map((item, idx) => {
      const raw = item.data();
      const nombre = String(
        getField(raw, ["Producto", "producto", "nombre", "Nombre", "title", "titulo", "título"])
      ).trim();
      if (!nombre) return null;

      const stock = parseNumberLoose(getField(raw, ["Stock", "stock"]));
      const precio = parseNumberLoose(
        getField(raw, ["Precio Minorista", "precioMinorista", "precio", "Precio", "price"])
      );
      const categoria = String(
        getField(raw, ["Categoria", "categoría", "categoria", "Categoría", "category"]) ||
          "Sin categoría"
      ).trim();
      const imagen = String(
        getField(raw, ["ImagenURL", "imagenURL", "imagen", "imageUrl"]) || ""
      ).trim();
      const descripcion = String(
        getField(raw, ["Descripcion", "descripción", "descripcion", "description"])
      ).trim();

      return {
        id: item.id || `${nombre}-${idx}`.replace(/\s+/g, "-").toLowerCase(),
        nombre,
        stock,
        precio,
        categoria,
        imagen,
        descripcion,
      };
    })
    .filter(Boolean);
}
