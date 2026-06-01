// reservationApi.js — CRUD de reservas.
import { supabase } from './supabase.js';

export async function listReservations({ fromISO, toISO } = {}) {
  let q = supabase.from('reservations').select('*').order('reserved_at', { ascending: true });
  if (fromISO) q = q.gte('reserved_at', fromISO);
  if (toISO) q = q.lte('reserved_at', toISO);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createReservation(r) {
  const { data, error } = await supabase.from('reservations').insert({
    table_id: Number(r.table_id),
    customer_name: r.customer_name,
    customer_phone: r.customer_phone ?? null,
    party_size: Number(r.party_size),
    reserved_at: r.reserved_at,
    duration_minutes: Number(r.duration_minutes ?? 120),
    notes: r.notes ?? null,
    status: r.status ?? 'confirmed',
    created_by: r.created_by ?? null,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateReservation(id, patch) {
  const { data, error } = await supabase.from('reservations').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteReservation(id) {
  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) throw error;
}
