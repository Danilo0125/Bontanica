// supabase.js — cliente único, alimentado por env vars VITE_SUPABASE_*.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // No reventar el bundle en build; solo avisar en runtime.
  console.error(
    '[supabase] Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en .env. ' +
    'Caja y carta no podrán cargar datos hasta que los pongas.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  realtime: { params: { eventsPerSecond: 5 } },
  auth: { persistSession: false },
});
