// useAdminStats.js — agrega métricas en vivo para /admin.
// Hace queries paralelas a Supabase. Se refresca al recibir eventos
// realtime de orders/order_items.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

async function fetchStats() {
  const today = startOfToday();

  // 1) Órdenes pagadas hoy (para facturación + métodos)
  const paidQ = supabase
    .from('orders')
    .select('id, total, payment_method, paid_at')
    .eq('status', 'paid')
    .gte('paid_at', today);

  // 2) Órdenes abiertas (mesas activas + total acumulado)
  const openQ = supabase
    .from('orders')
    .select('id, table_id, opened_at, items:order_items(qty, unit_price_snapshot, status, sent_at, ready_at, product_id, product_name_snapshot)')
    .eq('status', 'open');

  // 3) Total de mesas activas (para denominador)
  const tablesQ = supabase
    .from('tables_pos')
    .select('id')
    .eq('is_active', true);

  const [paid, open, tablesAll] = await Promise.all([paidQ, openQ, tablesQ]);
  if (paid.error) throw paid.error;
  if (open.error) throw open.error;
  if (tablesAll.error) throw tablesAll.error;

  const paidOrders = paid.data ?? [];
  const openOrders = open.data ?? [];
  const totalTables = (tablesAll.data ?? []).length;

  // Facturación hoy
  const revenueToday = paidOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const byMethod = paidOrders.reduce((acc, o) => {
    const m = o.payment_method ?? 'sin-método';
    acc[m] = (acc[m] ?? 0) + Number(o.total ?? 0);
    return acc;
  }, {});
  const ordersPaidCount = paidOrders.length;
  const avgTicket = ordersPaidCount > 0 ? revenueToday / ordersPaidCount : 0;

  // Mesas activas + total acumulado
  const tablesOccupied = openOrders.length;
  const openValue = openOrders.reduce(
    (s, o) => s + (o.items ?? [])
      .filter((it) => it.status !== 'cancelled')
      .reduce((ss, it) => ss + Number(it.unit_price_snapshot) * it.qty, 0),
    0
  );

  // Tiempo promedio de cocina hoy (items que pasaron a ready)
  // Aprovecho los items de las órdenes abiertas + tendría que sumar las pagas.
  // Para evitar otra query pesada, uso solo abiertas en este turno.
  let avgKitchenMin = null;
  let kitchenCount = 0;
  for (const o of openOrders) {
    for (const it of o.items ?? []) {
      if (it.status === 'ready' && it.ready_at && it.sent_at) {
        const diff = (new Date(it.ready_at) - new Date(it.sent_at)) / 60000;
        if (diff >= 0 && diff < 120) { // sanity
          avgKitchenMin = (avgKitchenMin ?? 0) + diff;
          kitchenCount++;
        }
      }
    }
  }
  avgKitchenMin = kitchenCount > 0 ? avgKitchenMin / kitchenCount : null;

  // Top productos del día (cuenta abiertas + pagas)
  // Necesito traer también items de órdenes pagas.
  const paidItemsQ = ordersPaidCount > 0
    ? await supabase
        .from('order_items')
        .select('product_id, product_name_snapshot, qty, unit_price_snapshot, status')
        .in('order_id', paidOrders.map((o) => o.id))
    : { data: [], error: null };
  if (paidItemsQ.error) throw paidItemsQ.error;

  const tally = new Map();
  const accumulate = (items) => {
    for (const it of items ?? []) {
      if (it.status === 'cancelled') continue;
      const key = it.product_id;
      const cur = tally.get(key) ?? { name: it.product_name_snapshot, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += Number(it.unit_price_snapshot) * it.qty;
      tally.set(key, cur);
    }
  };
  accumulate(paidItemsQ.data);
  for (const o of openOrders) accumulate(o.items);
  const topProducts = Array.from(tally.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Alertas: mesas abiertas hace más de 3 horas sin movimiento
  const STALE_MS = 3 * 60 * 60 * 1000;
  const alerts = openOrders
    .filter((o) => Date.now() - new Date(o.opened_at).getTime() > STALE_MS)
    .map((o) => ({ table_id: o.table_id, opened_at: o.opened_at }));

  return {
    revenueToday,
    byMethod,
    ordersPaidCount,
    avgTicket,
    tablesOccupied,
    totalTables,
    openValue,
    avgKitchenMin,
    topProducts,
    alerts,
    updatedAt: new Date().toISOString(),
  };
}

export function useAdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const s = await fetchStats();
      setStats(s); setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();

    const channel = supabase.channel('admin-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => refresh())
      .subscribe();

    // Refresca cada 60s para actualizar el "hace X min" sin esperar evento.
    const i = setInterval(refresh, 60000);

    return () => {
      cancelled = true;
      clearInterval(i);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { stats, loading, error, refresh };
}
