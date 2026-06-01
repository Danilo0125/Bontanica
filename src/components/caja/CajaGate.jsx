// CajaGate.jsx — pantalla de login (password + selector de mesero).
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CAJA_PASSWORD, isAuthed, setSession } from '../../lib/cajaSession.js';

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
    if (pw === CAJA_PASSWORD) {
      setError(null);
      setStep('server');
    } else {
      setError('Contraseña incorrecta');
    }
  };

  const pickServer = (id) => {
    setSession({ server: id });
    navigate('/caja/mesero', { replace: true });
  };

  return (
    <div className="caja-gate">
      <Link to="/" className="caja-gate-back">← Volver al sitio</Link>
      <div className="caja-gate-leaf" aria-hidden="true">🌿</div>
      <h1 className="caja-gate-title">Caja · Botánica</h1>
      {step === 'password' && (
        <form onSubmit={submitPassword} className="caja-gate-form">
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
          {error && <p className="caja-gate-error">{error}</p>}
          <button type="submit" className="btn-gold btn-gold--block" disabled={!pw}>
            Continuar
          </button>
        </form>
      )}
      {step === 'server' && (
        <div className="caja-gate-form">
          <p className="caja-gate-sub">¿Quién está atendiendo?</p>
          <div className="caja-gate-servers">
            {SERVERS.map((s) => (
              <button key={s.id} className="caja-gate-server" onClick={() => pickServer(s.id)}>
                <span className="caja-gate-server-ini">{s.label[0]}</span>
                <span className="caja-gate-server-name">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
