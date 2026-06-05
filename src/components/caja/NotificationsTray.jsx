// NotificationsTray.jsx — campana 🔔 + bandeja persistente.
// El item entero es clickeable y navega a la mesa correspondiente.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../lib/useNotifications.js';
import { markAllNotificationsRead, markNotificationRead } from '../../lib/notificationsApi.js';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString();
}

const KIND_META = {
  ready: { icon: '🍽️', color: '#3f6212', bg: '#f0f9eb' },
  info:  { icon: 'ℹ️',  color: '#1e40af', bg: '#eff6ff' },
  warn:  { icon: '⚠️', color: '#9a3412', bg: '#fff7ed' },
};

export function NotificationsTray({ recipient }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const { items, unreadCount } = useNotifications(recipient);

  // Cierra al click afuera (mobile-friendly: respeta toques).
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
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
    <div ref={wrapRef} className="notif-wrap" style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : 'Notificaciones'}
        className="notif-bell"
        style={{
          position: 'relative',
          background: unreadCount > 0 ? '#fef3c7' : 'transparent',
          border: unreadCount > 0 ? '1.5px solid #d97706' : '1.5px solid #e5e7eb',
          borderRadius: 999,
          width: 40, height: 40,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 20,
          transition: 'transform 120ms ease',
        }}
      >
        <span style={{ animation: unreadCount > 0 ? 'notif-shake 1.6s ease-in-out infinite' : 'none' }}>🔔</span>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#dc2626', color: '#fff',
            borderRadius: 999, minWidth: 20, height: 20,
            fontSize: 11, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 5px', border: '2px solid #fff',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="notif-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 'min(360px, calc(100vw - 24px))',
            maxHeight: 'min(70vh, 520px)',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <header style={{
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid #f3f4f6',
            background: '#fafaf9',
          }}>
            <strong style={{ fontSize: 15 }}>Notificaciones</strong>
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#3f6212', fontSize: 12.5, fontWeight: 600, padding: 4,
              }}>
                Marcar todas como leídas
              </button>
            )}
          </header>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {items.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: '#6b7280', fontSize: 13.5 }}>
                <div style={{ fontSize: 30, marginBottom: 6 }} aria-hidden="true">🌿</div>
                Sin notificaciones todavía.
              </div>
            ) : items.map((n) => {
              const meta = KIND_META[n.kind] ?? KIND_META.info;
              const clickable = n.table_id != null;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onItemClick(n)}
                  disabled={!clickable && n.is_read}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    background: n.is_read ? '#fff' : meta.bg,
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: clickable ? 'pointer' : 'default',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    transition: 'background 120ms ease',
                  }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {n.title && (
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: meta.color }}>
                        {n.title}
                        {!n.is_read && (
                          <span style={{
                            display: 'inline-block', marginLeft: 6,
                            width: 7, height: 7, borderRadius: 999,
                            background: '#dc2626', verticalAlign: 'middle',
                          }} aria-label="No leída" />
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                      {timeAgo(n.created_at)}{clickable && ' · tocá para ver la mesa'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
