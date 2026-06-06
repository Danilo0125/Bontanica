// useFlavors.js — sabores activos + vínculos product→flavor con realtime.
// Reemplaza useVariants. El picker reacciona en vivo cuando admin toggle
// un sabor: si se desactiva, desaparece en todos los productos que lo usan.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { listActiveFlavors, listProductFlavorLinks } from './flavorApi.js';

export function useFlavors() {
  const [flavors, setFlavors] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [fl, lk] = await Promise.all([listActiveFlavors(), listProductFlavorLinks()]);
      setFlavors(fl);
      setLinks(lk);
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
      .channel('flavors-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flavors' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_flavors' }, () => refresh())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [refresh]);

  const flavorsById = useMemo(() => new Map(flavors.map((f) => [f.id, f])), [flavors]);

  // Map<productId, flavor[]> con orden por sort_order del link.
  const byProduct = useMemo(() => {
    const m = new Map();
    for (const link of links) {
      const f = flavorsById.get(link.flavor_id);
      if (!f) continue; // sabor desactivado: el join filtró, pero por las dudas
      if (!m.has(link.product_id)) m.set(link.product_id, []);
      m.get(link.product_id).push({ ...f, link_sort: link.sort_order });
    }
    for (const list of m.values()) {
      list.sort((a, b) => (a.link_sort ?? 0) - (b.link_sort ?? 0));
    }
    return m;
  }, [links, flavorsById]);

  return { flavors, byProduct, loading, error, refresh };
}
