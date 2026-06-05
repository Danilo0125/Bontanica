// auditApi.js — log de acciones que cambian estado.
// Fire-and-forget: nunca bloquea ni rompe el flujo principal.
import { supabase } from './supabase.js';

export function logAction(action, { kind = null, id = null, payload = null } = {}) {
  // No await — el llamador no necesita esperar. Errores se tragan.
  return supabase
    .rpc('log_action', {
      p_action: action,
      p_target_kind: kind,
      p_target_id: id != null ? String(id) : null,
      p_payload: payload,
    })
    .then(() => null)
    .catch((e) => { console.warn('[audit]', e?.message ?? e); return null; });
}

// Trae el feed reciente (solo admin por RLS).
export async function fetchAuditLog({ limit = 100, action = null, actor = null } = {}) {
  let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (action) q = q.eq('action', action);
  if (actor)  q = q.eq('actor_username', actor);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
