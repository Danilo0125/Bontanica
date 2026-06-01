// comboApi.js — CRUD de combos (productos compuestos con precio fijo).
import { supabase } from './supabase.js';

const slugify = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `combo-${Date.now()}`;

export async function listCombos() {
  const { data, error } = await supabase
    .from('combos')
    .select('*, items:combo_items(product_id, qty)')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCombo({ name, description, price, items, sort_order }) {
  const id = slugify(name);
  const insC = await supabase.from('combos').insert({
    id, name, description: description ?? null, price: Number(price),
    sort_order: Number(sort_order ?? 0), is_active: true,
  }).select('*').single();
  if (insC.error) throw insC.error;
  if (items?.length) {
    const rows = items.map((it) => ({ combo_id: id, product_id: it.product_id, qty: Number(it.qty) }));
    const insI = await supabase.from('combo_items').insert(rows);
    if (insI.error) {
      // rollback: borrar el combo
      await supabase.from('combos').delete().eq('id', id);
      throw insI.error;
    }
  }
  return insC.data;
}

export async function updateCombo(id, { name, description, price, items, is_active, sort_order }) {
  const patch = {};
  if (name != null) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (price != null) patch.price = Number(price);
  if (is_active != null) patch.is_active = is_active;
  if (sort_order != null) patch.sort_order = Number(sort_order);
  if (Object.keys(patch).length) {
    const u = await supabase.from('combos').update(patch).eq('id', id);
    if (u.error) throw u.error;
  }
  if (items) {
    // estrategia simple: borrar todos los items del combo y reinsertar.
    const del = await supabase.from('combo_items').delete().eq('combo_id', id);
    if (del.error) throw del.error;
    if (items.length) {
      const rows = items.map((it) => ({ combo_id: id, product_id: it.product_id, qty: Number(it.qty) }));
      const ins = await supabase.from('combo_items').insert(rows);
      if (ins.error) throw ins.error;
    }
  }
}

export async function deleteCombo(id) {
  const { error } = await supabase.from('combos').delete().eq('id', id);
  if (error) throw error;
}
