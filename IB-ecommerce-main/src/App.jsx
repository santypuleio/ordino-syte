import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ShopPage from "./pages/ShopPage.jsx";
import ProductPage from "./pages/ProductPage.jsx";
import { TenantProvider } from "./context/TenantContext.jsx";

const FALLBACK_ID = import.meta.env.VITE_FIREBASE_BUSINESS_ID || "";

function TenantShop() {
  return (
    <TenantProvider fallbackBusinessId={FALLBACK_ID}>
      <ShopPage />
    </TenantProvider>
  );
}

function TenantProduct() {
  return (
    <TenantProvider fallbackBusinessId={FALLBACK_ID}>
      <ProductPage />
    </TenantProvider>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Routes>
        <Route path="/t/:slug" element={<TenantShop />} />
        <Route path="/t/:slug/producto/:id" element={<TenantProduct />} />
        {/* Compat sin slug (usa VITE_FIREBASE_BUSINESS_ID) */}
        <Route path="/" element={<TenantShop />} />
        <Route path="/producto/:id" element={<TenantProduct />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
