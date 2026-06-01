// cajaSession.js — sesión local de Caja (password gate compartido + selector).
// Persistencia simple en localStorage. NO es auth real — el password viaja al
// cliente y vive en bundle. Mitigación social, no de seguridad.

const STORAGE_KEY = 'botanica_caja_session';
export const CAJA_PASSWORD = '87654321';

export function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.server) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSession({ server }) {
  const payload = { server, loggedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isAuthed() {
  return getSession() !== null;
}
