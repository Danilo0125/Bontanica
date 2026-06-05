// ProtectedRoute.jsx — bloquea /caja/* sin sesión y verifica rol si se piden.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';

export function ProtectedRoute({ children, allow }) {
  const loc = useLocation();
  const { profile, loading } = useAuth();

  if (loading) {
    return <div className="staff-shell"><div className="s-empty">Cargando…</div></div>;
  }

  if (!profile || !profile.is_active) {
    return <Navigate to="/caja" replace state={{ from: loc.pathname }} />;
  }

  // allow = string | array | undefined. undefined = cualquier rol autenticado.
  if (allow) {
    const allowed = Array.isArray(allow) ? allow : [allow];
    if (!allowed.includes(profile.role)) {
      return <Navigate to={defaultPathForRole(profile.role)} replace />;
    }
  }

  return children;
}

function defaultPathForRole(role) {
  if (role === 'mesero') return '/caja/mesero';
  if (role === 'cocina') return '/caja/cocina';
  if (role === 'admin')  return '/caja/admin';
  return '/caja';
}
