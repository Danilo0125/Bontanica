// CocinaView.jsx — cola de tandas. Las tandas listas siguen visibles con
// botón "Volver a notificar" hasta que el mesero las entregue.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOpenOrders } from '../../lib/useOrders.js';
import { useTables } from '../../lib/useTables.js';
import { useAuth } from '../../lib/auth.jsx';
import { markBatchReady, bumpBatchNotification } from '../../lib/orderApi.js';
import { formatTime, minutesSince, formatItemName, isSplitItem } from '../../lib/format.js';
import { isAudioOn, setAudioOn, ensureAudioCtx, playBeep } from '../../lib/audio.js';
import { useToast } from './Toasts.jsx';
import { Bell, BellOff, Leaf, Check, Eye } from '../../lib/icons.jsx';

const NAME_MAP = { ochito: 'Ochito', nath: 'Nath' };

function useTick(ms = 30000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
}

function urgencyLevel(mins) {
  if (mins >= 12) return 'crit';
  if (mins >= 6) return 'warn';
  return 'ok';
}

// Construye la cola de cocina. Una tanda paid permanece visible aunque ya esté
// lista — solo desaparece cuando el mesero la marca entregada (status='delivered').
function buildQueue(orders, tablesById) {
  const out = [];
  for (const o of orders) {
    const itemsByBatch = new Map();
    for (const it of o.items ?? []) {
      if (!itemsByBatch.has(it.batch_id)) itemsByBatch.set(it.batch_id, []);
      itemsByBatch.get(it.batch_id).push(it);
    }
    for (const b of o.batches ?? []) {
      if (b.status !== 'paid') continue;
      const visibleItems = (itemsByBatch.get(b.id) ?? []).filter((it) => it.status !== 'cancelled');
      if (visibleItems.length === 0) continue;
      const phase = visibleItems.every((it) => it.status === 'ready') ? 'ready' : 'preparing';
      out.push({
        ...b, items: visibleItems, phase,
        order_id: o.id,
        table_id: o.table_id,
        table: tablesById.get(o.table_id),
      });
    }
  }
  // Preparando primero, luego listas; dentro de cada grupo, las más antiguas arriba.
  out.sort((a, b) => {
    if (a.phase !== b.phase) return a.phase === 'preparing' ? -1 : 1;
    return new Date(a.paid_at) - new Date(b.paid_at);
  });
  return out;
}

