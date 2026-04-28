/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import Booking from './pages/public/Booking';
import Login from './pages/admin/Login';
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
import VisualIdentity from './pages/admin/VisualIdentity';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    // @ts-ignore
    <ThemeProvider attribute="class" defaultTheme="light">
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/b/:slug" element={<PublicLayout />}>
              <Route index element={<Booking />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="barbers" element={<Barbers />} />
              <Route path="services" element={<Services />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="clients" element={<Clients />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="finances" element={<Finances />} />
              <Route path="packages" element={<Packages />} />
              <Route path="visual" element={<VisualIdentity />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
