// AdminLayout.jsx — shell del admin con subnav horizontal de pills (envuelven).
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/caja/admin',           end: true,  label: 'Resumen' },
  { to: '/caja/admin/productos', end: false, label: 'Productos' },
  { to: '/caja/admin/combos',    end: false, label: 'Combos' },
  { to: '/caja/admin/reservas',  end: false, label: 'Reservas' },
  { to: '/caja/admin/mesas',     end: false, label: 'Mesas' },
];

export function AdminLayout() {
  return (
    <div>
      <h1 className="s-h1">Administración</h1>
      <div className="admin-subnav">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
                   className={({ isActive }) => `admin-pill ${isActive ? 'is-active' : ''}`}>
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
