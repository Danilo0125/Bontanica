// AdminDashboard.jsx — pestaña Resumen dentro de /caja/admin. Tema blanco.
import { useAdminStats } from '../../lib/useAdminStats.js';
import { money, formatTime } from '../../lib/format.js';

const METHOD_LABEL = { efectivo: 'Efectivo', qr: 'QR / Transferencia' };

function Stat({ label, value, unit, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}{unit && <small>{unit}</small>}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function AdminDashboard() {
  const { stats, loading, error } = useAdminStats();

  if (error) return <p className="s-empty">Error: {error.message}</p>;
  if (loading || !stats) return <p className="s-empty">Cargando…</p>;

  const occupancyPct = stats.totalTables > 0
    ? Math.round((stats.tablesOccupied / stats.totalTables) * 100) : 0;

  return (
    <div>
      <div className="admin-bar">
        <h3>Resumen del día</h3>
        <span className="count">última lectura {formatTime(stats.updatedAt)}</span>
      </div>

      <div className="stat-grid">
        <Stat label="Facturación hoy" value={money(stats.revenueToday)} unit=" Bs"
              sub={`${stats.ordersPaidCount} cobro${stats.ordersPaidCount === 1 ? '' : 's'} · ticket prom ${money(Math.round(stats.avgTicket))} Bs`} />
        <Stat label="Mesas activas" value={stats.tablesOccupied}
              unit={` / ${stats.totalTables}`}
              sub={`${occupancyPct}% ocupación · ${money(stats.openValue)} Bs en piso`} />
        <Stat label="Tiempo medio de entrega"
              value={stats.avgKitchenMin === null ? '—' : stats.avgKitchenMin.toFixed(1)} unit=" min"
              sub="desde cobro hasta entregar" />
      </div>

      <h2 className="s-h2">Cobros por método</h2>
      {Object.keys(stats.byMethod).length === 0
        ? <p className="s-sub">Sin cobros todavía.</p>
        : (
          <div className="panel">
            {Object.entries(stats.byMethod).map(([m, t]) => {
              const pct = stats.revenueToday > 0 ? (t / stats.revenueToday) * 100 : 0;
              return (
                <div key={m} className="method-row">
                  <div className="method-top">
                    <span>{METHOD_LABEL[m] ?? m}</span>
                    <span className="num">{money(t)} Bs · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="method-bar"><i style={{ width: pct + '%' }} /></div>
                </div>
              );
            })}
          </div>
        )}

      <h2 className="s-h2">Top productos del día</h2>
      {stats.topProducts.length === 0
        ? <p className="s-sub">Aún no hay ventas.</p>
        : (
          <div className="panel">
            {stats.topProducts.map((p, i) => (
              <div key={p.name} className="rank-row">
                <span className="rank-n">{i + 1}</span>
                <span className="rank-name">{p.name}</span>
                <span className="rank-qty">{p.qty}×</span>
                <span className="rank-rev">{money(p.revenue)} Bs</span>
              </div>
            ))}
          </div>
        )}

      {stats.alerts.length > 0 && (
        <>
          <h2 className="s-h2" style={{ color: 'var(--s-crit)' }}>⚠ Alertas</h2>
          <div className="alert-list">
            {stats.alerts.map((a) => (
              <div key={a.table_id} className="alert-row">
                Mesa {a.table_id} abierta hace más de 3 horas (desde {formatTime(a.opened_at)})
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
