import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

/**
 * Landing SaaS Ordino — registro → stock + ecommerce automáticos
 */
export default function OrdinoLanding() {
  const { user, profile, loading } = useAuth();
  const loggedIn = !loading && user && profile?.onboardingCompleted;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-0 animate-glow"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(61,214,140,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 20%, rgba(30,120,90,0.12), transparent 50%), linear-gradient(180deg, #07090c 0%, #0c1016 45%, #07090c 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <header className="relative z-20 border-b border-white/5 bg-ink-950/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <a href="#" className="font-display text-xl font-bold tracking-tight text-white">
            Ordino
          </a>
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
            <a href="#como" className="hover:text-white">
              Cómo funciona
            </a>
            <a href="#incluye" className="hover:text-white">
              Qué incluye
            </a>
            <a href="#precio" className="hover:text-white">
              Precio
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {loggedIn ? (
              <Link
                to="/gestionar"
                className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-soft transition"
              >
                Mis herramientas
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:text-white"
                >
                  Ingresar
                </Link>
                <Link
                  to="/register"
                  className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-soft transition"
                >
                  Empezar gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-5xl px-4 pb-20 pt-16 sm:pt-24">
          <p className="animate-rise font-display text-sm font-semibold uppercase tracking-[0.2em] text-signal">
            Ordino
          </p>
          <h1 className="animate-rise-delay mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Tu stock y tu tienda online, listos al registrarte.
          </h1>
          <p className="animate-rise-delay-2 mt-5 max-w-xl text-lg text-zinc-400">
            Creá tu cuenta, configurá tu marca y en minutos tenés un gestor de stock y un
            ecommerce con tu logo, colores y link propio. Dos meses gratis.
          </p>
          <div className="animate-rise-delay-2 mt-8 flex flex-wrap items-center gap-3">
            {loggedIn ? (
              <Link
                to="/gestionar"
                className="rounded-xl bg-signal px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-signal-soft transition"
              >
                Ir a mis herramientas
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="rounded-xl bg-signal px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-signal-soft transition"
                >
                  Crear mi cuenta gratis
                </Link>
                <Link
                  to="/login"
                  className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10 transition"
                >
                  Ya tengo cuenta
                </Link>
              </>
            )}
          </div>
        </section>

        <section id="como" className="scroll-mt-24 border-t border-white/5 bg-ink-900/40 py-20">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Tres pasos. Sin implementaciones eternas.
            </h2>
            <p className="mt-3 max-w-lg text-zinc-400">
              No contratás un proyecto a medida: activás tu propia plataforma.
            </p>
            <ol className="mt-12 grid gap-10 sm:grid-cols-3">
              {[
                {
                  n: "01",
                  t: "Registrate",
                  d: "Email y contraseña. Listo.",
                },
                {
                  n: "02",
                  t: "Configurá tu marca",
                  d: "Nombre, link, colores, logo y WhatsApp.",
                },
                {
                  n: "03",
                  t: "Usá stock + tienda",
                  d: "Cargá productos en el gestor y se ven en tu ecommerce.",
                },
              ].map((step) => (
                <li key={step.n}>
                  <div className="font-display text-sm font-bold text-signal">{step.n}</div>
                  <h3 className="mt-3 font-display text-xl font-bold text-white">{step.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="incluye" className="scroll-mt-24 py-20">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Qué se genera solo para vos
            </h2>
            <div className="mt-12 grid gap-8 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-ink-800/80 to-ink-950 p-8">
                <h3 className="font-display text-2xl font-bold text-white">Gestor de stock</h3>
                <p className="mt-3 text-zinc-400">
                  Productos, ventas, compras y reportes. Privado, solo para tu cuenta.
                </p>
                <ul className="mt-6 space-y-2 text-sm text-zinc-300">
                  <li>· Control de stock en vivo</li>
                  <li>· Movimientos de venta y compra</li>
                  <li>· Misma base que alimenta tu tienda</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-signal/25 bg-gradient-to-br from-signal/10 to-ink-950 p-8">
                <h3 className="font-display text-2xl font-bold text-white">Tienda online</h3>
                <p className="mt-3 text-zinc-400">
                  Catálogo público con tu marca. Link propio para compartir con clientes.
                </p>
                <ul className="mt-6 space-y-2 text-sm text-zinc-300">
                  <li>· Branding (logo y colores)</li>
                  <li>· Stock sincronizado</li>
                  <li>· Consulta / compra por WhatsApp</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="precio" className="scroll-mt-24 border-t border-white/5 bg-ink-900/40 py-20">
          <div className="mx-auto max-w-5xl px-4 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Simple de precio también
            </h2>
            <p className="mx-auto mt-3 max-w-md text-zinc-400">
              Probá sin tarjeta. Después, un solo plan.
            </p>
            <div className="mx-auto mt-10 max-w-sm rounded-3xl border border-signal/30 bg-ink-950/80 px-8 py-10">
              <div className="text-sm font-medium uppercase tracking-wider text-signal">
                Trial + plan
              </div>
              <div className="mt-4 font-display text-5xl font-extrabold text-white">
                USD 4.99
                <span className="text-lg font-medium text-zinc-500"> / mes</span>
              </div>
              <p className="mt-3 text-sm text-zinc-400">
                Los primeros <strong className="text-zinc-200">2 meses gratis</strong>. Después,
                USD 4.99 al mes. Stock + ecommerce incluidos.
              </p>
              <Link
                to={loggedIn ? "/gestionar" : "/register"}
                className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-signal px-4 py-3 text-sm font-semibold text-ink-950 hover:bg-signal-soft transition"
              >
                {loggedIn ? "Abrir panel" : "Empezar trial gratis"}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center">
          <div className="font-display text-lg font-bold text-white">Ordino</div>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
            <a href="mailto:ordino.ar@gmail.com" className="hover:text-zinc-300">
              ordino.ar@gmail.com
            </a>
            <Link to="/login" className="hover:text-zinc-300">
              Ingresar
            </Link>
            <Link to="/register" className="hover:text-zinc-300">
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
