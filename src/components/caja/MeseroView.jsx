// MeseroView.jsx — grilla de mesas. La mesa está OCUPADA si tiene al menos
// 1 batch en estado 'paid' (no delivered ni cancelled).
import { Link } from 'react-router-dom';
import { useTables } from '../../lib/useTables.js';
import { useOpenOrders } from '../../lib/useOrders.js';
import { money, minutesSince } from '../../lib/format.js';

// Total en pie de pago para esta orden (suma de batches no cancelados)
const totalOf = (order) =>
  (order?.batches ?? []).filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + Number(b.total), 0);

// Items pendientes/listos (no delivered, no cancelled)
const activeItems = (order) =>
  (order?.items ?? []).filter((it) => it.status !== 'cancelled');

const activeItemsCount = (order) =>
  activeItems(order).reduce((s, it) => s + it.qty, 0);

// Una orden con batches paid sigue ocupando la mesa.
const isOccupied = (order) => {
  if (!order) return false;
  const batches = order.batches ?? [];
  return batches.some((b) => b.status === 'paid');
};

const hasReadyBatch = (order) => {
  if (!order) return false;
  // batch.status='paid' pero todos sus items ready → listo para entregar
  const itemsByBatch = new Map();
  for (const it of order.items ?? []) {
    if (!itemsByBatch.has(it.batch_id)) itemsByBatch.set(it.batch_id, []);
    itemsByBatch.get(it.batch_id).push(it);
  }
  return (order.batches ?? []).some((b) => {
    if (b.status !== 'paid') return false;
    const its = itemsByBatch.get(b.id) ?? [];
    return its.length > 0 && its.every((it) => it.status === 'ready' || it.status === 'cancelled');
  });
};

function summarizeItems(order, max = 2) {
  const grouped = new Map();
  for (const it of activeItems(order)) {
    grouped.set(it.product_name_snapshot, (grouped.get(it.product_name_snapshot) ?? 0) + it.qty);
  }
  const arr = Array.from(grouped.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, qty]) => ({ name, qty }));
  return { top: arr.slice(0, max), rest: Math.max(0, arr.length - max) };
}

export function MeseroView() {
  const { tables, loading: tLoading } = useTables();
  const { orders, loading: oLoading, error } = useOpenOrders('mesero-orders');

  const ordersByTable = new Map(orders.map((o) => [o.table_id, o]));
  const loading = tLoading || oLoading;

  if (error) {
    return (
      <div className="caja-empty">
        <p>No pudimos cargar las mesas. Revisá la conexión.</p>
        <pre className="caja-error">{error.message}</pre>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mesas-grid">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="mesa-card mesa-skel shimmer" aria-hidden="true" />
        ))}
      </div>
    );
  }

  const occupiedCount = orders.filter((o) => isOccupied(o)).length;
  const readyCount = orders.filter(hasReadyBatch).length;

  return (
    <div className="mesero-view">
      <h2 className="caja-h2">
        Mesas
        <span className="caja-h2-meta">
          {readyCount > 0 && <><span className="dot-live ready-dot" />{readyCount} listas&nbsp;&nbsp;</>}
          {occupiedCount > 0 && <><span className="dot-live" />{occupiedCount} ocupadas</>}
        </span>
      </h2>
      <div className="mesas-grid">
        {tables.map((t) => {
          const order = ordersByTable.get(t.id);
          const occupied = isOccupied(order);
          const ready = hasReadyBatch(order);
          const tot = totalOf(order);
          const summary = order ? summarizeItems(order) : null;
          const mins = order ? minutesSince(order.opened_at) : 0;
          return (
            <Link key={t.id} to={`/caja/mesero/${t.id}`} viewTransition
                  className={`mesa-card ${occupied ? 'is-occupied' : ''} ${ready ? 'is-ready' : ''}`}>
              <div className="mesa-head">
                <span className="mesa-status">
                  {ready ? '✓ LISTO' : occupied ? 'Ocupada' : 'Libre'}
                </span>
                {occupied && <span className="mesa-mins">{mins}m</span>}
              </div>
              <span className="mesa-name">{t.name}</span>
              {occupied ? (
                <>
                  <ul className="mesa-preview">
                    {summary.top.map((it, i) => (
                      <li key={i}><span className="mesa-preview-qty">{it.qty}×</span> {it.name}</li>
                    ))}
                    {summary.rest > 0 && <li className="mesa-preview-more">+{summary.rest} más</li>}
                  </ul>
                  <div className="mesa-total-row">
                    <span className="mesa-total">{money(tot)} <small>Bs</small></span>
                    <span className="mesa-count">{activeItemsCount(order)} ítems</span>
                  </div>
                </>
              ) : (
                <span className="mesa-empty">Abrir cuenta →</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
