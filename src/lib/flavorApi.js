// flavorApi.js — sabores compartidos entre productos (M:N via product_flavors).
// Toggle is_active de un sabor → desaparece en TODOS los productos que lo usan.
import { supabase } from './supabase.js';

const slugify = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `fl-${Date.now()}`;

// ─── Lecturas públicas ──────────────────────────────────────────────────────
export async function listActiveFlavors() {
  const { data, error } = await supabase
    .from('flavors')
    .select('*')
    .eq('is_active', true)
    .order('sort_order').order('name');
  if (error) throw error;
  return data ?? [];
}

// Trae vínculos product_flavors. Filtra al sabor activo en el JOIN para que el
// picker vea solo los que actualmente están vendibles.
export async function listProductFlavorLinks() {
  const { data, error } = await supabase
    .from('product_flavors')
    .select('product_id, flavor_id, sort_order, flavor:flavors!inner(id, name, is_active, sort_order)')
    .eq('flavor.is_active', true);
  if (error) throw error;
  return data ?? [];
}

// ─── Admin ──────────────────────────────────────────────────────────────────
export async function adminListAllFlavors() {
  const { data, error } = await supabase
    .from('flavors')
    .select('*')
    .order('sort_order').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function adminListAllProductFlavorLinks() {
  const { data, error } = await supabase
    .from('product_flavors')
    .select('product_id, flavor_id, sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function createFlavor({ name, sortOrder = 0 }) {
  const id = slugify(name);
  const { data, error } = await supabase
    .from('flavors')
    .insert({ id, name: name.trim(), sort_order: Number(sortOrder), is_active: true })
    .select('*').single();
  if (error) throw error;
  return data;
}

export async function updateFlavor(id, patch) {
  const allowed = ['name', 'is_active', 'sort_order'];
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  if (safe.sort_order != null) safe.sort_order = Number(safe.sort_order);
  const { data, error } = await supabase.from('flavors').update(safe).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteFlavor(id) {
  const { error } = await supabase.from('flavors').delete().eq('id', id);
  if (error) throw error;
}

// Atach / detach de un sabor a un producto
export async function attachFlavorToProduct(productId, flavorId, sortOrder = 0) {
  const { error } = await supabase
    .from('product_flavors')
    .insert({ product_id: productId, flavor_id: flavorId, sort_order: Number(sortOrder) });
  if (error) throw error;
}

export async function detachFlavorFromProduct(productId, flavorId) {
  const { error } = await supabase
    .from('product_flavors')
    .delete()
    .eq('product_id', productId)
    .eq('flavor_id', flavorId);
  if (error) throw error;
}
