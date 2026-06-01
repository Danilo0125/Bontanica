// CajaLayout.jsx — shell común de las rutas protegidas de caja.
// Header con nombre del mesero, switch mesero/cocina, logout.
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { clearSession, getSession } from '../../lib/cajaSession.js';

const NAME_MAP = { ochito: 'Ochito', nath: 'Nath' };

export function CajaLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const session = getSession();
  const isCocina = loc.pathname.startsWith('/caja/cocina');

  const logout = () => {
    clearSession();
    navigate('/caja', { replace: true });
  };

  return (
    <div className="caja-shell">
      <header className="caja-top">
        <div className="caja-top-left">
          <span className="caja-leaf" aria-hidden="true">🌿</span>
          <div className="caja-top-id">
            <strong>{NAME_MAP[session?.server] ?? '—'}</strong>
            <span>en {isCocina ? 'Cocina' : 'Mesero'}</span>
          </div>
        </div>
        <div className="caja-top-tabs" role="tablist">
          <Link to="/caja/mesero" role="tab" aria-selected={!isCocina}
                className={`caja-tab ${!isCocina ? 'is-active' : ''}`}>Mesero</Link>
          <Link to="/caja/cocina" role="tab" aria-selected={isCocina}
                className={`caja-tab ${isCocina ? 'is-active' : ''}`}>Cocina</Link>
        </div>
        <button className="caja-top-out" onClick={logout} aria-label="Salir">
          Salir
        </button>
      </header>
      <main className="caja-main">
        <div className="caja-main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
