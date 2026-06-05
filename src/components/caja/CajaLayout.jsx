// CajaLayout.jsx — shell del área de personal (tema blanco).
// Top bar simple + bottom nav (Mesero / Cocina / Admin).
// Badge en Cocina cuenta las tandas pendientes en tiempo real.
import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearSession, getSession } from '../../lib/cajaSession.js';
import { useOpenOrders } from '../../lib/useOrders.js';
import { ensureAudioCtx, playBeep } from '../../lib/audio.js';
import { useTables } from '../../lib/useTables.js';
import { useToast } from './Toasts.jsx';

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
  const { orders, loading: ordersLoading } = useOpenOrders('layout-pending');
  const { tables } = useTables();
  const toast = useToast();

  // iOS/Safari y Chrome móvil exigen un user gesture antes de abrir AudioContext.
  // Si el mesero entra al shell con sesión guardada (sin pasar por CajaGate),
  // capturamos el primer pointerdown para desbloquear los beeps de cocina/mesero.
  useEffect(() => {
    const unlock = () => { ensureAudioCtx(); };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    return () => window.removeEventListener('pointerdown', unlock, { capture: true });
  }, []);

  // Aviso global de "tanda lista para entregar" — se dispara desde cualquier
  // ruta del staff (mesero, cocina, admin). Filtramos por server_id para que
  // cada mesero escuche solo lo suyo. La detección usa last_notified_at del
  // batch, que cocina bumpea al marcar listo y al tocar "Volver a notificar".
  const lastNotifiedRef = useRef(new Map()); // batchId -> last_notified_at iso
  const seededRef = useRef(false);
  useEffect(() => {
    // No seedeamos contra una lista parcial — esperamos al primer fetch completo
    // para evitar que las tandas pre-existentes vuelvan a sonar al recargar.
    if (ordersLoading) return;
    const currentServer = session?.server;
    if (!currentServer) return;
    const tableNameById = new Map(tables.map((t) => [t.id, t.name]));
    const fresh = new Map();
    const newNotifications = [];
    for (const o of orders) {
      for (const b of o.batches ?? []) {
        if (b.status !== 'paid') continue;
        if (!b.last_notified_at) continue;
        if (b.server_id !== currentServer) continue;
        fresh.set(b.id, b.last_notified_at);
        const prev = lastNotifiedRef.current.get(b.id);
        if (seededRef.current && prev !== b.last_notified_at) {
          newNotifications.push({ batchId: b.id, tableId: o.table_id });
        }
      }
    }
    lastNotifiedRef.current = fresh;
    if (!seededRef.current) { seededRef.current = true; return; }
    for (const n of newNotifications) {
      playBeep('delivered');
      const tableName = tableNameById.get(n.tableId) ?? `Mesa ${n.tableId}`;
      toast.ready(`${tableName} · tanda lista para entregar`, {
        icon: '🍽️',
        title: 'Pedido listo',
        action: {
          label: 'Ver mesa',
          onClick: () => navigate(`/caja/mesero/${n.tableId}`),
        },
      });
    }
  }, [orders, ordersLoading, tables, session?.server, toast, navigate]);

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
