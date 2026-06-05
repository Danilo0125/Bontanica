// CajaGate.jsx — pantalla de login (password + selector de mesero). Tema blanco.
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CAJA_PASSWORD, isAuthed, setSession } from '../../lib/cajaSession.js';
import { ensureAudioCtx } from '../../lib/audio.js';

const SERVERS = [
  { id: 'ochito', label: 'Ochito' },
  { id: 'nath',   label: 'Nath' },
];

export function CajaGate() {
  const [step, setStep] = useState(isAuthed() ? 'done' : 'password');
  const [pw, setPw] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  if (step === 'done' || isAuthed()) {
    return <Navigate to="/caja/mesero" replace />;
  }

  const submitPassword = (e) => {
    e.preventDefault();
    // Aprovechamos este user gesture para desbloquear el AudioContext (iOS/Safari).
    ensureAudioCtx();
    if (pw === CAJA_PASSWORD) {
      setError(null);
      setStep('server');
    } else {
      setError('Contraseña incorrecta');
    }
  };

  const pickServer = (id) => {
    // Segundo user gesture — garantía extra para que los beeps anden en móvil.
    ensureAudioCtx();
    setSession({ server: id });
    navigate('/caja/mesero', { replace: true });
  };

  return (
    <div className="staff-shell">
      <div className="staff-gate">
        <Link to="/" className="gate-back">← Volver al sitio</Link>
        <div className="gate-leaf" aria-hidden="true">🌿</div>
        <h1 className="gate-title">Personal · Botánica</h1>
        <p className="gate-sub">Acceso a caja, cocina y administración</p>
        {step === 'password' && (
          <form onSubmit={submitPassword} className="gate-form">
            <label className="field">
              <span>Contraseña</span>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pw}
                onChange={(e) => { setPw(e.target.value); setError(null); }}
                placeholder="••••••••"
              />
            </label>
            {error && <p className="gate-error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={!pw}>
              Continuar
            </button>
          </form>
        )}
        {step === 'server' && (
          <div className="gate-form">
            <p className="s-sub" style={{ textAlign: 'center', marginBottom: 4 }}>¿Quién está atendiendo?</p>
            <div className="gate-servers">
              {SERVERS.map((s) => (
                <button key={s.id} className="gate-server" onClick={() => pickServer(s.id)}>
                  <span className="gate-server-ini">{s.label[0]}</span>
                  <span className="gate-server-name">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
