import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CityProvider } from './context/CityContext.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { CartProvider } from './context/CartContext.tsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { Footer } from './components/layout/Footer.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { ProductsPage } from './pages/ProductsPage.tsx';
import { ProductDetailPage } from './pages/ProductDetailPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { AccountPage } from './pages/AccountPage.tsx';
import { CartPage } from './pages/CartPage.tsx';
import { CheckoutPage } from './pages/CheckoutPage.tsx';
import { OrdersPage } from './pages/OrdersPage.tsx';
import { OrderDetailPage } from './pages/OrderDetailPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { RetailerDashboardPage } from './pages/RetailerDashboardPage.tsx';
import { PosTerminalPage } from './pages/PosTerminalPage.tsx';
import { RetailerBillsPage } from './pages/RetailerBillsPage.tsx';
import { BillDetailPage } from './pages/BillDetailPage.tsx';
import { RetailerNotificationsPage } from './pages/RetailerNotificationsPage.tsx';
import { MonthlyEssentialsPage } from './pages/MonthlyEssentialsPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

export const App: React.FC = () => {
  return (
    <CityProvider>
      <AuthProvider>
        <CartProvider>
          <Router>
            <div className="min-h-screen flex flex-col bg-brand-bg text-brand-text overflow-x-hidden max-w-full">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/products/:id" element={<ProductDetailPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route
                    path="/account"
                    element={
                      <ProtectedRoute>
                        <AccountPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/monthly-essentials"
                    element={
                      <ProtectedRoute allowedRoles={['customer']}>
                        <MonthlyEssentialsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/cart" element={<CartPage />} />
                  <Route
                    path="/checkout"
                    element={
                      <ProtectedRoute>
                        <CheckoutPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders"
                    element={
                      <ProtectedRoute>
                        <OrdersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders/:id"
                    element={
                      <ProtectedRoute>
                        <OrderDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/dashboard"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/retailer/dashboard"
                    element={
                      <ProtectedRoute allowedRoles={['retailer']}>
                        <RetailerDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/retailer/pos"
                    element={
                      <ProtectedRoute allowedRoles={['retailer']}>
                        <PosTerminalPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/retailer/bills"
                    element={
                      <ProtectedRoute allowedRoles={['retailer']}>
                        <RetailerBillsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/retailer/notifications"
                    element={
                      <ProtectedRoute allowedRoles={['retailer']}>
                        <RetailerNotificationsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/retailer/bills/:id"
                    element={
                      <ProtectedRoute allowedRoles={['retailer', 'admin']}>
                        <BillDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/bills/:id"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <BillDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </Router>
        </CartProvider>
      </AuthProvider>
    </CityProvider>
  );
};

export default App;
