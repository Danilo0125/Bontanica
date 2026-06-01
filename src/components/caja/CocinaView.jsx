// CocinaView.jsx — cola de tandas pagadas pendientes de preparar.
//
// Vista limpia: 1 card grande por tanda, 1 acción primaria abajo.
// La cocina marca items individualmente a 'ready' (toda la tanda); al hacerlo,
// el mesero dueño recibe toast + sonido en su pantalla.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOpenOrders } from '../../lib/useOrders.js';
import { useTables } from '../../lib/useTables.js';
import { supabase } from '../../lib/supabase.js';
import { formatTime, minutesSince } from '../../lib/format.js';
import { isAudioOn, setAudioOn, ensureAudioCtx, playBeep } from '../../lib/audio.js';
import { useToast } from './Toasts.jsx';

const NAME_MAP = { ochito: 'Ochito', nath: 'Nath' };

function useTick(ms = 30000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
}

function urgencyLevel(mins) {
  if (mins >= 10) return 'crit';
  if (mins >= 5) return 'warn';
  return 'ok';
}

function buildPending(orders, tablesById) {
  const out = [];
  for (const o of orders) {
    const itemsByBatch = new Map();
    for (const it of o.items ?? []) {
      if (!itemsByBatch.has(it.batch_id)) itemsByBatch.set(it.batch_id, []);
      itemsByBatch.get(it.batch_id).push(it);
    }
    for (const b of o.batches ?? []) {
      if (b.status !== 'paid') continue;
      const items = (itemsByBatch.get(b.id) ?? []).filter((it) => it.status === 'pending');
      if (items.length === 0) continue; // ya todos ready/cancelled
      out.push({
        ...b, items,
        order_id: o.id,
        table_id: o.table_id,
        table: tablesById.get(o.table_id),
      });
    }
  }
  out.sort((a, b) => new Date(a.paid_at) - new Date(b.paid_at));
  return out;
}

export function CocinaView() {
  const { orders, loading, error } = useOpenOrders('cocina-orders');
  const { tables } = useTables();
  const toast = useToast();
  const [busy, setBusy] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [audioOn, setAudioState] = useState(() => isAudioOn());
  const seenBatchesRef = useRef(null);
  useTick(30000);

  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const pending = useMemo(() => buildPending(orders, tablesById), [orders, tablesById]);

  // Beep al llegar tanda nueva
  useEffect(() => {
    if (loading) return;
    const ids = new Set(pending.map((b) => b.id));
    if (seenBatchesRef.current === null) {
      seenBatchesRef.current = ids;
      return;
    }
    const prev = seenBatchesRef.current;
    const newOnes = [...ids].filter((id) => !prev.has(id));
    if (newOnes.length > 0) playBeep('new');
    seenBatchesRef.current = ids;
  }, [pending, loading]);

  const toggleAudio = () => {
    const next = !audioOn;
    setAudioState(next);
    setAudioOn(next);
    if (next) { ensureAudioCtx(); playBeep('new'); }
  };

  const confirmBatch = confirmId ? pending.find((b) => b.id === confirmId) : null;

  const markReady = async () => {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const { error } = await supabase.from('order_items')
        .update({ status: 'ready', ready_at: new Date().toISOString() })
        .eq('batch_id', id);
      if (error) throw error;
    } catch (e) {
      toast.error(`Error: ${e.message ?? e}`);
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  };

  if (error) {
    return <div className="caja-empty"><p>Error cargando la cola.</p><pre className="caja-error">{error.message}</pre></div>;
  }
  if (loading) return <div className="caja-empty">Cargando cola…</div>;

  return (
    <div className="cocina-view">
      <h2 className="caja-h2">
        Cola de cocina <span className="cocina-count">{pending.length}</span>
        <button className="audio-toggle" onClick={toggleAudio}
                aria-label={audioOn ? 'Silenciar' : 'Activar avisos sonoros'}
                title={audioOn ? 'Sonido activo' : 'Silenciado'}>
          {audioOn ? '🔔' : '🔕'}
        </button>
      </h2>

      {pending.length === 0 && (
        <div className="cocina-empty">
          <span aria-hidden="true">🌿</span>
          <p>Sin tandas pendientes. Todo al día.</p>
        </div>
      )}

      <div className="cocina-grid">
        {pending.map((b) => {
          const mins = minutesSince(b.paid_at);
          const level = urgencyLevel(mins);
          const itemCount = b.items.reduce((s, it) => s + it.qty, 0);
          return (
            <article key={b.id} className={`cocina-card cocina-card--${level}`}>
              <header className="cocina-card-head">
                <div>
                  <strong className="cocina-card-mesa">{b.table?.name ?? `Mesa ${b.table_id}`}</strong>
                  <span className="cocina-card-meta">
                    {NAME_MAP[b.server_id] ?? b.server_id} · {formatTime(b.paid_at)} · {itemCount} ítems
                  </span>
                </div>
                <span className={`cocina-timer cocina-timer--${level}`}>
                  <span className="cocina-timer-dot" />
                  {mins === 0 ? 'recién' : `${mins} min`}
                </span>
              </header>
              <ul className="cocina-card-items">
                {b.items.map((it) => (
                  <li key={it.id} className="coc-item">
                    <span className="qty">{it.qty}×</span>
                    <span className="coc-item-name">{it.product_name_snapshot}</span>
                  </li>
                ))}
              </ul>
              <button className="btn-listo" disabled={!!busy[b.id]} onClick={() => setConfirmId(b.id)}>
                {busy[b.id] ? 'Marcando…' : '✓ LISTO'}
              </button>
            </article>
          );
        })}
      </div>

      {confirmBatch && (
        <div className="sheet-scrim" onClick={() => setConfirmId(null)}>
          <div className="pay-sheet confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <h3 className="sheet-title">¿Marcar como listo?</h3>
            <p className="sheet-sub">
              <strong>{confirmBatch.table?.name}</strong> ·{' '}
              {confirmBatch.items.reduce((s, it) => s + it.qty, 0)} ítems · sirve {NAME_MAP[confirmBatch.server_id] ?? confirmBatch.server_id}
            </p>
            <ul className="confirm-items">
              {confirmBatch.items.map((it) => (
                <li key={it.id}><span className="qty">{it.qty}×</span> {it.product_name_snapshot}</li>
              ))}
            </ul>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setConfirmId(null)}>Cancelar</button>
              <button className="btn-gold" onClick={markReady}>Sí, está listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
