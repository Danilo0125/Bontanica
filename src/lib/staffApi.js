// staffApi.js — gestión de usuarios del staff (admin only).
// El insert va por RPC SECURITY DEFINER porque crear auth.users requiere
// privilegios elevados que la anon key no tiene.
import { supabase } from './supabase.js';

export async function listStaffUsers() {
  const { data, error } = await supabase
    .from('staff_users')
    .select('id, username, full_name, role, is_active, created_at')
    .order('role')
    .order('username');
  if (error) throw error;
  return data ?? [];
}

export async function createStaffUser({ username, fullName, role, password }) {
  const { data, error } = await supabase.rpc('create_staff_user', {
    p_username: String(username).trim().toLowerCase(),
    p_full_name: String(fullName).trim(),
    p_role: role,
    p_password: password,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function setStaffActive(id, isActive) {
  const { error } = await supabase
    .from('staff_users')
    .update({ is_active: !!isActive })
    .eq('id', id);
  if (error) throw error;
}

export async function updateStaffRole(id, role) {
  const { error } = await supabase
    .from('staff_users')
    .update({ role })
    .eq('id', id);
  if (error) throw error;
}

export async function resetStaffPassword(username, newPassword) {
  const { error } = await supabase.rpc('reset_staff_password', {
    p_username: username,
    p_new_password: newPassword,
  });
  if (error) throw new Error(error.message);
}
