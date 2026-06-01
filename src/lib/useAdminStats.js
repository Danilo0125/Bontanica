// useAdminStats.js — métricas en vivo para /caja/admin.
// Modelo nuevo: revenue viene de order_batches (cada tanda es un cobro independiente).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

async function fetchStats() {
  const today = startOfToday();

  // Batches cobrados hoy (revenue)
  const batchesQ = supabase.from('order_batches')
    .select('id, total, payment_method, paid_at, delivered_at, status, order_id')
    .gte('paid_at', today)
    .neq('status', 'cancelled');

  // Órdenes abiertas + sus batches/items
  const openQ = supabase.from('orders')
    .select('id, table_id, opened_at, status, batches:order_batches(id, total, status, paid_at, delivered_at, payment_method)')
    .eq('status', 'open');

  // Mesas activas total
  const tablesQ = supabase.from('tables_pos').select('id').eq('is_active', true);

  const [batchesR, openR, tablesR] = await Promise.all([batchesQ, openQ, tablesQ]);
  if (batchesR.error) throw batchesR.error;
  if (openR.error) throw openR.error;
  if (tablesR.error) throw tablesR.error;

  const allBatchesToday = batchesR.data ?? [];
  const openOrders = openR.data ?? [];
  const totalTables = (tablesR.data ?? []).length;

  // Facturación hoy
  const revenueToday = allBatchesToday.reduce((s, b) => s + Number(b.total ?? 0), 0);
  const byMethod = allBatchesToday.reduce((acc, b) => {
    const m = b.payment_method ?? 'sin-método';
    acc[m] = (acc[m] ?? 0) + Number(b.total ?? 0);
    return acc;
  }, {});
  const batchCount = allBatchesToday.length;
  const avgTicket = batchCount > 0 ? revenueToday / batchCount : 0;

  // Mesas ocupadas: con al menos 1 batch en 'paid' (no delivered ni cancelled)
  const occupiedOrders = openOrders.filter(
    (o) => (o.batches ?? []).some((b) => b.status === 'paid')
  );
  const tablesOccupied = occupiedOrders.length;
  const openValue = occupiedOrders.reduce(
    (s, o) => s + (o.batches ?? [])
      .filter((b) => b.status === 'paid')
      .reduce((ss, b) => ss + Number(b.total), 0),
    0
  );

  // Tiempo medio de entrega (paid_at → delivered_at), solo batches delivered hoy
  const delivered = allBatchesToday.filter(
    (b) => b.status === 'delivered' && b.paid_at && b.delivered_at
  );
  const avgDeliverMin = delivered.length > 0
    ? delivered.reduce((s, b) => s + (new Date(b.delivered_at) - new Date(b.paid_at)) / 60000, 0) / delivered.length
    : null;

  // Top productos del día (items de batches no-cancelados de hoy)
  let topProducts = [];
  if (batchCount > 0) {
    const ids = allBatchesToday.map((b) => b.id);
    const itemsR = await supabase.from('order_items')
      .select('product_id, product_name_snapshot, qty, unit_price_snapshot, status')
      .in('batch_id', ids)
      .neq('status', 'cancelled');
    if (itemsR.error) throw itemsR.error;
    const tally = new Map();
    for (const it of itemsR.data ?? []) {
      const cur = tally.get(it.product_id) ?? { name: it.product_name_snapshot, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += Number(it.unit_price_snapshot) * it.qty;
      tally.set(it.product_id, cur);
    }
    topProducts = Array.from(tally.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }

  // Alertas: mesas abiertas hace >3h
  const STALE = 3 * 60 * 60 * 1000;
  const alerts = openOrders
    .filter((o) => Date.now() - new Date(o.opened_at).getTime() > STALE)
    .map((o) => ({ table_id: o.table_id, opened_at: o.opened_at }));

  return {
    revenueToday, byMethod, ordersPaidCount: batchCount, avgTicket,
    tablesOccupied, totalTables, openValue,
    avgKitchenMin: avgDeliverMin,
    topProducts, alerts,
    updatedAt: new Date().toISOString(),
  };
}

export function useAdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try { setStats(await fetchStats()); setError(null); }
    catch (e) { setError(e); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { await refresh(); if (!cancelled) setLoading(false); })();
    const channel = supabase.channel('admin-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_batches' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => refresh())
      .subscribe();
    const i = setInterval(refresh, 60000);
    return () => { cancelled = true; clearInterval(i); supabase.removeChannel(channel); };
  }, [refresh]);

  return { stats, loading, error, refresh };
}
