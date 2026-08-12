import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, firebaseConfigError } from "../lib/firebase";
import { getBusiness, getUserProfile } from "../lib/tenants";

const AuthContext = createContext(null);

async function loadProfileWithRetry(uid, { retries = 4, delayMs = 350 } = {}) {
  let last = null;
  for (let i = 0; i <= retries; i += 1) {
    last = await getUserProfile(uid);
    if (last?.onboardingCompleted) return last;
    if (i < retries) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return last;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const authGen = useRef(0);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, async (next) => {
      const gen = ++authGen.current;
      setUser(next);
      if (!next) {
        setProfile(null);
        setBusiness(null);
        setLoading(false);
        return;
      }

      try {
        // Retry: tras registro+invite el doc de users puede aparecer milisegundos después
        const p = await loadProfileWithRetry(next.uid);
        if (gen !== authGen.current) return;
        setProfile(p);
        if (p?.businessId) {
          try {
            const b = await getBusiness(p.businessId);
            if (gen !== authGen.current) return;
            setBusiness(b);
          } catch (bizErr) {
            console.warn("No se pudo leer el negocio:", bizErr?.message || bizErr);
            if (gen !== authGen.current) return;
            setBusiness(null);
          }
        } else {
          setBusiness(null);
        }
      } catch (e) {
        console.warn("Perfil no disponible aún:", e?.message || e);
        if (gen !== authGen.current) return;
        setProfile(null);
        setBusiness(null);
      } finally {
        if (gen === authGen.current) setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      business,
      setProfile,
      setBusiness,
      loading,
      firebaseConfigError,
      refreshBusiness: async () => {
        if (!profile?.businessId) return null;
        const b = await getBusiness(profile.businessId);
        setBusiness(b);
        return b;
      },
      refreshProfile: async () => {
        const uid = auth?.currentUser?.uid || user?.uid;
        if (!uid) return null;
        const p = await loadProfileWithRetry(uid, { retries: 6, delayMs: 300 });
        setProfile(p);
        if (p?.businessId) {
          const b = await getBusiness(p.businessId);
          setBusiness(b);
          return { profile: p, business: b };
        }
        setBusiness(null);
        return { profile: p, business: null };
      },
      logout: async () => {
        if (auth) await signOut(auth);
      },
    }),
    [user, profile, business, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
