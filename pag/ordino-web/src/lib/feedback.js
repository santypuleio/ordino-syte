import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

function buildMailto({ email, businessId, kind, message }) {
  const subject = encodeURIComponent(`[Ordino] Propuesta: ${kind}`);
  const body = encodeURIComponent(
    [
      message,
      "",
      "—",
      email ? `Email: ${email}` : "",
      businessId ? `Negocio: ${businessId}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );
  return `mailto:ordino.ar@gmail.com?subject=${subject}&body=${body}`;
}

/**
 * Guarda una idea / propuesta. Intenta Firestore; si falla, abre mailto.
 */
export async function submitToolProposal({
  uid,
  email = "",
  businessId = "",
  message,
  kind = "idea",
}) {
  const text = String(message || "").trim();
  if (text.length < 3) throw new Error("Escribí un poco más para que podamos entender la idea.");
  if (text.length > 3500) throw new Error("El mensaje es demasiado largo.");

  if (db && uid) {
    try {
      await addDoc(collection(db, "feedback"), {
        uid,
        email: email || "",
        businessId: businessId || "",
        kind,
        message: text,
        createdAt: serverTimestamp(),
      });
      return { via: "firestore" };
    } catch {
      // Reglas no publicadas u otro error → mailto
    }
  }

  if (typeof window !== "undefined") {
    window.location.href = buildMailto({ email, businessId, kind, message: text });
    return { via: "mailto" };
  }

  throw new Error("No se pudo enviar la propuesta.");
}
