// AdminDashboard.jsx — pestaña Resumen dentro de /caja/admin.
// Paleta clara (admin.css). Hereda métricas de useAdminStats.
import { useAdminStats } from '../../lib/useAdminStats.js';
import { money, formatTime } from '../../lib/format.js';

const METHOD_LABEL = { efectivo: 'Efectivo', qr: 'QR / Transferencia' };

function Stat({ label, value, unit, sub }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-value">{value}{unit && <small>{unit}</small>}</div>
      {sub && <div className="admin-stat-sub">{sub}</div>}
    </div>
  );
}

export function AdminDashboard() {
  const { stats, loading, error } = useAdminStats();

  if (error) {
    return <p className="admin-empty">Error: {error.message}</p>;
  }
  if (loading || !stats) {
    return <p className="admin-empty">Cargando…</p>;
  }

  const occupancyPct = stats.totalTables > 0
    ? Math.round((stats.tablesOccupied / stats.totalTables) * 100)
    : 0;

  return (
    <>
      <h1 className="admin-h1">Resumen del día</h1>
      <p className="admin-sub">Actualiza en vivo · última lectura {formatTime(stats.updatedAt)}</p>

      <div className="admin-stats">
        <Stat label="Facturación hoy" value={money(stats.revenueToday)} unit=" Bs"
              sub={`${stats.ordersPaidCount} cobro${stats.ordersPaidCount === 1 ? '' : 's'} · ticket prom ${money(Math.round(stats.avgTicket))} Bs`} />
        <Stat label="Mesas activas" value={stats.tablesOccupied}
              unit={` / ${stats.totalTables}`}
              sub={`${occupancyPct}% ocupación · ${money(stats.openValue)} Bs en piso`} />
        <Stat label="Tiempo medio de entrega"
              value={stats.avgKitchenMin === null ? '—' : stats.avgKitchenMin.toFixed(1)} unit=" min"
              sub="desde cobro hasta entregar" />
      </div>

      <h2 className="admin-h2">Cobros por método</h2>
      {Object.keys(stats.byMethod).length === 0
        ? <p className="admin-empty">Sin cobros todavía hoy.</p>
        : (
          <div className="admin-table-wrap" style={{ padding: '14px 18px' }}>
            {Object.entries(stats.byMethod).map(([m, t]) => {
              const pct = stats.revenueToday > 0 ? (t / stats.revenueToday) * 100 : 0;
              return (
                <div key={m} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{METHOD_LABEL[m] ?? m}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(t)} Bs · {pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--a-line-soft)', borderRadius: 999, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--a-accent)', borderRadius: 999, transition: 'width .4s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

      <h2 className="admin-h2">Top productos del día</h2>
      {stats.topProducts.length === 0
        ? <p className="admin-empty">Aún no hay productos vendidos.</p>
        : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>#</th><th>Producto</th><th className="admin-cell-num">Cant.</th><th className="admin-cell-num">Revenue</th></tr></thead>
              <tbody>
                {stats.topProducts.map((p, i) => (
                  <tr key={p.name}>
                    <td>{i + 1}</td>
                    <td>{p.name}</td>
                    <td className="admin-cell-num">{p.qty}</td>
                    <td className="admin-cell-num">{money(p.revenue)} Bs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {stats.alerts.length > 0 && (
        <>
          <h2 className="admin-h2" style={{ color: 'var(--a-crit)' }}>⚠ Alertas</h2>
          <div className="admin-table-wrap" style={{ padding: 14 }}>
            {stats.alerts.map((a) => (
              <p key={a.table_id} style={{ margin: '6px 0', color: 'var(--a-crit)' }}>
                Mesa {a.table_id} abierta hace más de 3 horas (desde {formatTime(a.opened_at)})
              </p>
            ))}
          </div>
        </>
      )}
    </>
  );
}
