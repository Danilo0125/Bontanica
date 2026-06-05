// auth.jsx — Auth real con Supabase. Reemplaza el password-gate viejo.
// Username sin email: internamente se traduce a `username@botanica.local`.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';

const AuthCtx = createContext(null);

const EMAIL_DOMAIN = '@botanica.local';
const usernameToEmail = (u) => `${String(u).trim().toLowerCase()}${EMAIL_DOMAIN}`;
const emailToUsername = (e) => String(e ?? '').replace(EMAIL_DOMAIN, '');

async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('staff_users')
    .select('id, username, full_name, role, is_active')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session ?? null);
      const p = data.session ? await fetchProfile(data.session.user.id) : null;
      if (!cancelled) { setProfile(p); setLoading(false); }
    })();
    // IMPORTANTE: el callback de onAuthStateChange NO puede hacer await directo
    // (lockea el auth client de Supabase). Diferimos el fetchProfile.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      if (!s) { setProfile(null); return; }
      setTimeout(async () => {
        if (cancelled) return;
        const p = await fetchProfile(s.user.id);
        if (!cancelled) setProfile(p);
      }, 0);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (username, password) => {
    const email = usernameToEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Mensaje más amable que el genérico de Supabase
      if (/invalid login/i.test(error.message)) {
        throw new Error('Usuario o contraseña incorrectos');
      }
      throw error;
    }
    const p = await fetchProfile(data.user.id);
    if (!p) {
      await supabase.auth.signOut();
      throw new Error('Usuario sin perfil de staff — pedile al admin que te registre');
    }
    if (!p.is_active) {
      await supabase.auth.signOut();
      throw new Error('Tu usuario está desactivado');
    }
    setProfile(p);
    return p;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    username: profile?.username ?? null,
    role: profile?.role ?? null,
    fullName: profile?.full_name ?? null,
    isActive: !!profile?.is_active,
    loading,
    signIn,
    signOut,
  }), [session, profile, loading, signIn, signOut]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

export { usernameToEmail, emailToUsername };
