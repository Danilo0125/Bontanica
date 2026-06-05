// notificationsApi.js — bandeja de notificaciones del staff.
// Cada usuario (mesero, cocina, admin) ve solo las que tienen
// recipient_username = su username.
import { supabase } from './supabase.js';

export async function createNotification({ recipient, kind, title, message, tableId = null, batchId = null }) {
  if (!recipient) return null;
  const { data, error } = await supabase.from('notifications').insert({
    recipient_username: recipient,
    kind,
    title: title ?? null,
    message,
    table_id: tableId,
    batch_id: batchId,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function listNotifications(recipient, { limit = 50 } = {}) {
  if (!recipient) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_username', recipient)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(recipient) {
  if (!recipient) return;
  const { error } = await supabase.from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('recipient_username', recipient)
    .eq('is_read', false);
  if (error) throw error;
}

// Limpia notifs vivas de un batch (al entregarlo o cancelarlo). Evita que la
// campana siga mostrando "Mesa X · tanda lista" cuando ya no aplica.
export async function markBatchNotificationsRead(recipient, batchId) {
  if (!recipient || !batchId) return;
  const { error } = await supabase.from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('recipient_username', recipient)
    .eq('batch_id', batchId)
    .eq('is_read', false);
  if (error) console.warn('[notif] no se pudo limpiar:', error.message);
}
