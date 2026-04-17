/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/public/Home';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Barbers from './pages/admin/Barbers';
import Services from './pages/admin/Services';
import Agenda from './pages/admin/Agenda';
import Notifications from './pages/admin/Notifications';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    // @ts-ignore
    <ThemeProvider attribute="class" defaultTheme="light">
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<Home />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="barbers" element={<Barbers />} />
              <Route path="services" element={<Services />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
