import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, firebaseConfigError } from "../lib/firebase";
import { googleAuthErrorMessage, signInWithGoogle } from "../lib/googleAuth";
import { useAuth } from "../context/AuthContext";
import { getUserProfile } from "../lib/tenants";
import { acceptTeamInvite, getInviteByToken, isInviteValid, rememberInviteToken, clearInviteToken, peekInviteToken } from "../lib/team";
import GoogleAuthButton, { AuthDivider } from "../components/GoogleAuthButton";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") || peekInviteToken() || "";
  const { user, profile, loading, logout, setProfile, setBusiness, refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [invitePreview, setInvitePreview] = useState(null);

  useEffect(() => {
    if (inviteToken) rememberInviteToken(inviteToken);
  }, [inviteToken]);

  useEffect(() => {
    if (!inviteToken) return;
    let alive = true;
    (async () => {
      try {
        const inv = await getInviteByToken(inviteToken);
        if (!alive) return;
        const check = isInviteValid(inv);
        if (check.ok) {
          setInvitePreview(inv);
          setEmail(inv.email || "");
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [inviteToken]);

  if (!loading && user && profile?.onboardingCompleted === true && !inviteToken) {
    return <Navigate to="/gestionar" replace />;
  }

  async function continueAfterAuth(cred) {
    const invitedEmail = (invitePreview?.email || "").toLowerCase();
    const signedEmail = (cred.user.email || "").toLowerCase();
    if (inviteToken && invitedEmail && signedEmail !== invitedEmail) {
      await logout();
      throw new Error(`Esta invitación es para ${invitePreview.email}.`);
    }

    if (inviteToken) {
      await acceptTeamInvite(inviteToken, {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName,
      });
      await refreshProfile?.();
      clearInviteToken();
      navigate("/gestionar", { replace: true });
      return;
    }

    const p = await getUserProfile(cred.user.uid);
    setProfile(p);
    if (p?.onboardingCompleted) {
      navigate("/gestionar", { replace: true });
    } else {
      navigate("/onboarding", { replace: true });
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (firebaseConfigError) {
      setError(firebaseConfigError);
      return;
    }
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await continueAfterAuth(cred);
    } catch (err) {
      setError(err?.message || "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError("");
    if (firebaseConfigError) {
      setError(firebaseConfigError);
      return;
    }
    setBusy(true);
    try {
      const cred = await signInWithGoogle();
      await continueAfterAuth(cred);
    } catch (err) {
      const message = googleAuthErrorMessage(err);
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function useOtherAccount() {
    setBusy(true);
    try {
      await logout();
      setProfile(null);
      setBusiness(null);
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
          {invitePreview ? "Ingresar y unirte" : "Ingresar"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {invitePreview
            ? `Unite a ${invitePreview.businessName} con tu cuenta.`
            : "Entrá con Google o con tu email para ir a stock y tienda."}
        </p>

        {!loading && user && profile?.onboardingCompleted !== true && !inviteToken ? (
          <div className="mt-8 space-y-3 rounded-2xl border border-white/10 bg-ink-900/60 p-6 backdrop-blur">
            <p className="text-sm text-zinc-300">
              Hay una sesión activa ({user.email || "tu cuenta"}), pero todavía no
              terminó la configuración de marca.
            </p>
            <Link
              to="/onboarding"
              className="flex w-full items-center justify-center rounded-xl bg-signal px-4 py-3 text-sm font-semibold text-ink-950 hover:bg-signal-soft"
            >
              Completar configuración
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={useOtherAccount}
              className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-60"
            >
              Usar otra cuenta
            </button>
          </div>
        ) : null}

        <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-ink-900/60 p-6 backdrop-blur">
          <GoogleAuthButton disabled={busy} onClick={onGoogle} label="Ingresar con Google" />
          <AuthDivider />
        <form
          onSubmit={onSubmit}
          className="space-y-4"
        >
          <label className="block text-sm">
            <span className="text-zinc-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              readOnly={Boolean(invitePreview?.email)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 outline-none focus:border-signal disabled:opacity-70"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 outline-none focus:border-signal"
              required
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
            {busy ? "Entrando…" : invitePreview ? "Ingresar y unirme" : "Ingresar"}
          </button>
        </form>
        </div>

        <p className="mt-6 text-sm text-zinc-500">
          ¿Primera vez?{" "}
          <Link
            to={inviteToken ? `/register?invite=${encodeURIComponent(inviteToken)}` : "/register"}
            className="font-medium text-signal hover:text-signal-soft"
          >
            Crear cuenta gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
