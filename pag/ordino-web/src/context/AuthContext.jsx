import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, firebaseConfigError } from "../lib/firebase";
import { getBusiness, getUserProfile } from "../lib/tenants";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (!next) {
        setProfile(null);
        setBusiness(null);
        setLoading(false);
        return;
      }

      try {
        const p = await getUserProfile(next.uid);
        setProfile(p);
        if (p?.businessId) {
          try {
            const b = await getBusiness(p.businessId);
            setBusiness(b);
          } catch (bizErr) {
            console.warn("No se pudo leer el negocio:", bizErr?.message || bizErr);
            setBusiness(null);
          }
        } else {
          setBusiness(null);
        }
      } catch (e) {
        // Sin doc de usuario aún (recién registrado) o rules viejas: no romper la sesión
        console.warn("Perfil no disponible aún:", e?.message || e);
        setProfile(null);
        setBusiness(null);
      } finally {
        setLoading(false);
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
