// orderApi.js — operaciones de cuenta + cobro pre-pago por tanda.
//
// Modelo:
//   orders          (cuenta de una mesa; status open|closed|cancelled)
//     └── order_batches    (cada "envío a cocina" YA cobrado; status paid|delivered|cancelled)
//             └── order_items  (cada producto del batch; status pending|ready|cancelled)
//
// El cobro se hace al enviar una tanda. La mesa se considera "ocupada" mientras
// haya algún batch en estado paid (no delivered ni cancelled).
import { supabase } from './supabase.js';
import { logAction } from './auditApi.js';

// ─── Orden por mesa (idempotente) ────────────────────────────────────────────
export async function getOrCreateOpenOrder(tableId, serverId) {
  const existing = await supabase
    .from('orders').select('*')
    .eq('table_id', tableId).eq('status', 'open').maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const inserted = await supabase
    .from('orders').insert({ table_id: tableId, server_id: serverId, status: 'open' })
    .select('*').single();
  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const retry = await supabase.from('orders').select('*')
        .eq('table_id', tableId).eq('status', 'open').single();
      if (retry.error) throw retry.error;
      return retry.data;
    }
    throw inserted.error;
  }
  return inserted.data;
}

// ─── Enviar a cocina + cobrar (atómico server-side) ──────────────────────────
// items: [{ product, flavor, qty, unitPrice }] — flavor opcional.
// Una sola transacción en la RPC create_batch: si algo falla, rollback total.
export async function sendBatchPaid({ orderId, items, serverId, payment }) {
  if (!items?.length) throw new Error('No hay items para enviar');

  const rpcItems = items.map(({ product, flavor, qty, unitPrice }) => ({
    product_id: product.id,
    flavor_id: flavor?.id ?? null,
    product_name_snapshot: product.name,
    flavor_name_snapshot: flavor?.name ?? null,
    unit_price_snapshot: Number(unitPrice ?? product.price),
    qty: Number(qty),
  }));

  const { data, error } = await supabase.rpc('create_batch', {
    p_order_id: orderId,
    p_items: rpcItems,
    p_payment_method: payment.method,
    p_received_amount: payment.method === 'efectivo' ? Number(payment.received_amount ?? null) : null,
    p_server_id: serverId,
  });
  if (error) throw error;

  const batch = { id: data.batch_id, total: data.total, order_id: orderId, server_id: serverId };
  logAction('batch_paid', {
    kind: 'order_batch', id: batch.id,
    payload: {
      order_id: orderId, total: data.total,
      payment_method: payment.method, item_count: items.length,
      items: rpcItems.map((it) => ({ id: it.product_id, flavor_id: it.flavor_id, qty: it.qty })),
    },
  });
  return { batch, items: rpcItems };
}

// ─── Marcar batch como listo (cocina) ────────────────────────────────────────
// Setea items.status=ready + ready_at + last_notified_at. Esto dispara el aviso
// global al mesero dueño (efecto en CajaLayout) sin importar en qué ruta esté.
export async function markBatchReady(batchId) {
  const now = new Date().toISOString();
  const itemsRes = await supabase.from('order_items')
    .update({ status: 'ready', ready_at: now })
    .eq('batch_id', batchId);
  if (itemsRes.error) throw itemsRes.error;
  const batchRes = await supabase.from('order_batches')
    .update({ ready_at: now, last_notified_at: now })
    .eq('id', batchId);
  if (batchRes.error) throw batchRes.error;
  logAction('batch_ready', { kind: 'order_batch', id: batchId });
}

// ─── Reenviar el aviso al mesero (botón "Volver a notificar" en cocina) ─────
export async function bumpBatchNotification(batchId) {
  const { error } = await supabase.from('order_batches')
    .update({ last_notified_at: new Date().toISOString() })
    .eq('id', batchId);
  if (error) throw error;
  logAction('batch_renotified', { kind: 'order_batch', id: batchId });
}

// ─── Marcar batch como entregado (mesero, después de "Listo" de cocina) ─────
export async function markBatchDelivered(batchId) {
  const { error } = await supabase.from('order_batches')
    .update({ delivered_at: new Date().toISOString(), status: 'delivered' })
    .eq('id', batchId);
  if (error) throw error;
  logAction('batch_delivered', { kind: 'order_batch', id: batchId });
}

// ─── Cancelar batch entero (cancela también sus items) ──────────────────────
export async function cancelBatch(batchId) {
  // Items primero, batch después
  const a = await supabase.from('order_items').update({ status: 'cancelled' }).eq('batch_id', batchId);
  if (a.error) throw a.error;
  const b = await supabase.from('order_batches').update({ status: 'cancelled' }).eq('id', batchId);
  if (b.error) throw b.error;
  logAction('batch_cancelled', { kind: 'order_batch', id: batchId });
}

// ─── Ajustes finos de items ─────────────────────────────────────────────────
export async function updateItemQty(itemId, newQty) {
  if (!Number.isInteger(newQty) || newQty < 1) throw new Error('qty debe ser entero ≥ 1');
  const { error } = await supabase.from('order_items').update({ qty: newQty }).eq('id', itemId);
  if (error) throw error;
}

export async function removeItem(itemId) {
  const { error } = await supabase.from('order_items').update({ status: 'cancelled' }).eq('id', itemId);
  if (error) throw error;
}

// ─── Cerrar la orden cuando todos los batches están entregados/cancelados ──
export async function closeOrder(orderId) {
  const { error } = await supabase.from('orders').update({ status: 'closed' }).eq('id', orderId);
  if (error) throw error;
  logAction('order_closed', { kind: 'order', id: orderId });
}

// ─── Cancelar la orden entera (admin / mesa zombie) ─────────────────────────
export async function cancelOrder(orderId) {
  // Cancelar batches paid + items pendientes, después marcar order
  const batches = await supabase.from('order_batches')
    .update({ status: 'cancelled' }).eq('order_id', orderId).eq('status', 'paid');
  if (batches.error) throw batches.error;
  const items = await supabase.from('order_items')
    .update({ status: 'cancelled' }).eq('order_id', orderId).eq('status', 'pending');
  if (items.error) throw items.error;
  const ord = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  if (ord.error) throw ord.error;
  logAction('order_cancelled', { kind: 'order', id: orderId });
}

// ─── Lecturas ───────────────────────────────────────────────────────────────
// Trae órdenes abiertas con sus batches y items.
export async function fetchOpenOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, batches:order_batches(*), items:order_items(*)')
    .eq('status', 'open')
    .order('opened_at', { ascending: true });
  if (error) throw error;
  const cutoff = Date.now() - 30000;
  return (data ?? []).map((o) => ({
    ...o,
    batches: (o.batches ?? []).filter((b) => {
      if (b.status === 'paid') return true;
      // delivered/cancelled: ocultar después de 30s para limpieza visual
      const ts = new Date(b.delivered_at ?? b.created_at).getTime();
      return ts > cutoff;
    }),
    items: (o.items ?? []).filter((it) => it.status !== 'cancelled' || new Date(it.last_modified_at ?? it.sent_at).getTime() > cutoff),
  }));
}

// ─── DEPRECATED ─────────────────────────────────────────────────────────────
export function payOrder() {
  throw new Error('payOrder() ya no se usa. El cobro va por tanda con sendBatchPaid().');
}
export function addItemsToOrder() {
  throw new Error('addItemsToOrder() reemplazado por sendBatchPaid({ orderId, items, serverId, payment }).');
}
