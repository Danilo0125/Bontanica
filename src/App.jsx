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
import { ToastProvider } from './components/caja/Toasts.jsx';

export function App() {
  return (
    <ToastProvider><BrowserRouter>
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
          <Route path="/caja/mesero" element={<MeseroView />} />
          <Route path="/caja/mesero/:tableId" element={<MeseroTableDetail />} />
          <Route path="/caja/cocina" element={<CocinaView />} />
          <Route path="/caja/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="productos" element={<Products />} />
            <Route path="combos" element={<Combos />} />
            <Route path="reservas" element={<Reservations />} />
            <Route path="mesas" element={<TablesAdmin />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter></ToastProvider>
  );
}
