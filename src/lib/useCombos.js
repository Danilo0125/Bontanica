// useCombos.js — combos activos + sus items. Realtime para que un admin
// que agrega un combo lo vea aparecer en el ProductPicker del mesero.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { listCombos } from './comboApi.js';

export function useCombos() {
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await listCombos();
      setCombos((rows ?? []).filter((c) => c.is_active));
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
      .channel('combos-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combos' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combo_items' }, () => refresh())
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [refresh]);

  return { combos, loading, error, refresh };
}
