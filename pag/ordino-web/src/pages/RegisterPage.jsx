import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, firebaseConfigError } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user && profile?.onboardingCompleted === true) {
    return <Navigate to="/gestionar" replace />;
  }
  // Si ya hay sesión sin onboarding, el alta de marca es el siguiente paso
  if (!loading && user && profile && profile.onboardingCompleted !== true) {
    return <Navigate to="/onboarding" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (firebaseConfigError) {
      setError(firebaseConfigError);
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setError(err?.message || "No se pudo crear la cuenta");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden font-sans text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(61,214,140,0.16), transparent 55%), #07090c",
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <Link to="/" className="font-display text-xl font-bold text-white">
          Ordino
        </Link>
        <h1 className="mt-8 font-display text-3xl font-extrabold tracking-tight">
          Crear cuenta
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          En el siguiente paso configurás tu marca y se generan stock + tienda.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-ink-900/60 p-6 backdrop-blur"
        >
          <label className="block text-sm">
            <span className="text-zinc-400">Tu nombre</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 outline-none focus:border-signal"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 outline-none focus:border-signal"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 outline-none focus:border-signal"
              required
              minLength={6}
            />
          </label>

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-signal px-4 py-3 font-semibold text-ink-950 hover:bg-signal-soft disabled:opacity-60 transition"
          >
            {busy ? "Creando…" : "Continuar"}
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-500">
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="font-medium text-signal hover:text-signal-soft">
            Ingresar
          </Link>
        </p>
      </div>
    </div>
  );
}
