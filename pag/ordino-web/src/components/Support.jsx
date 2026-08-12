import { Link } from "react-router-dom";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, supportMailto, supportWhatsAppLink } from "../lib/support";

export function SupportLinks({ className = "", compact = false }) {
  return (
    <div className={["flex flex-wrap gap-x-4 gap-y-2 text-sm", className].join(" ")}>
      <a href={supportMailto()} className="text-zinc-400 hover:text-zinc-200">
        {compact ? "Email" : SUPPORT_EMAIL}
      </a>
      <a
        href={supportWhatsAppLink()}
        target="_blank"
        rel="noreferrer"
        className="text-zinc-400 hover:text-zinc-200"
      >
        {compact ? "WhatsApp" : `WhatsApp ${SUPPORT_WHATSAPP_DISPLAY}`}
      </a>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="font-display text-lg font-bold text-white">Ordino</div>
          <nav className="flex flex-wrap gap-4 text-sm text-zinc-500">
            <Link to="/terminos" className="hover:text-zinc-300">
              Términos
            </Link>
            <Link to="/privacidad" className="hover:text-zinc-300">
              Privacidad
            </Link>
            <Link to="/cancelar" className="hover:text-zinc-300">
              Cómo cancelar
            </Link>
            <Link to="/login" className="hover:text-zinc-300">
              Ingresar
            </Link>
          </nav>
        </div>
        <div className="flex flex-col gap-2 border-t border-white/5 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-600">Soporte</p>
          <SupportLinks />
        </div>
      </div>
    </footer>
  );
}

export function LegalShell({ title, children }) {
  return (
    <div className="relative min-h-screen overflow-hidden font-sans text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(61,214,140,0.12), transparent 55%), #07090c",
        }}
      />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-lg font-bold text-white/90">
            Ordino
          </Link>
          <SupportLinks compact className="justify-end" />
        </div>
        <h1 className="mt-10 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <div className="prose-legal mt-8 space-y-4 text-sm leading-relaxed text-zinc-300">
          {children}
        </div>
        <div className="mt-12 rounded-2xl border border-white/10 bg-ink-900/50 p-5">
          <p className="text-sm font-semibold text-white">¿Necesitás ayuda?</p>
          <p className="mt-1 text-sm text-zinc-400">
            Escribinos y te respondemos lo antes posible.
          </p>
          <SupportLinks className="mt-3" />
        </div>
        <p className="mt-8 text-xs text-zinc-600">
          <Link to="/" className="hover:text-zinc-400">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
