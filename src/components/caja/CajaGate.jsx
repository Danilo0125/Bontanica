// CajaGate.jsx — pantalla de login con username + password (Auth real).
import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';
import { ensureAudioCtx } from '../../lib/audio.js';

export function CajaGate() {
  const { signIn, profile, loading } = useAuth();
  const loc = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (loading) {
    return <div className="staff-shell"><div className="staff-gate"><p className="gate-sub">Cargando…</p></div></div>;
  }

  if (profile?.is_active) {
    const from = loc.state?.from && loc.state.from !== '/caja' ? loc.state.from : null;
    return <Navigate to={from ?? defaultRouteForRole(profile.role)} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    ensureAudioCtx(); // desbloquear audio en este user gesture
    if (!username.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(err.message ?? 'No pude iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="staff-shell">
      <div className="staff-gate">
        <Link to="/" className="gate-back">← Volver al sitio</Link>
        <div className="gate-leaf" aria-hidden="true">🌿</div>
        <h1 className="gate-title">Personal · Botánica</h1>
        <p className="gate-sub">Acceso a caja, cocina y administración</p>
        <form onSubmit={onSubmit} className="gate-form">
          <label className="field">
            <span>Usuario</span>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
              placeholder="ej. ochito"
            />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="••••••••"
            />
          </label>
          {error && <p className="gate-error" role="alert">{error}</p>}
          <button type="submit" className="btn-primary" disabled={!username.trim() || !password || submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function defaultRouteForRole(role) {
  if (role === 'mesero') return '/caja/mesero';
  if (role === 'cocina') return '/caja/cocina';
  if (role === 'admin')  return '/caja/admin';
  return '/caja';
}
