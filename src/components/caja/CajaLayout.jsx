// CajaLayout.jsx — shell del área de personal (tema blanco).
// Top bar simple + bottom nav (Mesero / Cocina / Admin).
// Badge en Cocina cuenta las tandas pendientes en tiempo real.
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearSession, getSession } from '../../lib/cajaSession.js';
import { useOpenOrders } from '../../lib/useOrders.js';

const NAME_MAP = { ochito: 'Ochito', nath: 'Nath' };

const ICONS = {
  mesero: 'M4 7h16v12H4zM4 7l2-3h12l2 3M9 12h6',
  cocina: 'M7 3v6a3 3 0 0 0 6 0V3M10 3v18M17 3c-1.5 1-2 3-2 5s.5 4 2 5v8',
  admin:  'M4 19V9l8-5 8 5v10M9 19v-6h6v6',
};

function countPending(orders) {
  let n = 0;
  for (const o of orders) {
    const byBatch = new Map();
    for (const it of o.items ?? []) {
      if (!byBatch.has(it.batch_id)) byBatch.set(it.batch_id, []);
      byBatch.get(it.batch_id).push(it);
    }
    for (const b of o.batches ?? []) {
      if (b.status !== 'paid') continue;
      const its = byBatch.get(b.id) ?? [];
      if (its.some((it) => it.status === 'pending')) n++;
    }
  }
  return n;
}

export function CajaLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const session = getSession();
  const { orders } = useOpenOrders('layout-pending');

  const isCocina = loc.pathname.startsWith('/caja/cocina');
  const isAdmin = loc.pathname.startsWith('/caja/admin');
  const where = isAdmin ? 'Admin' : isCocina ? 'Cocina' : 'Mesero';
  const pending = countPending(orders);

  const logout = () => {
    clearSession();
    navigate('/caja', { replace: true });
  };

  const NAV = [
    { to: '/caja/mesero', label: 'Mesero', icon: ICONS.mesero },
    { to: '/caja/cocina', label: 'Cocina', icon: ICONS.cocina, badge: pending },
    { to: '/caja/admin',  label: 'Admin',  icon: ICONS.admin },
  ];

  return (
    <div className="staff-shell">
      <header className="staff-top">
        <div className="staff-brand">
          <span className="leaf" aria-hidden="true">🌿</span>
          <div className="staff-brand-text">
            <b>BOTÁNICA</b>
            <span>Área de personal</span>
          </div>
        </div>
        <div className="staff-who">
          <div className="staff-who-id">
            <b>{NAME_MAP[session?.server] ?? '—'}</b>
            <span>en {where}</span>
          </div>
          <button className="staff-out" onClick={logout}>Salir</button>
        </div>
      </header>

      <div className="staff-scroll">
        <div className="staff-page">
          <Outlet />
        </div>
      </div>

      <nav className="staff-nav">
        {NAV.map((n) => (
          <div className="staff-nav-wrap" key={n.to}>
            <NavLink to={n.to} end={n.to === '/caja/admin' ? false : false}
                     className={({ isActive }) => `staff-nav-item ${isActive ? 'is-active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d={n.icon} />
              </svg>
              <span>{n.label}</span>
            </NavLink>
            {n.badge > 0 && <span className="nav-badge">{n.badge}</span>}
          </div>
        ))}
      </nav>
    </div>
  );
}
