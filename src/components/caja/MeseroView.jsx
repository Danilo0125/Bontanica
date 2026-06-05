// MeseroView.jsx — grilla de mesas (tema blanco). La mesa está OCUPADA si tiene
// al menos 1 batch en estado 'paid' (no delivered ni cancelled).
import { Link } from 'react-router-dom';
import { useTables } from '../../lib/useTables.js';
import { useOpenOrders } from '../../lib/useOrders.js';
import { money, minutesSince } from '../../lib/format.js';
import { Check } from '../../lib/icons.jsx';

const totalOf = (order) =>
  (order?.batches ?? []).filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + Number(b.total), 0);

// Items de tandas vivas (paid) — excluye delivered y cancelled. Esto evita
// mostrar productos viejos en la preview/contador después de la entrega.
const activeBatchIds = (order) => new Set(
  (order?.batches ?? []).filter((b) => b.status === 'paid').map((b) => b.id)
);

const activeItems = (order) => {
  const live = activeBatchIds(order);
  return (order?.items ?? []).filter((it) => it.status !== 'cancelled' && live.has(it.batch_id));
};

const activeItemsCount = (order) =>
  activeItems(order).reduce((s, it) => s + it.qty, 0);

// Urgencia por minutos abiertos: <15 ok, 15-29 warn, ≥30 crit.
function urgencyLevel(mins) {
  if (mins >= 30) return 'crit';
  if (mins >= 15) return 'warn';
  return 'ok';
}

const isOccupied = (order) => {
  if (!order) return false;
  return (order.batches ?? []).some((b) => b.status === 'paid');
};

const hasReadyBatch = (order) => {
  if (!order) return false;
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
      <div className="s-empty">
        <p>No pudimos cargar las mesas. Revisá la conexión.</p>
        <pre style={{ color: 'var(--s-crit)', fontSize: 12 }}>{error.message}</pre>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="s-h1">Mesas</h1>
        <div className="mesas-grid">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="mesa-card" aria-hidden="true" style={{ opacity: .5 }} />
          ))}
        </div>
      </div>
    );
  }

  const occupiedCount = orders.filter((o) => isOccupied(o)).length;
  const readyCount = orders.filter(hasReadyBatch).length;

  return (
    <div>
      <h1 className="s-h1">
        Mesas
        <span className="s-meta">
          {readyCount > 0 && <><span className="dot-live ok" />{readyCount} listas</>}
          {occupiedCount > 0 && <><span className="dot-live" />{occupiedCount} ocupadas</>}
        </span>
      </h1>

      <div className="mesas-grid">
        {tables.map((t) => {
          const order = ordersByTable.get(t.id);
          const occupied = isOccupied(order);
          const ready = hasReadyBatch(order);
          const tot = totalOf(order);
          const summary = order ? summarizeItems(order) : null;
          const mins = order ? minutesSince(order.opened_at) : 0;
          // La urgencia solo aplica cuando la mesa está ocupada (no en libres).
          // Si está "lista para entregar" mantenemos el verde porque ya está
          // en estado positivo, no nos importa cuánto lleva abierta.
          const urgency = occupied && !ready ? urgencyLevel(mins) : null;
          const urgencyTitle = urgency === 'crit'
            ? 'Más de 30 min sin moverse — revisar'
            : urgency === 'warn' ? 'Más de 15 min — atención' : undefined;
          return (
            <Link
              key={t.id}
              to={`/caja/mesero/${t.id}`}
              viewTransition
              className={[
                'mesa-card',
                occupied && 'is-occupied',
                ready && 'is-ready',
                urgency && `urgency-${urgency}`,
              ].filter(Boolean).join(' ')}
            >
              <div className="mesa-head">
                <span className="mesa-status" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {ready && <Check size={13} strokeWidth={2.4} aria-hidden="true" />}
                  {ready ? 'Listo' : occupied ? 'Ocupada' : 'Libre'}
                </span>
                {occupied && (
                  <span className="mesa-mins" title={urgencyTitle}>{mins}m</span>
                )}
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
                    <span className="mesa-total">{money(tot)}<small> Bs</small></span>
                    <span className="mesa-count">
                      {(() => { const c = activeItemsCount(order); return `${c} ${c === 1 ? 'ítem' : 'ítems'}`; })()}
                    </span>
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
