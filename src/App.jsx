// App.jsx — router shell.
// /caja/* va lazy-loaded para que los visitantes públicos NO bajen el POS
// completo + Recharts. La landing pública se mantiene en el bundle inicial.
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './components/PublicLayout.jsx';
import { ToastProvider } from './components/caja/Toasts.jsx';
import { DialogProvider } from './components/caja/Dialog.jsx';
import { AuthProvider } from './lib/auth.jsx';

// Staff: cargado solo cuando el usuario entra a /caja/*
const CajaGate            = lazy(() => import('./components/caja/CajaGate.jsx').then(m => ({ default: m.CajaGate })));
const CajaLayout          = lazy(() => import('./components/caja/CajaLayout.jsx').then(m => ({ default: m.CajaLayout })));
const ProtectedRoute      = lazy(() => import('./components/caja/ProtectedRoute.jsx').then(m => ({ default: m.ProtectedRoute })));
const MeseroView          = lazy(() => import('./components/caja/MeseroView.jsx').then(m => ({ default: m.MeseroView })));
const MeseroTableDetail   = lazy(() => import('./components/caja/MeseroTableDetail.jsx').then(m => ({ default: m.MeseroTableDetail })));
const CocinaView          = lazy(() => import('./components/caja/CocinaView.jsx').then(m => ({ default: m.CocinaView })));

// Admin: chunk separado dentro del staff (incluye Recharts ~80 KB)
const AdminLayout         = lazy(() => import('./components/caja/admin/AdminLayout.jsx').then(m => ({ default: m.AdminLayout })));
const AdminDashboard      = lazy(() => import('./components/caja/AdminDashboard.jsx').then(m => ({ default: m.AdminDashboard })));
const Products            = lazy(() => import('./components/caja/admin/Products.jsx').then(m => ({ default: m.Products })));
const Combos              = lazy(() => import('./components/caja/admin/Combos.jsx').then(m => ({ default: m.Combos })));
const Reservations        = lazy(() => import('./components/caja/admin/Reservations.jsx').then(m => ({ default: m.Reservations })));
const TablesAdmin         = lazy(() => import('./components/caja/admin/Tables.jsx').then(m => ({ default: m.TablesAdmin })));
const StaffUsers          = lazy(() => import('./components/caja/admin/StaffUsers.jsx').then(m => ({ default: m.StaffUsers })));
const Analytics           = lazy(() => import('./components/caja/admin/Analytics.jsx').then(m => ({ default: m.Analytics })));
const Activity            = lazy(() => import('./components/caja/admin/Activity.jsx').then(m => ({ default: m.Activity })));
const Flavors             = lazy(() => import('./components/caja/admin/Flavors.jsx').then(m => ({ default: m.Flavors })));

function Loading() {
  return <div style={{ padding: 40, textAlign: 'center', color: '#8b8b82', fontSize: 14 }}>Cargando…</div>;
}

export function App() {
  return (
    <AuthProvider><ToastProvider><DialogProvider><BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<PublicLayout />} />
          <Route path="/caja" element={<CajaGate />} />
          <Route
            element={
              <ProtectedRoute>
                <CajaLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/caja/mesero"
              element={<ProtectedRoute allow={['mesero', 'admin']}><MeseroView /></ProtectedRoute>}
            />
            <Route
              path="/caja/mesero/:tableId"
              element={<ProtectedRoute allow={['mesero', 'admin']}><MeseroTableDetail /></ProtectedRoute>}
            />
            <Route
              path="/caja/cocina"
              element={<ProtectedRoute allow={['cocina', 'admin']}><CocinaView /></ProtectedRoute>}
            />
            <Route
              path="/caja/admin"
              element={<ProtectedRoute allow="admin"><AdminLayout /></ProtectedRoute>}
            >
              <Route index element={<AdminDashboard />} />
              <Route path="productos" element={<Products />} />
              <Route path="combos" element={<Combos />} />
              <Route path="reservas" element={<Reservations />} />
              <Route path="mesas" element={<TablesAdmin />} />
              <Route path="usuarios" element={<StaffUsers />} />
              <Route path="analiticas" element={<Analytics />} />
              <Route path="actividad" element={<Activity />} />
              <Route path="sabores" element={<Flavors />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter></DialogProvider></ToastProvider></AuthProvider>
  );
}
