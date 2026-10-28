import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { TelemetryProvider } from './context/TelemetryContext';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { ArchitectureShowcasePage } from './pages/ArchitectureShowcasePage';
import { AuthPage } from './pages/AuthPage';
import { CatalogPage } from './pages/CatalogPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProfilePage } from './pages/ProfilePage';

export const App: React.FC = () => {
  return (
    <TelemetryProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<CatalogPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/architecture" element={<ArchitectureShowcasePage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/login" element={<Navigate to="/auth" replace />} />
                <Route
                  path="/register"
                  element={<Navigate to="/auth" replace />}
                />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/admin/products" element={<AdminProductsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TelemetryProvider>
  );
};
