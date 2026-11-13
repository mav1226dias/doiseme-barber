/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import Landing from './pages/public/Landing';
import Booking from './pages/public/Booking';
import Login from './pages/admin/Login';
import Register from './pages/admin/Register';
import ForgotPassword from './pages/admin/ForgotPassword';
import ResetPassword from './pages/admin/ResetPassword';
import Dashboard from './pages/admin/Dashboard';
import Barbers from './pages/admin/Barbers';
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

export default function App() {
  return (
    // @ts-ignore
    <ThemeProvider attribute="class" defaultTheme="light">
      <Toaster richColors position="top-right" />
      <ErrorBoundary>
        <BusinessConfigProvider>
          <BrowserRouter>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
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
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="barbers" element={<Barbers />} />
              <Route path="services" element={<Services />} />
              <Route path="clients" element={<Clients />} />
              <Route path="finances" element={<Finances />} />
              <Route path="packages" element={<Navigate to="/admin/services" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="notifications" element={<Navigate to="/admin/campaigns" replace />} />
              <Route path="booking-site" element={<Navigate to="/admin/profile" replace />} />
              <Route path="master" element={<MasterAdmin />} />
              <Route path="assinatura" element={<Subscription />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </BusinessConfigProvider>
    </ErrorBoundary>
    </ThemeProvider>
  );
}
