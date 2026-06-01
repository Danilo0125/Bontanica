// ProtectedRoute.jsx — bloquea acceso a /caja/* si no hay sesión.
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthed } from '../../lib/cajaSession.js';

export function ProtectedRoute({ children }) {
  const loc = useLocation();
  if (!isAuthed()) {
    return <Navigate to="/caja" replace state={{ from: loc.pathname }} />;
  }
  return children;
}
