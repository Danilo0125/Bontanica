// Reservations.jsx — gestión de reservas.
import { useEffect, useState } from 'react';
import { listReservations, createReservation, updateReservation, deleteReservation } from '../../../lib/reservationApi.js';
import { useTables } from '../../../lib/useTables.js';
import { useToast } from '../Toasts.jsx';
import { formatTime } from '../../../lib/format.js';
import { getSession } from '../../../lib/cajaSession.js';

const STATUS = {
  confirmed: { label: 'Confirmada', cls: 'admin-pill-ok' },
  seated:    { label: 'Sentada',    cls: 'admin-pill-warn' },
  cancelled: { label: 'Cancelada',  cls: 'admin-pill-crit' },
  'no-show': { label: 'No vino',    cls: 'admin-pill-muted' },
};

function todayISO() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0, 10);
}
function todayPlusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('es-BO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export function Reservations() {
  const { tables } = useTables();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const toast = useToast();

  const load = async () => {
    try {
      const data = await listReservations({
        fromISO: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        toISO: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      });
      setReservations(data);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const setStatus = async (r, status) => {
    try { await updateReservation(r.id, { status }); load(); toast.info(`Reserva → ${STATUS[status]?.label ?? status}`); }
    catch (e) { toast.error(e.message); }
  };
  const remove = async (r) => {
    if (!confirm(`¿Borrar reserva de ${r.customer_name}?`)) return;
    try { await deleteReservation(r.id); toast.info('Reserva eliminada'); load(); }
    catch (e) { toast.error(e.message); }
  };

  if (loading) return <p className="admin-empty">Cargando reservas…</p>;

  // Agrupar por día
  const byDay = new Map();
  for (const r of reservations) {
    const k = r.reserved_at.slice(0, 10);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(r);
  }

  return (
    <>
      <h1 className="admin-h1">Reservas</h1>
      <p className="admin-sub">Anotá reservas de mesa. Aparecen en la grilla del mesero para que sepa antes de abrir la cuenta.</p>

      <div className="admin-actions-bar">
        <span style={{ color: 'var(--a-text-muted)', fontSize: 13 }}>{reservations.length} reserva{reservations.length !== 1 ? 's' : ''} (-1d / +30d)</span>
        <button className="admin-btn admin-btn-primary" onClick={() => setShowForm(true)}>+ Nueva reserva</button>
      </div>

      {reservations.length === 0
        ? <div className="admin-empty"><p>Sin reservas todavía.</p></div>
        : (
          <>
            {Array.from(byDay.entries()).map(([day, rs]) => (
              <div key={day} style={{ marginBottom: 18 }}>
                <h2 className="admin-h2">{new Date(day + 'T12:00:00').toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Hora</th><th>Cliente</th><th>Mesa</th><th>Personas</th><th>Estado</th><th></th></tr></thead>
                    <tbody>
                      {rs.map((r) => (
                        <tr key={r.id}>
                          <td><strong>{formatTime(r.reserved_at)}</strong></td>
                          <td>
                            {r.customer_name}
                            {r.customer_phone && <><br/><small style={{ color: 'var(--a-text-muted)' }}>{r.customer_phone}</small></>}
                            {r.notes && <><br/><small style={{ color: 'var(--a-text-muted)', fontStyle: 'italic' }}>{r.notes}</small></>}
                          </td>
                          <td>Mesa {r.table_id}</td>
                          <td className="admin-cell-num">{r.party_size}</td>
                          <td>
                            <select value={r.status} onChange={(e) => setStatus(r, e.target.value)} className="admin-pill" style={{ padding: '3px 6px' }}>
                              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </td>
                          <td>
                            <button className="admin-btn admin-btn-danger admin-btn-icon" onClick={() => remove(r)}>Borrar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}

      {showForm && (
        <NewReservationModal tables={tables}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }} />
      )}
    </>
  );
}

function NewReservationModal({ tables, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tableId, setTableId] = useState(tables[0]?.id ?? '');
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('20:00');
  const [duration, setDuration] = useState(120);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Falta el nombre'); return; }
    try {
      setBusy(true);
      const reserved_at = new Date(`${date}T${time}:00`).toISOString();
      await createReservation({
        table_id: tableId, customer_name: name.trim(), customer_phone: phone.trim() || null,
        party_size: partySize, reserved_at, duration_minutes: duration,
        notes: notes.trim() || null, created_by: getSession()?.server ?? null,
      });
      toast.success('Reserva creada');
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="admin-modal-scrim" onClick={() => !busy && onClose()}>
      <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="admin-modal-head">
          <h3>Nueva reserva</h3>
          <button type="button" className="admin-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="admin-modal-body admin-form">
          <div className="admin-field">
            <label>Nombre del cliente</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="admin-field">
            <label>Teléfono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="opcional" />
          </div>
          <div className="admin-field">
            <label>Mesa</label>
            <select value={tableId} onChange={(e) => setTableId(Number(e.target.value))}>
              {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="admin-field">
            <label>Personas</label>
            <input type="number" min="1" max="20" value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} />
          </div>
          <div className="admin-field">
            <label>Fecha</label>
            <input type="date" value={date} min={todayISO()} max={todayPlusDays(60)} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Hora</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Duración (min)</label>
            <input type="number" min="30" step="15" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div className="admin-field">
            <label>Notas</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcional · alergias, ocasión, etc." />
          </div>
        </div>
        <div className="admin-modal-foot">
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
            {busy ? 'Creando…' : 'Crear reserva'}
          </button>
        </div>
      </form>
    </div>
  );
}
