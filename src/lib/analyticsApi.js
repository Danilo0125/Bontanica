// analyticsApi.js — wrappers de las RPCs analíticas del admin.
import { supabase } from './supabase.js';

const isoFrom = (d) => (d instanceof Date ? d.toISOString() : d);

async function callRpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data ?? [];
}

export function fetchKpis(from, to) {
  return callRpc('analytics_kpis', { p_from: isoFrom(from), p_to: isoFrom(to) })
    .then((rows) => rows[0] ?? { revenue: 0, batches: 0, items: 0, avg_ticket: 0, active_tables: 0, distinct_servers: 0 });
}

export function fetchTopProducts(from, to, limit = 10) {
  return callRpc('analytics_top_products', { p_from: isoFrom(from), p_to: isoFrom(to), p_limit: limit });
}

export function fetchTopFlavors(from, to, limit = 10) {
  return callRpc('analytics_top_flavors', { p_from: isoFrom(from), p_to: isoFrom(to), p_limit: limit });
}

export function fetchRevenueByDay(from, to) {
  return callRpc('analytics_revenue_by_day', { p_from: isoFrom(from), p_to: isoFrom(to) });
}

export function fetchRevenueByHour(from, to) {
  return callRpc('analytics_revenue_by_hour', { p_from: isoFrom(from), p_to: isoFrom(to) });
}

export function fetchServerPerformance(from, to) {
  return callRpc('analytics_server_performance', { p_from: isoFrom(from), p_to: isoFrom(to) });
}

export function fetchKitchenTimes(from, to) {
  return callRpc('analytics_kitchen_times', { p_from: isoFrom(from), p_to: isoFrom(to) });
}

// ─── Helpers de rangos ──────────────────────────────────────────────────────
export function rangePresets() {
  const now = new Date();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const today = startOfDay(now);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const last7 = new Date(today); last7.setDate(last7.getDate() - 6);
  const last30 = new Date(today); last30.setDate(last30.getDate() - 29);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    today:      { label: 'Hoy',           from: today,      to: tomorrow },
    yesterday:  { label: 'Ayer',          from: yesterday,  to: today },
    last7:      { label: 'Últimos 7 días',from: last7,      to: tomorrow },
    last30:     { label: 'Últimos 30 días',from: last30,    to: tomorrow },
  };
}
