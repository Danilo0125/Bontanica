// CocinaView.jsx — cola de tandas pendientes con realtime + timer color-coded.
import { useEffect, useMemo, useState } from 'react';
import { useOpenOrders } from '../../lib/useOrders.js';
import { useTables } from '../../lib/useTables.js';
import { markBatchReady } from '../../lib/orderApi.js';
import { formatTime, minutesSince, money } from '../../lib/format.js';

const NAME_MAP = { ochito: 'Ochito', nath: 'Nath' };

// Heartbeat para refrescar los timers cada 30s — sin re-fetch a DB.
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

function buildBatches(orders, tablesById) {
  const out = [];
  for (const o of orders) {
    const batches = new Map();
    for (const it of o.items ?? []) {
      if (!batches.has(it.batch_id)) {
        batches.set(it.batch_id, {
          id: it.batch_id, items: [], sent_at: it.sent_at,
          status: it.status, server_id: it.server_id,
          order_id: o.id, table_id: o.table_id,
        });
      }
      const b = batches.get(it.batch_id);
      b.items.push(it);
      if (it.status === 'pending') b.status = 'pending';
      else if (it.status === 'ready' && b.status !== 'pending') b.status = 'ready';
    }
    for (const b of batches.values()) {
      out.push({ ...b, table: tablesById.get(b.table_id) });
    }
  }
  out.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
  return out;
}

export function CocinaView() {
  const { orders, loading, error } = useOpenOrders('cocina-orders');
  const { tables } = useTables();
  const [busy, setBusy] = useState({}); // {batchId: true}
  useTick(30000); // refresca timers

  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const allBatches = useMemo(() => buildBatches(orders, tablesById), [orders, tablesById]);
  const pending = allBatches.filter((b) => b.status === 'pending');
  const ready = allBatches.filter((b) => b.status === 'ready').slice(-6); // recientes

  const markReady = async (batchId) => {
    setBusy((b) => ({ ...b, [batchId]: true }));
    try { await markBatchReady(batchId); }
    finally { setBusy((b) => { const n = { ...b }; delete n[batchId]; return n; }); }
  };

  if (error) {
    return <div className="caja-empty"><p>Error cargando la cola.</p><pre className="caja-error">{error.message}</pre></div>;
  }

  if (loading) {
    return <div className="caja-empty">Cargando cola…</div>;
  }

  return (
    <div className="cocina-view">
      <h2 className="caja-h2">Cola de cocina <span className="cocina-count">{pending.length}</span></h2>

      {pending.length === 0 && (
        <div className="cocina-empty">
          <span aria-hidden="true">🌿</span>
          <p>Sin tandas pendientes. Todo al día.</p>
        </div>
      )}

      <div className="cocina-grid">
        {pending.map((b) => {
          const mins = minutesSince(b.sent_at);
          const level = urgencyLevel(mins);
          return (
            <article key={b.id} className={`cocina-card cocina-card--${level}`}>
              <header className="cocina-card-head">
                <strong>{b.table?.name ?? `Mesa ${b.table_id}`}</strong>
                <span className={`cocina-timer cocina-timer--${level}`}>
                  <span className="cocina-timer-dot" />
                  {mins === 0 ? 'recién' : `${mins} min`}
                </span>
              </header>
              <p className="cocina-card-server">
                <span className="cocina-card-by">por</span> {NAME_MAP[b.server_id] ?? b.server_id}
                <span className="cocina-card-sep">·</span>
                <span className="cocina-card-time">{formatTime(b.sent_at)}</span>
              </p>
              <ul className="cocina-card-items">
                {b.items.map((it) => (
                  <li key={it.id}>
                    <span className="qty">{it.qty}×</span>
                    <span>{it.product_name_snapshot}</span>
                  </li>
                ))}
              </ul>
              <button
                className="btn-gold btn-gold--block"
                disabled={!!busy[b.id]}
                onClick={() => markReady(b.id)}>
                {busy[b.id] ? 'Marcando…' : '✓ Listo'}
              </button>
            </article>
          );
        })}
      </div>

      {ready.length > 0 && (
        <details className="cocina-recent">
          <summary>Recientes ({ready.length})</summary>
          <ul>
            {ready.map((b) => (
              <li key={b.id}>
                <strong>{b.table?.name}</strong> · {b.items.length} ítems · {formatTime(b.sent_at)} ·
                <span className="cocina-recent-tot"> {money(b.items.reduce((s, it) => s + Number(it.unit_price_snapshot) * it.qty, 0))} Bs</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
