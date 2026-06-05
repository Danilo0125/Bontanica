// App.jsx — router shell.
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './components/PublicLayout.jsx';
import { CajaGate } from './components/caja/CajaGate.jsx';
import { CajaLayout } from './components/caja/CajaLayout.jsx';
import { ProtectedRoute } from './components/caja/ProtectedRoute.jsx';
import { MeseroView } from './components/caja/MeseroView.jsx';
import { MeseroTableDetail } from './components/caja/MeseroTableDetail.jsx';
import { CocinaView } from './components/caja/CocinaView.jsx';
import { AdminDashboard } from './components/caja/AdminDashboard.jsx';
import { AdminLayout } from './components/caja/admin/AdminLayout.jsx';
import { Products } from './components/caja/admin/Products.jsx';
import { Combos } from './components/caja/admin/Combos.jsx';
import { Reservations } from './components/caja/admin/Reservations.jsx';
import { TablesAdmin } from './components/caja/admin/Tables.jsx';
import { StaffUsers } from './components/caja/admin/StaffUsers.jsx';
import { Analytics } from './components/caja/admin/Analytics.jsx';
import { Activity } from './components/caja/admin/Activity.jsx';
import { ToastProvider } from './components/caja/Toasts.jsx';
import { AuthProvider } from './lib/auth.jsx';

export function App() {
  return (
    <AuthProvider><ToastProvider><BrowserRouter>
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
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter></ToastProvider></AuthProvider>
  );
}
