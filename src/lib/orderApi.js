// orderApi.js — wrappers de operaciones sobre orders / order_items.
import { supabase } from './supabase.js';

// Devuelve la orden abierta de la mesa, o la crea si no existe.
// Maneja el unique partial index (table_id WHERE status='open') con un
// SELECT-then-INSERT y un fallback a SELECT si el INSERT colisiona.
export async function getOrCreateOpenOrder(tableId, serverId) {
  const existing = await supabase
    .from('orders')
    .select('*')
    .eq('table_id', tableId)
    .eq('status', 'open')
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const inserted = await supabase
    .from('orders')
    .insert({ table_id: tableId, server_id: serverId, status: 'open' })
    .select('*')
    .single();
  if (inserted.error) {
    // Race: otro cliente creó la orden entre el select y el insert.
    if (inserted.error.code === '23505') {
      const retry = await supabase
        .from('orders')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'open')
        .single();
      if (retry.error) throw retry.error;
      return retry.data;
    }
    throw inserted.error;
  }
  return inserted.data;
}

// Inserta una tanda de items a la vez. Genera un batch_id compartido.
// items: [{ product, qty }]  → product es la row de products.
export async function addItemsToOrder(orderId, items, serverId) {
  if (!items?.length) return [];
  const batchId = crypto.randomUUID();
  const rows = items.map(({ product, qty }) => ({
    order_id: orderId,
    product_id: product.id,
    product_name_snapshot: product.name,
    unit_price_snapshot: product.price,
    qty,
    status: 'pending',
    server_id: serverId,
    batch_id: batchId,
  }));
  const { data, error } = await supabase
    .from('order_items')
    .insert(rows)
    .select('*');
  if (error) throw error;
  return data;
}

export async function markBatchReady(batchId) {
  const { error } = await supabase
    .from('order_items')
    .update({ status: 'ready', ready_at: new Date().toISOString() })
    .eq('batch_id', batchId);
  if (error) throw error;
}

export async function cancelBatch(batchId) {
  const { error } = await supabase
    .from('order_items')
    .update({ status: 'cancelled' })
    .eq('batch_id', batchId);
  if (error) throw error;
}

// Ajusta qty de un item específico ya enviado a cocina (mientras esté pending).
export async function updateItemQty(itemId, newQty) {
  if (!Number.isInteger(newQty) || newQty < 1) {
    throw new Error('qty debe ser entero ≥ 1');
  }
  const { error } = await supabase
    .from('order_items')
    .update({ qty: newQty })
    .eq('id', itemId);
  if (error) throw error;
}

// Cancela un item específico (no toda la tanda). El item queda visible
// en cocina con status='cancelled' por unos segundos antes de filtrarse.
export async function removeItem(itemId) {
  const { error } = await supabase
    .from('order_items')
    .update({ status: 'cancelled' })
    .eq('id', itemId);
  if (error) throw error;
}

export async function payOrder(orderId, { method, received, total }) {
  const patch = {
    status: 'paid',
    payment_method: method,
    received_amount: method === 'efectivo' ? received : null,
    total,
    paid_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) throw error;
}

export async function cancelOrder(orderId) {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId);
  if (error) throw error;
}

// Trae todas las órdenes abiertas con sus items.
// Filtra items cancelled hace más de 30s (cocina ve los cancelados recientes
// para entender qué pasó). Devuelve [{ ...order, items: [...] }].
export async function fetchOpenOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('status', 'open')
    .order('opened_at', { ascending: true });
  if (error) throw error;
  const cutoff = Date.now() - 30000;
  return (data ?? []).map((o) => ({
    ...o,
    items: (o.items ?? []).filter((it) => {
      if (it.status !== 'cancelled') return true;
      const ts = new Date(it.last_modified_at ?? it.sent_at).getTime();
      return ts > cutoff;
    }),
  }));
}
