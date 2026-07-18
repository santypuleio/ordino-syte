import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getSubscriptionState, resolveTenantBySlug } from "../lib/tenants";

const TenantContext = createContext(null);

export function TenantProvider({ children, fallbackBusinessId = "" }) {
  const { slug } = useParams();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const effectiveSlug = slug || fallbackBusinessId;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!effectiveSlug) {
        setBusiness(null);
        setError("Abrí la tienda con /t/tu-marca");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError("");
        let tenant = await resolveTenantBySlug(effectiveSlug);
        // Compat demo / env fallback without slug doc
        if (!tenant && fallbackBusinessId && effectiveSlug === fallbackBusinessId) {
          tenant = {
            id: fallbackBusinessId,
            name: "Ordino Ecommerce",
            slug: fallbackBusinessId,
            primaryColor: "#10b981",
            accentColor: "#34d399",
            logoUrl: "",
            whatsapp: "",
            subscriptionStatus: "active",
          };
        }
        if (!alive) return;
        if (!tenant) {
          setBusiness(null);
          setError(`No encontramos la tienda “${effectiveSlug}”.`);
        } else {
          setBusiness(tenant);
        }
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Error cargando la tienda");
        setBusiness(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [effectiveSlug, fallbackBusinessId]);

  const value = useMemo(() => {
    const sub = getSubscriptionState(business);
    return {
      business,
      businessId: business?.id || effectiveSlug || "",
      slug: business?.slug || effectiveSlug || "",
      loading,
      error,
      subscription: sub,
      primaryColor: business?.primaryColor || "#10b981",
      accentColor: business?.accentColor || "#34d399",
      logoUrl: business?.logoUrl || "",
      brandName: business?.name || "Tienda",
      whatsapp: business?.whatsapp || "",
    };
  }, [business, effectiveSlug, loading, error]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant debe usarse dentro de TenantProvider");
  return ctx;
}
