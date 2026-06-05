// ProtectedRoute.jsx — bloquea /caja/* sin sesión y verifica rol si se piden.
import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from './Toasts.jsx';

export function ProtectedRoute({ children, allow }) {
  const loc = useLocation();
  const { profile, loading } = useAuth();
  const toast = useToast();
  const warned = useRef(false);

  // Toast cuando el usuario intenta entrar a una ruta de otro rol. Se dispara
  // post-render (effect) para evitar el warning de setState en render.
  const isWrongRole = profile && allow && (Array.isArray(allow) ? allow : [allow]).includes(profile.role) === false;
  useEffect(() => {
    if (isWrongRole && !warned.current) {
      warned.current = true;
      toast.info(`Tu rol "${profile.role}" no tiene acceso a esa sección`);
    }
  }, [isWrongRole, profile?.role, toast]);

  if (loading) {
    return <div className="staff-shell"><div className="s-empty">Cargando…</div></div>;
  }

  if (!profile || !profile.is_active) {
    return <Navigate to="/caja" replace state={{ from: loc.pathname }} />;
  }

  if (isWrongRole) {
    return <Navigate to={defaultPathForRole(profile.role)} replace />;
  }

  return children;
}

function defaultPathForRole(role) {
  if (role === 'mesero') return '/caja/mesero';
  if (role === 'cocina') return '/caja/cocina';
  if (role === 'admin')  return '/caja/admin';
  return '/caja';
}
