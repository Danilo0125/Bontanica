// AdminDashboard.jsx — vista del dueño con métricas en vivo.
// Vive en /admin (protegida por la misma sesión de caja).
import { useAdminStats } from '../../lib/useAdminStats.js';
import { money, formatTime } from '../../lib/format.js';

const METHOD_LABEL = { efectivo: 'Efectivo', qr: 'QR / Transferencia' };

function Card({ label, value, unit, tone = 'neutral', sub }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}{unit && <small>{unit}</small>}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function AdminDashboard() {
  const { stats, loading, error } = useAdminStats();

  if (error) {
    return <div className="caja-empty"><p>Error cargando métricas.</p><pre className="caja-error">{error.message}</pre></div>;
  }
  if (loading || !stats) {
    return <div className="caja-empty">Cargando dashboard…</div>;
  }

  const occupancyPct = stats.totalTables > 0
    ? Math.round((stats.tablesOccupied / stats.totalTables) * 100)
    : 0;

  return (
    <div className="admin-view">
      <h2 className="caja-h2">
        Resumen del día
        <span className="caja-h2-meta">actualiza en vivo · {formatTime(stats.updatedAt)}</span>
      </h2>

      <div className="stats-grid">
        <Card
          label="Facturación hoy"
          tone="gold"
          value={money(stats.revenueToday)}
          unit=" Bs"
          sub={`${stats.ordersPaidCount} cobro${stats.ordersPaidCount === 1 ? '' : 's'} · ticket prom ${money(Math.round(stats.avgTicket))} Bs`}
        />
        <Card
          label="Mesas activas"
          tone={stats.tablesOccupied > 0 ? 'ok' : 'neutral'}
          value={stats.tablesOccupied}
          unit={` / ${stats.totalTables}`}
          sub={`${occupancyPct}% ocupación · ${money(stats.openValue)} Bs sin cobrar`}
        />
        <Card
          label="Cocina · tiempo medio"
          tone={stats.avgKitchenMin === null ? 'neutral'
            : stats.avgKitchenMin >= 10 ? 'crit'
            : stats.avgKitchenMin >= 5 ? 'warn' : 'ok'}
          value={stats.avgKitchenMin === null ? '—' : stats.avgKitchenMin.toFixed(1)}
          unit=" min"
          sub="desde envío a listo"
        />
      </div>

      <section className="admin-section">
        <h3 className="caja-h3">Cobros por método</h3>
        <div className="method-bars">
          {Object.keys(stats.byMethod).length === 0 && (
            <p className="muted-note">Sin cobros todavía hoy.</p>
          )}
          {Object.entries(stats.byMethod).map(([m, total]) => {
            const pct = stats.revenueToday > 0 ? (total / stats.revenueToday) * 100 : 0;
            return (
              <div key={m} className="method-bar">
                <div className="method-bar-head">
                  <span>{METHOD_LABEL[m] ?? m}</span>
                  <span className="method-bar-amt">{money(total)} Bs · {pct.toFixed(0)}%</span>
                </div>
                <div className="method-bar-track">
                  <div className="method-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="admin-section">
        <h3 className="caja-h3">Top productos del día</h3>
        {stats.topProducts.length === 0 ? (
          <p className="muted-note">Aún no hay productos vendidos.</p>
        ) : (
          <ol className="top-products">
            {stats.topProducts.map((p, i) => (
              <li key={p.name}>
                <span className="rank">#{i + 1}</span>
                <span className="top-name">{p.name}</span>
                <span className="top-qty">{p.qty}× </span>
                <span className="top-rev">{money(p.revenue)} Bs</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {stats.alerts.length > 0 && (
        <section className="admin-section">
          <h3 className="caja-h3 alert">⚠ Alertas</h3>
          <ul className="admin-alerts">
            {stats.alerts.map((a) => (
              <li key={a.table_id}>
                Mesa {a.table_id} abierta hace más de 3 horas · {formatTime(a.opened_at)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
