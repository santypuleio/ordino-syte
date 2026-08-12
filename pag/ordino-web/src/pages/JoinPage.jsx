import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  acceptTeamInvite,
  getInviteByToken,
  isInviteValid,
} from "../lib/team";

export default function JoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [invite, setInvite] = useState(null);
  const [inviteError, setInviteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [acceptError, setAcceptError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) {
        setInviteError("Link de invitación inválido.");
        setChecking(false);
        return;
      }
      try {
        const data = await getInviteByToken(token);
        if (!alive) return;
        const check = isInviteValid(data);
        if (!check.ok) {
          setInviteError(check.reason);
          setInvite(null);
        } else {
          setInvite(data);
        }
      } catch (e) {
        if (!alive) return;
        setInviteError(e?.message || "No se pudo cargar la invitación.");
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (!checking && !loading && profile?.businessId && invite?.businessId === profile.businessId) {
    return <Navigate to="/gestionar" replace />;
  }

  const registerUrl = `/register?invite=${encodeURIComponent(token || "")}`;
  const loginUrl = `/login?invite=${encodeURIComponent(token || "")}`;

  async function handleAccept() {
    if (!user || !token) return;
    setBusy(true);
    setAcceptError("");
    try {
      await acceptTeamInvite(token, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
      await refreshProfile?.();
      navigate("/gestionar", { replace: true });
    } catch (e) {
      setAcceptError(e?.message || "No se pudo unir al equipo.");
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

        {checking || loading ? (
          <p className="mt-10 text-zinc-400">Cargando invitación…</p>
        ) : inviteError ? (
          <div className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <h1 className="font-display text-2xl font-bold">Invitación no válida</h1>
            <p className="mt-2 text-sm text-zinc-300">{inviteError}</p>
            <Link
              to="/login"
              className="mt-4 inline-block text-sm font-semibold text-signal hover:text-signal-soft"
            >
              Ir a ingresar
            </Link>
          </div>
        ) : invite ? (
          <>
            <h1 className="mt-10 font-display text-3xl font-extrabold tracking-tight">
              Te invitaron a un equipo
            </h1>
            <p className="mt-3 text-zinc-400">
              Vas a unirte a{" "}
              <span className="font-semibold text-white">{invite.businessName}</span> como
              empleado. Podrás usar el gestor de stock de esa marca.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Invitación para: <span className="text-zinc-300">{invite.email}</span>
            </p>

            {acceptError ? (
              <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {acceptError}
              </div>
            ) : null}

            {user ? (
              <div className="mt-8 space-y-3">
                <p className="text-sm text-zinc-300">Sesión activa: {user.email}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleAccept}
                  className="w-full rounded-xl bg-signal px-4 py-3 font-semibold text-ink-950 hover:bg-signal-soft disabled:opacity-60"
                >
                  {busy ? "Uniéndote…" : `Unirme a ${invite.businessName}`}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(loginUrl)}
                  className="w-full text-sm text-zinc-500 hover:text-zinc-300"
                >
                  Usar otra cuenta
                </button>
              </div>
            ) : (
              <div className="mt-8 grid gap-3">
                <Link
                  to={registerUrl}
                  className="flex w-full items-center justify-center rounded-xl bg-signal px-4 py-3 font-semibold text-ink-950 hover:bg-signal-soft"
                >
                  Crear cuenta y unirme
                </Link>
                <Link
                  to={loginUrl}
                  className="flex w-full items-center justify-center rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-white/5"
                >
                  Ya tengo cuenta — ingresar
                </Link>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
