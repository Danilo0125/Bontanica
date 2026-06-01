// useTables.js — carga las mesas activas desde tables_pos.
import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export function useTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('tables_pos')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });
      if (cancelled) return;
      if (error) { setError(error); setLoading(false); return; }
      setTables(data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { tables, loading, error };
}
