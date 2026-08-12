import { Link } from "react-router-dom";
import { LegalShell } from "../components/Support";

export default function CancelPage() {
  return (
    <LegalShell title="Cómo cancelar">
      <p>
        Podés cancelar la suscripción de Ordino en cualquier momento. No hace falta mandar un mail
        para eso (aunque si preferís, también te ayudamos por soporte).
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">Pasos</h2>
      <ol className="list-decimal space-y-3 pl-5">
        <li>
          Ingresá a tu cuenta:{" "}
          <Link to="/login" className="text-signal hover:underline">
            /login
          </Link>
        </li>
        <li>
          Andá a{" "}
          <Link to="/dashboard" className="text-signal hover:underline">
            Suscripción
          </Link>{" "}
          (`/dashboard`).
        </li>
        <li>
          Tocá <strong className="text-zinc-100">Cancelar suscripción</strong> y confirmá.
        </li>
      </ol>

      <h2 className="pt-4 font-display text-lg font-bold text-white">Qué pasa después</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Se deja de renovar el cobro mensual en Mercado Pago.</li>
        <li>
          Seguis teniendo acceso hasta el <strong className="text-zinc-100">fin del período ya
          pagado</strong> (si aplica).
        </li>
        <li>
          Tus productos y datos del negocio <strong className="text-zinc-100">no se borran</strong>{" "}
          solo por cancelar. Si más adelante reactivás, podés retomar.
        </li>
        <li>
          Si estás en <strong className="text-zinc-100">prueba gratis</strong> y no activás un plan,
          al vencer el trial el acceso se bloquea pero los datos se conservan.
        </li>
      </ul>

      <h2 className="pt-4 font-display text-lg font-bold text-white">¿No podés entrar al panel?</h2>
      <p>
        Escribinos a <strong className="text-zinc-100">ordino.ar@gmail.com</strong> o por WhatsApp{" "}
        <strong className="text-zinc-100">+54 9 11 2182-6396</strong> con el email de la cuenta y te
        ayudamos a cancelar.
      </p>
    </LegalShell>
  );
}
