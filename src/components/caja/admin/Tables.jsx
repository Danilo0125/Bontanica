// Tables.jsx — vista admin de mesas: grid de cards + liberar/desactivar.
import { useEffect, useState } from 'react';
import { useOpenOrders } from '../../../lib/useOrders.js';
import { cancelOrder } from '../../../lib/orderApi.js';
import { supabase } from '../../../lib/supabase.js';
import { useToast } from '../Toasts.jsx';
import { money, minutesSince } from '../../../lib/format.js';

export function TablesAdmin() {
  const { orders, refresh } = useOpenOrders('admin-tables');
  const toast = useToast();
  const [busy, setBusy] = useState({});

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
    <div>
      <div className="admin-bar">
        <h3>Mesas <span className="count">· {allTables.length}</span></h3>
      </div>
      <p className="s-sub" style={{ marginBottom: 12 }}>
        Estado en vivo del salón. Liberá mesas zombie o desactivá mesas que no estás usando.
      </p>

      <div className="tbl-grid">
        {allTables.map((t) => {
          const o = orderByTable.get(t.id);
          const occupied = !!o && (o.batches ?? []).some((b) => b.status === 'paid');
          const total = (o?.batches ?? []).filter((b) => b.status !== 'cancelled').reduce((s, b) => s + Number(b.total), 0);
          const mins = o ? minutesSince(o.opened_at) : 0;
          return (
            <div key={t.id} className={`tbl-card ${t.is_active ? '' : 'is-off'}`}>
              <div className="tbl-card-info">
                <b>{t.name}</b>
                <span>
                  {!t.is_active && 'Inactiva'}
                  {t.is_active && occupied && `Ocupada · ${money(total)} Bs · ${mins}m`}
                  {t.is_active && !occupied && 'Libre'}
                </span>
              </div>
              <div className="tbl-card-actions">
                {occupied && (
                  <button className="tbl-liberate" disabled={!!busy[t.id]} onClick={() => liberar(t)}>
                    {busy[t.id] ? '…' : 'Liberar'}
                  </button>
                )}
                <label className="sw" title={t.is_active ? 'Activa' : 'Inactiva'}>
                  <input type="checkbox" checked={t.is_active} onChange={() => toggleActive(t)} />
                  <span className="sw-track" />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
