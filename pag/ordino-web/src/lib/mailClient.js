import { auth } from "./firebase";

/** Dispara un email de ciclo de vida (bienvenida, etc.). Falla en silencio si no hay mail config. */
export async function requestLifecycleEmail(type, { businessId } = {}) {
  try {
    const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
    if (!idToken) return { ok: false };
    const res = await fetch("/.netlify/functions/send-lifecycle-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ type, businessId }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, ...data };
  } catch {
    return { ok: false };
  }
}