export function CocinaView() {
  const { orders, loading, error } = useOpenOrders('cocina-orders');
  const { tables } = useTables();
  const { role } = useAuth();
  const isReadOnly = role === 'admin';
  const toast = useToast();
  const [busy, setBusy] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [audioOn, setAudioState] = useState(() => isAudioOn());
  const seenBatchesRef = useRef(null);
  useTick(30000);

  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const queue = useMemo(() => buildQueue(orders, tablesById), [orders, tablesById]);
  const preparingCount = queue.filter((b) => b.phase === 'preparing').length;

  useEffect(() => {
    if (loading) return;
    // Solo beepeamos por tandas nuevas en preparación.
    const preparingIds = new Set(queue.filter((b) => b.phase === 'preparing').map((b) => b.id));
    if (seenBatchesRef.current === null) {
      seenBatchesRef.current = preparingIds;
      return;
    }
    const prev = seenBatchesRef.current;
    const newOnes = [...preparingIds].filter((id) => !prev.has(id));
    if (newOnes.length > 0) playBeep('new');
    seenBatchesRef.current = preparingIds;
  }, [queue, loading]);

  const toggleAudio = () => {
    const next = !audioOn;
    setAudioState(next);
    setAudioOn(next);
    if (next) { ensureAudioCtx(); playBeep('new'); }
  };

  const confirmBatch = confirmId ? queue.find((b) => b.id === confirmId) : null;

  const doMarkReady = async () => {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await markBatchReady(id);
    } catch (e) {
      toast.error(`Error: ${e.message ?? e}`);
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  };

  const renotify = async (batchId) => {
    setBusy((b) => ({ ...b, [batchId]: true }));
    try {
      await bumpBatchNotification(batchId);
      toast.info('Aviso reenviado al mesero', {
        duration: 2500,
        icon: <Bell size={22} strokeWidth={1.7} />,
      });
    } catch (e) {
      toast.error(`No se pudo reenviar: ${e.message ?? e}`);
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[batchId]; return n; });
    }
  };

  if (error) {
    return (
      <div className="s-empty">
        <p>Error cargando la cola.</p>
        <pre style={{ color: 'var(--s-crit)', fontSize: 12 }}>{error.message}</pre>
      </div>
    );
  }
  if (loading) return <div className="s-empty">Cargando cola…</div>;

  return (
    <div>
      <h1 className="s-h1" style={{ alignItems: 'center' }}>
        Cola de cocina<span className="cocina-count">{preparingCount}</span>
        <button className="audio-toggle" onClick={toggleAudio}
                aria-label={audioOn ? 'Silenciar' : 'Activar avisos sonoros'}
                title={audioOn ? 'Sonido activo' : 'Silenciado'}>
          {audioOn ? <Bell size={18} strokeWidth={1.75} /> : <BellOff size={18} strokeWidth={1.75} />}
        </button>
      </h1>
      <p className="s-sub">Las tandas listas se quedan acá hasta que el mesero las entregue. Si no las recoge, tocá la campana para volver a avisar.</p>
      {isReadOnly && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10,
          padding: '8px 12px', fontSize: 13, color: '#92400e', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Eye size={16} strokeWidth={1.7} aria-hidden="true" />
          Modo solo lectura — admin no puede marcar tandas listas ni reenviar avisos
        </div>
      )}

      {queue.length === 0 ? (
        <div className="cocina-empty">
          <span className="big" aria-hidden="true">
            <Leaf size={36} strokeWidth={1.5} />
          </span>
          <p>Sin tandas en cola. Todo al día.</p>
        </div>
      ) : (
        <div className="cocina-grid">
          {queue.map((b) => {
            const isReady = b.phase === 'ready';
            const mins = minutesSince(isReady ? (b.ready_at ?? b.paid_at) : b.paid_at);
            const level = isReady ? 'ok' : urgencyLevel(mins);
            const itemCount = b.items.reduce((s, it) => s + it.qty, 0);
            return (
              <article key={b.id} className={`cocina-card cocina-card--${level}${isReady ? ' cocina-card--ready' : ''}`}>
                <header className="cocina-card-head">
                  <div>
                    <strong className="cocina-card-mesa">{b.table?.name ?? `Mesa ${b.table_id}`}</strong>
                    <span className="cocina-card-meta">
                      {NAME_MAP[b.server_id] ?? b.server_id} · {formatTime(b.paid_at)} · {itemCount} ítems
                    </span>
                  </div>
                  <span className={`cocina-timer cocina-timer--${level}`}>
                    <span className="cocina-timer-dot" />
                    {isReady ? `lista hace ${mins} min` : (mins === 0 ? 'recién' : `${mins} min`)}
                  </span>
                </header>
                {isReady && (
                  <div className="cocina-ready-banner" style={{
                    background: '#f0f9eb', color: '#3f6212', padding: '8px 12px',
                    borderRadius: 8, fontSize: 13.5, marginBottom: 10, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Check size={16} strokeWidth={2.2} aria-hidden="true" />
                    Lista · esperando al mesero
                  </div>
                )}
                <ul className="cocina-card-items">
                  {b.items.map((it) => {
                    const split = isSplitItem(it);
                    return (
                      <li key={it.id} className={`coc-item${split ? ' coc-item--split' : ''}`}>
                        <span className="qty">{it.qty}×</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <strong>{it.product_name_snapshot}</strong>
                          {split && (
                            <span className="coc-split-badge" aria-label="Mitad-mitad">½ + ½</span>
                          )}
                          {(it.flavor_name_snapshot || it.flavor_name_snapshot_2) && (
                            <span className="coc-flavors">
                              {split
                                ? <>½ <b>{it.flavor_name_snapshot}</b> / ½ <b>{it.flavor_name_snapshot_2}</b></>
                                : <b>{it.flavor_name_snapshot}</b>}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {!isReadOnly && isReady && (
                  <button
                    className="btn-listo"
                    style={{
                      background: '#fff', color: '#3f6212', border: '1.5px solid #3f6212',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                    disabled={!!busy[b.id]}
                    onClick={() => renotify(b.id)}
                  >
                    {busy[b.id] ? 'Enviando…' : (
                      <><Bell size={18} strokeWidth={1.8} aria-hidden="true" /> Volver a notificar al mesero</>
                    )}
                  </button>
                )}
                {!isReadOnly && !isReady && (
                  <button
                    className="btn-listo"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    disabled={!!busy[b.id]}
                    onClick={() => setConfirmId(b.id)}
                  >
                    {busy[b.id] ? 'Marcando…' : (
                      <><Check size={18} strokeWidth={2.2} aria-hidden="true" /> Listo</>
                    )}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {confirmBatch && (
        <div className="s-scrim" onClick={() => setConfirmId(null)}>
          <div className="s-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="s-grip" />
            <h3 className="s-title">¿Marcar como listo?</h3>
            <p className="s-sheet-sub">
              <strong>{confirmBatch.table?.name}</strong> · sirve {NAME_MAP[confirmBatch.server_id] ?? confirmBatch.server_id}
            </p>
            <ul className="confirm-items">
              {confirmBatch.items.map((it) => (
                <li key={it.id}><span className="qty">{it.qty}×</span>{formatItemName(it)}</li>
              ))}
            </ul>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setConfirmId(null)}>Volver</button>
              <button className="btn-primary" style={{ width: 'auto' }} onClick={doMarkReady}>Sí, está listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
