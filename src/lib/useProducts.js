// useProducts.js — carga products activos y los agrupa por categoría.
// Usado por la carta pública (Catalog) y por ProductPicker en Caja.
import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (cancelled) return;
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }
      const rows = data ?? [];
      setProducts(rows);
      // Agrupa preservando el orden de aparición.
      const map = new Map();
      for (const p of rows) {
        if (!map.has(p.category_id)) {
          map.set(p.category_id, {
            id: p.category_id,
            name: p.category_name,
            tag: p.category_tag,
            items: [],
          });
        }
        map.get(p.category_id).items.push(p);
      }
      setCategories(Array.from(map.values()));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { products, categories, loading, error };
}
