/** Contacto y links de soporte Ordino (fuente única). */
export const SUPPORT_EMAIL = "ordino.ar@gmail.com";
export const SUPPORT_WHATSAPP_E164 = "5491121826396";
export const SUPPORT_WHATSAPP_DISPLAY = "+54 9 11 2182-6396";

export function supportMailto(subject = "Soporte Ordino") {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export function supportWhatsAppLink(text = "Hola Ordino, necesito ayuda con mi cuenta.") {
  return `https://wa.me/${SUPPORT_WHATSAPP_E164}?text=${encodeURIComponent(text)}`;
}
