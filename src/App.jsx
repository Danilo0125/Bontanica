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

export function App() {
  return (
    <BrowserRouter>
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
          <Route path="/caja/admin" element={<AdminDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
