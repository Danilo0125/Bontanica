// Activity.jsx — feed cronológico del audit log para el admin.
import { useEffect, useMemo, useState } from 'react';
import { fetchAuditLog } from '../../../lib/auditApi.js';
import { formatTime } from '../../../lib/format.js';
import {
  Banknote, UtensilsCrossed, Bell, CheckCircle2, Ban, Flag,
  UserPlus, UserCheck, UserMinus, Repeat, Key, Info,
} from '../../../lib/icons.jsx';

const ICO = { size: 18, strokeWidth: 1.75 };
const ACTION_META = {
  batch_paid:           { icon: <Banknote        {...ICO} />, label: 'Cobró tanda',        color: '#1f7a3e' },
  batch_ready:          { icon: <UtensilsCrossed {...ICO} />, label: 'Marcó listo',         color: '#8a6a22' },
  batch_renotified:     { icon: <Bell            {...ICO} />, label: 'Re-notificó mesero',  color: '#3b6ea5' },
  batch_delivered:      { icon: <CheckCircle2    {...ICO} />, label: 'Entregó tanda',       color: '#1f7a3e' },
  batch_cancelled:      { icon: <Ban             {...ICO} />, label: 'Canceló tanda',       color: '#b23636' },
  order_closed:         { icon: <Flag            {...ICO} />, label: 'Cerró mesa',          color: '#8b8b82' },
  order_cancelled:      { icon: <Ban             {...ICO} />, label: 'Canceló mesa entera', color: '#b23636' },
  staff_created:        { icon: <UserPlus        {...ICO} />, label: 'Creó usuario',        color: '#3b6ea5' },
  staff_activated:      { icon: <UserCheck       {...ICO} />, label: 'Activó usuario',      color: '#1f7a3e' },
  staff_deactivated:    { icon: <UserMinus       {...ICO} />, label: 'Desactivó usuario',   color: '#b23636' },
  staff_role_changed:   { icon: <Repeat          {...ICO} />, label: 'Cambió rol',          color: '#c2410c' },
  staff_password_reset: { icon: <Key             {...ICO} />, label: 'Reseteó contraseña',  color: '#c2410c' },
};
const DEFAULT_META = { icon: <Info {...ICO} />, label: '', color: '#8b8b82' };

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString('es-BO');
}

function describePayload(entry) {
  const p = entry.payload ?? {};
  switch (entry.action) {
    case 'batch_paid':
      return `${p.item_count ?? '?'} ítems · ${p.total ?? '?'} Bs · ${p.payment_method ?? '?'}`;
    case 'batch_ready':
    case 'batch_renotified':
    case 'batch_delivered':
    case 'batch_cancelled':
      return entry.target_id ? `batch ${entry.target_id.slice(0, 8)}…` : '';
    case 'order_closed':
    case 'order_cancelled':
      return entry.target_id ? `orden ${entry.target_id.slice(0, 8)}…` : '';
    case 'staff_created':
      return `@${p.username ?? '?'} (${p.role ?? '?'})`;
    case 'staff_role_changed':
      return `nuevo rol: ${p.new_role ?? '?'}`;
    case 'staff_password_reset':
      return entry.target_id ? `usuario @${entry.target_id}` : '';
    default:
      return '';
  }
}

export function Activity() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const rows = await fetchAuditLog({ limit: 200, action: actionFilter || null, actor: actorFilter || null });
      setEntries(rows);
    } catch (e) { setError(e.message ?? String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [actionFilter, actorFilter]);

  const actors = useMemo(() => Array.from(new Set(entries.map((e) => e.actor_username).filter(Boolean))).sort(), [entries]);

  // Agrupar por día
  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const day = new Date(e.created_at).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'short' });
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 className="s-h2" style={{ margin: 0 }}>Actividad reciente</h2>
          <p className="s-sub" style={{ margin: '2px 0 0' }}>
            Todo cambio de estado del staff queda registrado acá (cobros, cocina, admin de usuarios).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--s-line)', background: '#fff', fontSize: 13 }}>
            <option value="">Todos los usuarios</option>
            {actors.map((u) => <option key={u} value={u}>@{u}</option>)}
          </select>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--s-line)', background: '#fff', fontSize: 13 }}>
            <option value="">Toda acción</option>
            {Object.entries(ACTION_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button onClick={load} disabled={loading} className="btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }}>
            {loading ? '…' : 'Refrescar'}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: 'var(--s-crit-bg)', color: 'var(--s-crit)', padding: 12, borderRadius: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="s-empty">Cargando…</div>
      ) : entries.length === 0 ? (
        <div className="s-empty">
          <p>Sin actividad registrada todavía.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {grouped.map(([day, rows]) => (
            <section key={day}>
              <h3 style={{
                fontSize: 12, color: 'var(--s-muted)', textTransform: 'uppercase',
                letterSpacing: '.06em', margin: '0 0 8px 4px', fontWeight: 600,
              }}>{day}</h3>
              <div style={{
                background: '#fff', border: '1px solid var(--s-line)', borderRadius: 12, overflow: 'hidden',
              }}>
                {rows.map((e, i) => {
                  const meta = ACTION_META[e.action] ?? { ...DEFAULT_META, label: e.action };
                  const desc = describePayload(e);
                  return (
                    <div key={e.id} style={{
                      display: 'flex', gap: 12, padding: '12px 14px',
                      borderBottom: i < rows.length - 1 ? '1px solid var(--s-line-2)' : 'none',
                      alignItems: 'flex-start',
                    }}>
                      <span style={{
                        fontSize: 18, lineHeight: 1, width: 32, height: 32,
                        background: `${meta.color}15`, borderRadius: 999,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }} aria-hidden="true">{meta.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: 'var(--s-text)' }}>
                          <strong style={{ color: meta.color }}>{e.actor_username ? `@${e.actor_username}` : 'anónimo'}</strong>
                          {' '}
                          <span style={{ color: 'var(--s-muted)' }}>·</span>
                          {' '}
                          <span>{meta.label}</span>
                          {e.actor_role && (
                            <span style={{
                              fontSize: 10, color: 'var(--s-muted)', marginLeft: 6,
                              padding: '1px 6px', borderRadius: 999, background: '#fafaf9', border: '1px solid var(--s-line)',
                              textTransform: 'uppercase', letterSpacing: '.04em',
                            }}>{e.actor_role}</span>
                          )}
                        </div>
                        {desc && <div style={{ fontSize: 12.5, color: 'var(--s-muted)', marginTop: 2 }}>{desc}</div>}
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--s-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {formatTime(e.created_at)} · {timeAgo(e.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
