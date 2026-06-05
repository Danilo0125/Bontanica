// cajaSession.js — DEPRECATED.
// El password-gate compartido fue reemplazado por Supabase Auth real.
// Usar `useAuth()` de `src/lib/auth.jsx` en su lugar.
//
// Este archivo se conserva temporalmente para evitar errores si quedó algún
// import suelto; todos los exports son no-ops. Eliminar en una limpieza futura.

export function getSession() { return null; }
export function setSession() { return null; }
export function clearSession() {}
export function isAuthed() { return false; }
export const CAJA_PASSWORD = null;
