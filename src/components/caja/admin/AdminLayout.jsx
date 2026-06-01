// AdminLayout.jsx — shell del admin con paleta clara + sidebar de tabs.
// Se renderiza dentro del CajaLayout, pero su contenido (.admin-shell) tiene
// su propia paleta clara separada (admin.css) para no cansar la vista.
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/caja/admin',           end: true,  label: 'Resumen',   icon: '📊' },
  { to: '/caja/admin/productos', end: false, label: 'Productos', icon: '🍽' },
  { to: '/caja/admin/combos',    end: false, label: 'Combos',    icon: '🍱' },
  { to: '/caja/admin/reservas',  end: false, label: 'Reservas',  icon: '📅' },
  { to: '/caja/admin/mesas',     end: false, label: 'Mesas',     icon: '🪑' },
];

export function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <h2>Administración</h2>
        <nav>
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}
                     className={({ isActive }) => `admin-tab ${isActive ? 'is-active' : ''}`}>
              <span className="admin-tab-ico" aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
