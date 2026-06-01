// MeseroView.jsx — grilla de mesas con totales y preview en vivo.
import { Link } from 'react-router-dom';
import { useTables } from '../../lib/useTables.js';
import { useOpenOrders } from '../../lib/useOrders.js';
import { money, minutesSince } from '../../lib/format.js';

const totalOf = (order) =>
  (order?.items ?? []).reduce((s, it) => s + Number(it.unit_price_snapshot) * it.qty, 0);

const countOf = (order) =>
  (order?.items ?? []).reduce((s, it) => s + it.qty, 0);

// Resume los items de una orden: agrupa por nombre, ordena por cantidad descendente.
function summarizeItems(order, max = 2) {
  const grouped = new Map();
  for (const it of order?.items ?? []) {
    const key = it.product_name_snapshot;
    grouped.set(key, (grouped.get(key) ?? 0) + it.qty);
  }
  const arr = Array.from(grouped.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, qty]) => ({ name, qty }));
  const top = arr.slice(0, max);
  const rest = arr.length - max;
  return { top, rest: rest > 0 ? rest : 0 };
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

  const occupiedCount = orders.length;

  return (
    <div className="mesero-view">
      <h2 className="caja-h2">
        Mesas
        <span className="caja-h2-meta">
          {occupiedCount > 0 && <><span className="dot-live" /> {occupiedCount} ocupada{occupiedCount !== 1 ? 's' : ''}</>}
        </span>
      </h2>
      <div className="mesas-grid">
        {tables.map((t) => {
          const order = ordersByTable.get(t.id);
          const occupied = !!order;
          const tot = totalOf(order);
          const summary = occupied ? summarizeItems(order) : null;
          const mins = occupied ? minutesSince(order.opened_at) : 0;
          return (
            <Link key={t.id} to={`/caja/mesero/${t.id}`} viewTransition
                  className={`mesa-card ${occupied ? 'is-occupied' : ''}`}>
              <div className="mesa-head">
                <span className="mesa-status">{occupied ? 'Ocupada' : 'Libre'}</span>
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
                    <span className="mesa-count">{countOf(order)} ítems</span>
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
