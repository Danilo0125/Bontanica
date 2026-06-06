// useVariants.js — variantes activas indexadas por productId, con realtime
// del campo `stock` para que el ProductPicker reaccione en vivo cuando
// otro mesero cobra una variante.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { listAllVariants } from './variantApi.js';

export function useVariants() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const r = await listAllVariants();
      setRows(r);
      setError(null);
    } catch (e) { setError(e); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();

    const channel = supabase
      .channel('variants-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants' }, () => refresh())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [refresh]);

  // Map<productId, variant[]> para acceso rápido en el picker.
  const byProduct = useMemo(() => {
    const m = new Map();
    for (const v of rows) {
      if (!m.has(v.product_id)) m.set(v.product_id, []);
      m.get(v.product_id).push(v);
    }
    return m;
  }, [rows]);

  // Helper: stock total por producto (suma de variantes activas).
  const totalStockOf = useCallback((productId) => {
    const list = byProduct.get(productId) ?? [];
    return list.reduce((s, v) => s + Math.max(0, v.stock ?? 0), 0);
  }, [byProduct]);

  return { variants: rows, byProduct, totalStockOf, loading, error, refresh };
}
