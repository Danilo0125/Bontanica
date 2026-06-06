// stockApi.js — ajustes de stock + lectura del feed de movements.
// Todo va por RPC SECURITY DEFINER (decrementos van por sendBatchPaid).
import { supabase } from './supabase.js';

// Admin: ajustar stock de una variante. Devuelve delta aplicado.
// reason: 'restock' | 'adjust' | 'spoilage' | 'init'
export async function adjustStock(variantId, newValue, reason, note = null) {
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_variant_id: variantId,
    p_new_value: Number(newValue),
    p_reason: reason,
    p_note: note,
  });
  if (error) throw new Error(error.message);
  return data; // delta
}

// Admin: trae los movements más recientes (todos los productos).
export async function fetchRecentStockMovements({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, variant:product_variants(name, product_id)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
