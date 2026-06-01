// productApi.js — CRUD de productos. Editan desde el admin con anon key.
// TODO crítico: cerrar acceso público a estas operaciones cuando se migre a Supabase Auth.
import { supabase } from './supabase.js';

// Lista TODOS los productos (incluso inactivos) para el admin.
export async function listAllProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('category_id', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

const slugify = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `prod-${Date.now()}`;

export async function createProduct(p) {
  const id = p.id ?? slugify(p.name);
  const row = {
    id, name: p.name, description: p.description ?? '',
    category_id: p.category_id, category_name: p.category_name,
    category_tag: p.category_tag ?? null,
    price: Number(p.price),
    sort_order: Number(p.sort_order ?? 0),
    is_active: p.is_active !== false,
  };
  const { data, error } = await supabase.from('products').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id, patch) {
  // Sanitizar: solo permite los campos editables
  const allowed = ['name', 'description', 'category_id', 'category_name', 'category_tag', 'price', 'sort_order', 'is_active'];
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  if (safe.price != null) safe.price = Number(safe.price);
  if (safe.sort_order != null) safe.sort_order = Number(safe.sort_order);
  const { data, error } = await supabase.from('products').update(safe).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deactivateProduct(id) {
  return updateProduct(id, { is_active: false });
}
export async function activateProduct(id) {
  return updateProduct(id, { is_active: true });
}
