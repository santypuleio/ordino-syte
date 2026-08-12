import { Link } from "react-router-dom";
import { LegalShell } from "../components/Support";

export default function TermsPage() {
  return (
    <LegalShell title="Términos de uso">
      <p className="text-zinc-500">Última actualización: agosto 2026</p>

      <p>
        Estos términos regulan el uso de Ordino (software de gestión de stock y catálogo online)
        operado desde Argentina. Al crear una cuenta o usar el servicio, aceptás estos términos.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">1. El servicio</h2>
      <p>
        Ordino permite crear y administrar un negocio (marca), cargar productos, registrar ventas y
        compras, y publicar un catálogo online. La compra de productos del catálogo se gestiona por
        WhatsApp u otros medios definidos por cada comercio; Ordino no es intermediario de esas
        ventas.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">2. Cuentas y equipo</h2>
      <p>
        El dueño de la cuenta es responsable de la información cargada, de las invitaciones a
        empleados y del uso que hagan de su acceso. Debés mantener segura tu contraseña y avisar si
        detectás uso no autorizado.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">3. Prueba y suscripción</h2>
      <p>
        Ofrecemos un período de prueba (habitualmente 30 días). Luego el plan es mensual (precio
        publicado en el sitio, cobrado vía Mercado Pago en ARS o el medio indicado). Si un cobro
        falla, puede haber un período de gracia breve; después el acceso puede bloquearse hasta
        regularizar el pago.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">4. Cancelación</h2>
      <p>
        Podés cancelar la suscripción desde el panel{" "}
        <Link to="/cancelar" className="text-signal hover:underline">
          (cómo cancelar)
        </Link>
        . Al cancelar, conservás el acceso hasta el fin del período ya pagado. Los datos del
        negocio se conservan según nuestra política de privacidad; no borramos tu catálogo solo por
        cancelar.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">5. Uso aceptable</h2>
      <p>
        No está permitido usar Ordino para actividades ilegales, abusar de la infraestructura,
        intentar acceder a cuentas ajenas ni revender el servicio sin autorización.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">6. Disponibilidad</h2>
      <p>
        Trabajamos para que el servicio esté disponible, pero no garantizamos uptime 100%. Pueden
        existir mantenimientos, fallas de terceros (Firebase, Netlify, Mercado Pago, WhatsApp) u
        otros imprevistos.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">7. Limitación</h2>
      <p>
        En la máxima medida permitida por la ley argentina, Ordino no responde por lucro cesante,
        pérdida de datos por causas ajenas razonables, ni daños indirectos derivados del uso del
        servicio. Nuestra responsabilidad total, si correspondiera, se limita a lo abonado en los
        últimos 3 meses de suscripción.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">8. Contacto</h2>
      <p>
        Consultas: ordino.ar@gmail.com · WhatsApp +54 9 11 2182-6396.
      </p>
    </LegalShell>
  );
}
