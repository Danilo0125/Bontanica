// NotificationsTray.jsx — campana + bandeja.
// Responsive: dropdown anclado en desktop / bottom-sheet en mobile.
// Estilos en src/styles/staff.css (.notif-*).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../lib/useNotifications.js';
import { markAllNotificationsRead, markNotificationRead } from '../../lib/notificationsApi.js';
import { Bell, UtensilsCrossed, Info, AlertTriangle, Leaf } from '../../lib/icons.jsx';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString();
}

function kindIcon(kind) {
  if (kind === 'ready') return <UtensilsCrossed size={20} strokeWidth={1.7} />;
  if (kind === 'warn')  return <AlertTriangle  size={20} strokeWidth={1.7} />;
  return <Info size={20} strokeWidth={1.7} />;
}

export function NotificationsTray({ recipient }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const { items, unreadCount } = useNotifications(recipient);

  // Cerrar al click afuera (desktop). En mobile el scrim ya cubre todo.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lockear scroll del body cuando la sheet está abierta en mobile
  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const onItemClick = useCallback(async (n) => {
    setOpen(false);
    if (!n.is_read) {
      try { await markNotificationRead(n.id); } catch {}
    }
    if (n.table_id != null) {
      navigate(`/caja/mesero/${n.table_id}`);
    }
  }, [navigate]);

  const onMarkAllRead = useCallback(async () => {
    if (!recipient) return;
    try { await markAllNotificationsRead(recipient); } catch {}
  }, [recipient]);

  if (!recipient) return null;

  return (
    <div ref={wrapRef} className="notif-wrap">
      <button
        type="button"
        className={`notif-bell${unreadCount > 0 ? ' has-unread' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : 'Notificaciones'}
        aria-expanded={open}
      >
        <span className="notif-bell-ico" aria-hidden="true">
          <Bell size={20} strokeWidth={1.75} />
        </span>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <>
          {/* Scrim solo aparece en mobile (CSS) */}
          <div className="notif-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={panelRef} className="notif-panel" role="dialog" aria-label="Notificaciones">
            <header className="notif-head">
              <strong className="notif-head-title">Notificaciones</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {unreadCount > 0 && (
                  <button className="notif-mark-all" onClick={onMarkAllRead}>
                    Marcar todas leídas
                  </button>
                )}
                <button className="notif-close" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
              </div>
            </header>

            <div className="notif-list">
              {items.length === 0 ? (
                <div className="notif-empty">
                  <span className="leaf" aria-hidden="true">
                    <Leaf size={32} strokeWidth={1.5} />
                  </span>
                  Sin notificaciones todavía.
                </div>
              ) : items.map((n) => {
                const clickable = n.table_id != null;
                const kindClass = `kind-${n.kind ?? 'info'}`;
                const unreadClass = n.is_read ? '' : ' is-unread';
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`notif-item ${kindClass}${unreadClass}`}
                    onClick={() => onItemClick(n)}
                  >
                    <span className="notif-item-ico" aria-hidden="true">{kindIcon(n.kind)}</span>
                    <div className="notif-item-body">
                      {n.title && (
                        <div className="notif-item-title">
                          {n.title}
                          {!n.is_read && <span className="notif-item-dot" aria-label="No leída" />}
                        </div>
                      )}
                      <div className="notif-item-msg">{n.message}</div>
                      <div className="notif-item-meta">
                        {timeAgo(n.created_at)}{clickable && ' · tocá para ver la mesa'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
