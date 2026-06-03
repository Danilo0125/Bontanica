// Reservations.jsx — reservas como cards verticales agrupadas por día.
import { useEffect, useState } from 'react';
import { listReservations, createReservation, updateReservation, deleteReservation } from '../../../lib/reservationApi.js';
import { useTables } from '../../../lib/useTables.js';
import { useToast } from '../Toasts.jsx';
import { formatTime } from '../../../lib/format.js';
import { getSession } from '../../../lib/cajaSession.js';

const STATUS = {
  confirmed: 'Confirmada',
  seated:    'Sentada',
  cancelled: 'Cancelada',
  'no-show': 'No vino',
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

  const cycleStatus = async (r) => {
    const order = ['confirmed', 'seated', 'cancelled', 'no-show'];
    const next = order[(order.indexOf(r.status) + 1) % order.length];
    try { await updateReservation(r.id, { status: next }); load(); toast.info(`Reserva → ${STATUS[next]}`); }
    catch (e) { toast.error(e.message); }
  };
  const remove = async (r) => {
    if (!confirm(`¿Borrar reserva de ${r.customer_name}?`)) return;
    try { await deleteReservation(r.id); toast.info('Reserva eliminada'); load(); }
    catch (e) { toast.error(e.message); }
  };

  if (loading) return <p className="s-empty">Cargando reservas…</p>;

  const byDay = new Map();
  for (const r of reservations) {
    const k = r.reserved_at.slice(0, 10);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(r);
  }

  return (
    <div>
      <div className="admin-bar">
        <h3>Reservas <span className="count">· {reservations.length}</span></h3>
        <button className="admin-add" onClick={() => setShowForm(true)}>＋ Nueva reserva</button>
      </div>
      <p className="s-sub" style={{ marginBottom: 12 }}>
        Anotá reservas de mesa para anticipar la noche.
      </p>

      {reservations.length === 0
        ? <div className="s-empty"><p>Sin reservas todavía.</p></div>
        : Array.from(byDay.entries()).map(([day, rs]) => (
          <div key={day}>
            <div className="resv-day-head">
              {new Date(day + 'T12:00:00').toLocaleDateString('es-BO', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </div>
            <div className="resv-list">
              {rs.map((r) => (
                <div key={r.id} className="resv-card">
                  <span className="resv-ini">{r.customer_name[0]?.toUpperCase() ?? '?'}</span>
                  <div className="resv-main">
                    <b>
                      {r.customer_name}
                      <span className="resv-people"> · {r.party_size} pers.</span>
                    </b>
                    <span>
                      {formatTime(r.reserved_at)} · Mesa {r.table_id}
                      {r.customer_phone && ` · ${r.customer_phone}`}
                      {r.notes && ` · ${r.notes}`}
                    </span>
                  </div>
                  <button className={`resv-status ${r.status}`} onClick={() => cycleStatus(r)}
                          title="Cambiar estado">
                    {STATUS[r.status] ?? r.status}
                  </button>
                  <button className="icon-del" onClick={() => remove(r)} aria-label="Borrar">🗑</button>
                </div>
              ))}
            </div>
          </div>
        ))}

      {showForm && (
        <NewReservationModal tables={tables}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
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
    <div className="s-modal-scrim" onClick={() => !busy && onClose()}>
      <form className="s-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="s-modal-head">
          <h3>Nueva reserva</h3>
          <button type="button" className="s-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="s-modal-body">
          <div className="field">
            <label>Nombre del cliente</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Teléfono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="opcional" />
          </div>
          <div className="field">
            <label>Mesa</label>
            <select value={tableId} onChange={(e) => setTableId(Number(e.target.value))}>
              {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Personas</label>
            <input type="number" min="1" max="20" value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={date} min={todayISO()} max={todayPlusDays(60)} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Hora</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="field">
            <label>Duración (min)</label>
            <input type="number" min="30" step="15" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Notas</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcional · alergias, ocasión, etc." />
          </div>
        </div>
        <div className="s-modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn-cobrar" disabled={busy}>
            {busy ? 'Creando…' : 'Crear reserva'}
          </button>
        </div>
      </form>
    </div>
  );
}
