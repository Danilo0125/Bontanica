// StaffUsers.jsx — admin de usuarios del staff. Solo accesible para admin
// (gateado por ProtectedRoute allow="admin").
import { useEffect, useState } from 'react';
import {
  listStaffUsers, createStaffUser, setStaffActive,
  updateStaffRole, resetStaffPassword,
} from '../../../lib/staffApi.js';
import { useAuth } from '../../../lib/auth.jsx';
import { useToast } from '../Toasts.jsx';
import { useDialog } from '../Dialog.jsx';

const ROLE_LABEL = { admin: 'Admin', mesero: 'Mesero', cocina: 'Cocina' };
const ROLE_OPTIONS = ['mesero', 'cocina', 'admin'];

export function StaffUsers() {
  const { username: meUsername } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const toast = useToast();
  const dialog = useDialog();

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listStaffUsers();
      setUsers(rows);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onToggleActive = async (u) => {
    if (u.username === meUsername && u.is_active) {
      toast.error('No podés desactivarte a vos mismo');
      return;
    }
    try {
      await setStaffActive(u.id, !u.is_active);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const onChangeRole = async (u, newRole) => {
    if (u.username === meUsername && newRole !== 'admin') {
      toast.error('No podés sacarte tu propio rol de admin');
      return;
    }
    try {
      await updateStaffRole(u.id, newRole);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const onResetPw = async (u) => {
    const newPw = await dialog.prompt({
      title: 'Nueva contraseña',
      message: `Para ${u.full_name} (@${u.username})`,
      placeholder: 'mínimo 4 caracteres',
      minLength: 4,
      confirmLabel: 'Resetear',
    });
    if (!newPw) return;
    try {
      await resetStaffPassword(u.username, newPw);
      toast.success(`Contraseña de ${u.username} reseteada`);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 className="s-h2" style={{ margin: 0 }}>Usuarios del staff</h2>
        <button className="btn-primary" style={{ width: 'auto', padding: '8px 14px' }}
                onClick={() => setShowForm(true)}>
          + Nuevo
        </button>
      </div>

      <p className="s-sub" style={{ marginTop: 0, marginBottom: 16 }}>
        Cada usuario tiene un rol (admin, mesero o cocina). El admin ve todo pero no toma pedidos.
      </p>

      {loading ? (
        <div className="s-empty">Cargando…</div>
      ) : users.length === 0 ? (
        <div className="s-empty">Sin usuarios todavía</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {users.map((u) => (
            <article key={u.id} className="prod-card" style={{
              opacity: u.is_active ? 1 : 0.6,
              display: 'flex', alignItems: 'center', gap: 14,
              padding: 14, flexWrap: 'wrap',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 999,
                background: 'var(--s-accent-bg)', color: 'var(--s-accent)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 18,
              }}>{u.full_name.charAt(0).toUpperCase()}</div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <strong style={{ fontSize: 15.5 }}>{u.full_name}</strong>
                <div style={{ fontSize: 13, color: 'var(--s-muted)' }}>
                  @{u.username}{u.username === meUsername && ' · vos'}
                </div>
              </div>

              <select
                value={u.role}
                onChange={(e) => onChangeRole(u, e.target.value)}
                style={{
                  padding: '6px 10px', borderRadius: 8, border: '1px solid var(--s-line)',
                  background: '#fff', fontSize: 13,
                }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>

              <button onClick={() => onResetPw(u)} className="btn-ghost"
                      style={{ padding: '6px 12px', fontSize: 12.5 }}>
                Reset pw
              </button>

              <button onClick={() => onToggleActive(u)}
                      className={u.is_active ? 'btn-ghost' : 'btn-primary'}
                      style={{ width: 'auto', padding: '6px 12px', fontSize: 12.5 }}>
                {u.is_active ? 'Desactivar' : 'Activar'}
              </button>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <NewUserModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function NewUserModal({ onClose, onSaved }) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('mesero');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[a-z0-9_]+$/.test(username)) {
      toast.error('Usuario solo puede tener minúsculas, dígitos y _'); return;
    }
    if (!fullName.trim()) { toast.error('Falta el nombre'); return; }
    if (password.length < 4) { toast.error('Contraseña muy corta'); return; }
    try {
      setBusy(true);
      await createStaffUser({ username, fullName, role, password });
      toast.success(`Usuario ${username} creado`);
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="s-modal-scrim" onClick={() => !busy && onClose()}>
      <form className="s-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="s-modal-head">
          <h3>Nuevo usuario</h3>
          <button type="button" className="s-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="s-modal-body">
          <div className="field">
            <label>Usuario</label>
            <input
              type="text" autoCapitalize="none" autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="ej. juan"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Nombre completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="ej. Juan Pérez"
            />
          </div>
          <div className="field">
            <label>Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="mesero">Mesero</option>
              <option value="cocina">Cocina</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <label>Contraseña inicial</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 4 caracteres"
            />
            <small style={{ color: 'var(--s-muted)', fontSize: 12 }}>
              El usuario podrá cambiarla después.
            </small>
          </div>
        </div>
        <div className="s-modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={busy}
                  style={{ width: 'auto', padding: '8px 16px' }}>
            {busy ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  );
}
