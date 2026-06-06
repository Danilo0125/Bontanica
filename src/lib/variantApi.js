// variantApi.js — lectura de variantes (sabores) por producto.
// El cliente solo lee; los writes van por stockApi (RPC) o por admin via update.
import { supabase } from './supabase.js';

export async function listAllVariants() {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('is_active', true)
    .order('product_id')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listVariantsByProduct(productId) {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

// Admin: lista TODAS (también inactivas) para CRUD.
export async function adminListVariantsByProduct(productId) {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

const slugify = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `v-${Date.now()}`;

export async function createVariant({ productId, name, description, extraPrice = 0, sortOrder = 0 }) {
  const id = `${productId}-${slugify(name)}`;
  const { data, error } = await supabase.from('product_variants').insert({
    id, product_id: productId, name, description: description ?? null,
    extra_price: Number(extraPrice), sort_order: Number(sortOrder), is_active: true, stock: 0,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateVariant(id, patch) {
  const allowed = ['name', 'description', 'extra_price', 'sort_order', 'is_active'];
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  if (safe.extra_price != null) safe.extra_price = Number(safe.extra_price);
  if (safe.sort_order != null) safe.sort_order = Number(safe.sort_order);
  const { data, error } = await supabase.from('product_variants').update(safe).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteVariant(id) {
  const { error } = await supabase.from('product_variants').delete().eq('id', id);
  if (error) throw error;
}
