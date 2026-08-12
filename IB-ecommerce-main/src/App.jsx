import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import ShopPage from "./pages/ShopPage.jsx";
import ProductPage from "./pages/ProductPage.jsx";
import { TenantProvider } from "./context/TenantContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import CartDrawer from "./components/CartDrawer.jsx";

const FALLBACK_ID = import.meta.env.VITE_FIREBASE_BUSINESS_ID || "";

function TenantLayout() {
  return (
    <TenantProvider fallbackBusinessId={FALLBACK_ID}>
      <CartProvider>
        <Outlet />
        <CartDrawer />
      </CartProvider>
    </TenantProvider>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Routes>
        <Route path="/t/:slug" element={<TenantLayout />}>
          <Route index element={<ShopPage />} />
          <Route path="producto/:id" element={<ProductPage />} />
        </Route>
        {/* Compat sin slug (usa VITE_FIREBASE_BUSINESS_ID) */}
        <Route element={<TenantLayout />}>
          <Route path="/" element={<ShopPage />} />
          <Route path="/producto/:id" element={<ProductPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
