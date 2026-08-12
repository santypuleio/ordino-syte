import { LegalShell } from "../components/Support";

export default function PrivacyPage() {
  return (
    <LegalShell title="Política de privacidad">
      <p className="text-zinc-500">Última actualización: agosto 2026</p>

      <p>
        Esta política explica qué datos tratamos en Ordino y para qué. Operamos desde Argentina y
        usamos proveedores cloud (Firebase / Google, Netlify, Mercado Pago) para prestar el
        servicio.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">1. Datos que recopilamos</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong className="text-zinc-200">Cuenta:</strong> email, nombre, contraseña (gestionada
          por Firebase Auth), rol (dueño / empleado).
        </li>
        <li>
          <strong className="text-zinc-200">Negocio:</strong> nombre de marca, slug, logo, colores,
          WhatsApp de pedidos, productos, ventas y compras que cargues.
        </li>
        <li>
          <strong className="text-zinc-200">Facturación:</strong> estado de suscripción e
          identificadores de Mercado Pago necesarios para el cobro (no almacenamos el número
          completo de tu tarjeta).
        </li>
        <li>
          <strong className="text-zinc-200">Soporte / feedback:</strong> mensajes que nos envíes.
        </li>
        <li>
          <strong className="text-zinc-200">Técnicos:</strong> logs básicos de errores y uso del
          hosting (Netlify / Firebase).
        </li>
      </ul>

      <h2 className="pt-4 font-display text-lg font-bold text-white">2. Para qué los usamos</h2>
      <p>
        Prestarte el servicio, autenticarte, cobrar la suscripción, enviarte emails operativos
        (bienvenida, aviso de fin de prueba, problemas de pago), responder soporte y mejorar
        Ordino.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">3. Con quién se comparten</h2>
      <p>
        No vendemos tus datos. Se procesan con proveedores necesarios: Google Firebase (auth y
        base de datos), Netlify (hosting y funciones), Mercado Pago (pagos). El catálogo público de
        tu tienda es visible para quien tenga el link.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">4. Conservación</h2>
      <p>
        Conservamos los datos mientras tu cuenta exista o sea necesario para el servicio, cobros y
        obligaciones legales. Si cancelás, tus datos de negocio pueden permanecer para que puedas
        reactivar; si pedís borrado, escribinos a ordino.ar@gmail.com.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">5. Seguridad</h2>
      <p>
        Usamos autenticación de Firebase y reglas de acceso en Firestore. Ningún sistema es 100%
        infalible; te pedimos contraseñas fuertes y no compartir accesos de dueño.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">6. Tus derechos</h2>
      <p>
        Podés pedir acceso, corrección o eliminación de datos personales escribiendo a
        ordino.ar@gmail.com. También podés cancelar la suscripción desde el panel.
      </p>

      <h2 className="pt-4 font-display text-lg font-bold text-white">7. Contacto</h2>
      <p>ordino.ar@gmail.com · WhatsApp +54 9 11 2182-6396.</p>
    </LegalShell>
  );
}
