/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'sonner';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import Landing from './pages/public/Landing';
import Booking from './pages/public/Booking';
import Terms from './pages/public/Terms';
import Privacy from './pages/public/Privacy';
import AffiliatePortal from './pages/public/AffiliatePortal';
import AffiliateSalesPage from './pages/public/AffiliateSalesPage';
import KiwifySalesPage from './pages/public/KiwifySalesPage';
import Login from './pages/admin/Login';
import Register from './pages/admin/Register';
import ForgotPassword from './pages/admin/ForgotPassword';
import ResetPassword from './pages/admin/ResetPassword';
import Dashboard from './pages/admin/Dashboard';
import Barbers from './pages/admin/Barbers';
import MyCommissions from './pages/admin/MyCommissions';
import Services from './pages/admin/Services';
import Agenda from './pages/admin/Agenda';
import Notifications from './pages/admin/Notifications';
import Clients from './pages/admin/Clients';
import Campaigns from './pages/admin/Campaigns';
import Settings from './pages/admin/Settings';
import Finances from './pages/admin/Finances';
import Packages from './pages/admin/Packages';
import Profile from './pages/admin/Profile';
import BookingSite from './pages/admin/BookingSite';
import MasterAdmin from './pages/admin/MasterAdmin';
import Subscription from './pages/admin/Subscription';
import ErrorBoundary from './components/ErrorBoundary';
import { BusinessConfigProvider } from './context/BusinessConfigContext';
import { getSessionAuth, getHomePathForRole } from './lib/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = getSessionAuth();
  if (!session.isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

function RequireMaster({ children }: { children: React.ReactNode }) {
  const session = getSessionAuth();
  if (!session.isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  if (session.role !== 'master') {
    return <Navigate to={getHomePathForRole(session.role)} replace />;
  }
  return <>{children}</>;
}

function RequireOwnerOrMaster({ children }: { children: React.ReactNode }) {
  const session = getSessionAuth();
  if (!session.isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  if (session.role === 'barber') {
    return <Navigate to="/admin/agenda" replace />;
  }
  return <>{children}</>;
}

function AdminCatchAllRedirect() {
  const session = getSessionAuth();
  if (!session.isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  return <Navigate to={getHomePathForRole(session.role)} replace />;
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <Toaster richColors position="top-right" />
      <ErrorBoundary>
        <BusinessConfigProvider>
          <BrowserRouter>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/termos" element={<Terms />} />
            <Route path="/privacidade" element={<Privacy />} />
            <Route path="/afiliado" element={<AffiliatePortal />} />
            <Route path="/parceiros" element={<AffiliatePortal />} />
            <Route path="/r/:code" element={<AffiliateSalesPage />} />
            <Route path="/vendas" element={<KiwifySalesPage defaultChannel="kiwify" />} />
            <Route path="/vendas/:platform" element={<KiwifySalesPage />} />
            <Route path="/kiwify" element={<KiwifySalesPage defaultChannel="kiwify" />} />
            <Route path="/eduzz" element={<KiwifySalesPage defaultChannel="eduzz" />} />
            <Route path="/hotmart" element={<KiwifySalesPage defaultChannel="hotmart" />} />
            <Route path="/b/:slug" element={<PublicLayout />}>
              <Route index element={<Booking />} />
            </Route>

            {/* Auth & Onboarding Routes */}
            <Route path="/cadastro" element={<Register />} />
            <Route path="/admin/cadastro" element={<Register />} />
            <Route path="/admin/recuperar-senha" element={<ForgotPassword />} />
            <Route path="/admin/redefinir-senha" element={<ResetPassword />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
              <Route index element={<RequireOwnerOrMaster><Dashboard /></RequireOwnerOrMaster>} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="barbers" element={<RequireOwnerOrMaster><Barbers /></RequireOwnerOrMaster>} />
              <Route path="services" element={<RequireOwnerOrMaster><Services /></RequireOwnerOrMaster>} />
              <Route path="clients" element={<Clients />} />
              <Route path="finances" element={<RequireOwnerOrMaster><Finances /></RequireOwnerOrMaster>} />
              <Route path="packages" element={<Navigate to="/admin/services" replace />} />
              <Route path="profile" element={<RequireOwnerOrMaster><Profile /></RequireOwnerOrMaster>} />
              <Route path="campaigns" element={<RequireOwnerOrMaster><Campaigns /></RequireOwnerOrMaster>} />
              <Route path="notifications" element={<Navigate to="/admin/campaigns" replace />} />
              <Route path="booking-site" element={<Navigate to="/admin/profile" replace />} />
              <Route path="master" element={<RequireMaster><MasterAdmin /></RequireMaster>} />
              <Route path="assinatura" element={<RequireOwnerOrMaster><Subscription /></RequireOwnerOrMaster>} />
              <Route path="comissoes" element={<MyCommissions />} />
              <Route path="automacoes" element={<Navigate to="/admin" replace />} />
              <Route path="settings" element={<RequireOwnerOrMaster><Settings /></RequireOwnerOrMaster>} />
              <Route path="*" element={<AdminCatchAllRedirect />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </BusinessConfigProvider>
    </ErrorBoundary>
    </ThemeProvider>
  );
}
