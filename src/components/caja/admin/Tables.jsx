// Tables.jsx — vista admin de mesas: estado en vivo + liberar/desactivar.
import { useEffect, useState } from 'react';
import { useTables } from '../../../lib/useTables.js';
import { useOpenOrders } from '../../../lib/useOrders.js';
import { cancelOrder } from '../../../lib/orderApi.js';
import { supabase } from '../../../lib/supabase.js';
import { useToast } from '../Toasts.jsx';
import { money, minutesSince } from '../../../lib/format.js';

export function TablesAdmin() {
  const { tables } = useTables();
  const { orders, refresh } = useOpenOrders('admin-tables');
  const toast = useToast();
  const [busy, setBusy] = useState({});

  // tables hook trae solo activas. Para admin queremos todas:
  const [allTables, setAllTables] = useState([]);
  const loadAll = async () => {
    const { data, error } = await supabase.from('tables_pos').select('*').order('id');
    if (error) toast.error(error.message);
    else setAllTables(data ?? []);
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  const orderByTable = new Map(orders.map((o) => [o.table_id, o]));

  const liberar = async (table) => {
    const o = orderByTable.get(table.id);
    if (!o) return;
    if (!confirm(`¿Liberar ${table.name}? Se cancela la orden abierta y todos sus batches pendientes.`)) return;
    try {
      setBusy((b) => ({ ...b, [table.id]: true }));
      await cancelOrder(o.id);
      toast.info(`${table.name} liberada`);
      refresh();
    } catch (e) { toast.error(e.message); }
    finally { setBusy((b) => { const n = { ...b }; delete n[table.id]; return n; }); }
  };

  const toggleActive = async (table) => {
    try {
      const { error } = await supabase.from('tables_pos').update({ is_active: !table.is_active }).eq('id', table.id);
      if (error) throw error;
      loadAll();
      toast.info(`${table.name} ${!table.is_active ? 'activada' : 'desactivada'}`);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <h1 className="admin-h1">Mesas</h1>
      <p className="admin-sub">Estado en vivo de las {allTables.length} mesas del salón. Liberá mesas zombie (orden abandonada) o desactivá mesas que no estás usando.</p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Mesa</th><th>Estado</th><th className="admin-cell-num">Total en piso</th><th>Tiempo</th><th>Activa</th><th></th></tr></thead>
          <tbody>
            {allTables.map((t) => {
              const o = orderByTable.get(t.id);
              const occupied = !!o && (o.batches ?? []).some((b) => b.status === 'paid');
              const total = (o?.batches ?? []).filter((b) => b.status !== 'cancelled').reduce((s, b) => s + Number(b.total), 0);
              const mins = o ? minutesSince(o.opened_at) : 0;
              return (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td>
                    {!t.is_active && <span className="admin-pill admin-pill-muted">inactiva</span>}
                    {t.is_active && occupied && <span className="admin-pill admin-pill-warn">ocupada</span>}
                    {t.is_active && !occupied && <span className="admin-pill admin-pill-ok">libre</span>}
                  </td>
                  <td className="admin-cell-num">{occupied ? `${money(total)} Bs` : '—'}</td>
                  <td>{occupied ? `${mins} min` : '—'}</td>
                  <td>
                    <label className="admin-toggle">
                      <input type="checkbox" checked={t.is_active} onChange={() => toggleActive(t)} />
                      <span className="admin-toggle-track" />
                    </label>
                  </td>
                  <td>
                    {occupied && (
                      <button className="admin-btn admin-btn-danger admin-btn-icon"
                              disabled={!!busy[t.id]} onClick={() => liberar(t)}>
                        {busy[t.id] ? '…' : 'Liberar'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
