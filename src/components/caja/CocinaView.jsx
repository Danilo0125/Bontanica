// CocinaView.jsx — cola de tandas pendientes con realtime + timer color-coded.
// Beep al llegar tanda nueva + confirmación al marcar Listo (anti-toque accidental).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOpenOrders } from '../../lib/useOrders.js';
import { useTables } from '../../lib/useTables.js';
import { markBatchReady } from '../../lib/orderApi.js';
import { formatTime, minutesSince, money } from '../../lib/format.js';

const NAME_MAP = { ochito: 'Ochito', nath: 'Nath' };
const BEEP_KEY = 'botanica_cocina_audio_on';

// Heartbeat para refrescar los timers cada 30s — sin re-fetch a DB.
function useTick(ms = 30000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
}

function urgencyLevel(mins) {
  if (mins >= 10) return 'crit';
  if (mins >= 5) return 'warn';
  return 'ok';
}

function buildBatches(orders, tablesById) {
  const out = [];
  for (const o of orders) {
    const batches = new Map();
    for (const it of o.items ?? []) {
      if (!batches.has(it.batch_id)) {
        batches.set(it.batch_id, {
          id: it.batch_id, items: [], sent_at: it.sent_at,
          status: it.status, server_id: it.server_id,
          order_id: o.id, table_id: o.table_id,
        });
      }
      const b = batches.get(it.batch_id);
      b.items.push(it);
      if (it.status === 'pending') b.status = 'pending';
      else if (it.status === 'ready' && b.status !== 'pending') b.status = 'ready';
    }
    for (const b of batches.values()) {
      out.push({ ...b, table: tablesById.get(b.table_id) });
    }
  }
  out.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
  return out;
}

// Beep simple con Web Audio API — sin necesidad de archivo de audio.
// Tono de campanita: dos notas cortas en cascada.
function playBeep(audioCtx) {
  try {
    const ctx = audioCtx ?? new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const tones = [880, 660]; // A5, E5 (descendente, agradable)
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.14);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.4);
    });
  } catch { /* navegador sin Web Audio o autoplay bloqueado */ }
}

export function CocinaView() {
  const { orders, loading, error } = useOpenOrders('cocina-orders');
  const { tables } = useTables();
  const [busy, setBusy] = useState({}); // {batchId: true}
  const [confirmId, setConfirmId] = useState(null); // batchId pendiente de confirmar
  const [audioOn, setAudioOn] = useState(() => {
    try { return localStorage.getItem(BEEP_KEY) !== 'off'; } catch { return true; }
  });
  const audioCtxRef = useRef(null);
  const seenBatchesRef = useRef(null);
  useTick(30000);

  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const allBatches = useMemo(() => buildBatches(orders, tablesById), [orders, tablesById]);
  const pending = allBatches.filter((b) => b.status === 'pending');
  const ready = allBatches.filter((b) => b.status === 'ready').slice(-6);

  // Detección de batches nuevos para disparar beep.
  useEffect(() => {
    if (loading) return;
    const ids = new Set(pending.map((b) => b.id));
    // primer render: solo memorizar, no beep
    if (seenBatchesRef.current === null) {
      seenBatchesRef.current = ids;
      return;
    }
    const prev = seenBatchesRef.current;
    const newOnes = [...ids].filter((id) => !prev.has(id));
    if (newOnes.length > 0 && audioOn) {
      playBeep(audioCtxRef.current);
    }
    seenBatchesRef.current = ids;
  }, [pending, loading, audioOn]);

  const toggleAudio = () => {
    setAudioOn((v) => {
      const next = !v;
      try { localStorage.setItem(BEEP_KEY, next ? 'on' : 'off'); } catch {}
      if (next) {
        // Inicializar AudioContext con interacción del usuario (requerido por autoplay policy)
        try {
          audioCtxRef.current = audioCtxRef.current ?? new (window.AudioContext || window.webkitAudioContext)();
          if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
          playBeep(audioCtxRef.current); // beep de confirmación
        } catch {}
      }
      return next;
    });
  };

  const confirmReady = async () => {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    setBusy((b) => ({ ...b, [id]: true }));
    try { await markBatchReady(id); }
    finally { setBusy((b) => { const n = { ...b }; delete n[id]; return n; }); }
  };

  if (error) {
    return <div className="caja-empty"><p>Error cargando la cola.</p><pre className="caja-error">{error.message}</pre></div>;
  }

  if (loading) {
    return <div className="caja-empty">Cargando cola…</div>;
  }

  const confirmBatch = confirmId ? pending.find((b) => b.id === confirmId) : null;

  return (
    <div className="cocina-view">
      <h2 className="caja-h2">
        Cola de cocina <span className="cocina-count">{pending.length}</span>
        <button className="audio-toggle" onClick={toggleAudio}
                aria-label={audioOn ? 'Silenciar avisos' : 'Activar avisos sonoros'}
                title={audioOn ? 'Sonido activo · tocá para silenciar' : 'Silenciado · tocá para activar'}>
          {audioOn ? '🔔' : '🔕'}
        </button>
      </h2>

      {pending.length === 0 && (
        <div className="cocina-empty">
          <span aria-hidden="true">🌿</span>
          <p>Sin tandas pendientes. Todo al día.</p>
        </div>
      )}

      <div className="cocina-grid">
        {pending.map((b) => {
          const mins = minutesSince(b.sent_at);
          const level = urgencyLevel(mins);
          return (
            <article key={b.id} className={`cocina-card cocina-card--${level}`}>
              <header className="cocina-card-head">
                <strong>{b.table?.name ?? `Mesa ${b.table_id}`}</strong>
                <span className={`cocina-timer cocina-timer--${level}`}>
                  <span className="cocina-timer-dot" />
                  {mins === 0 ? 'recién' : `${mins} min`}
                </span>
              </header>
              <p className="cocina-card-server">
                <span className="cocina-card-by">por</span> {NAME_MAP[b.server_id] ?? b.server_id}
                <span className="cocina-card-sep">·</span>
                <span className="cocina-card-time">{formatTime(b.sent_at)}</span>
              </p>
              <ul className="cocina-card-items">
                {b.items.map((it) => (
                  <li key={it.id}>
                    <span className="qty">{it.qty}×</span>
                    <span>{it.product_name_snapshot}</span>
                  </li>
                ))}
              </ul>
              <button
                className="btn-gold btn-gold--block"
                disabled={!!busy[b.id]}
                onClick={() => setConfirmId(b.id)}>
                {busy[b.id] ? 'Marcando…' : '✓ Listo'}
              </button>
            </article>
          );
        })}
      </div>

      {ready.length > 0 && (
        <details className="cocina-recent">
          <summary>Recientes ({ready.length})</summary>
          <ul>
            {ready.map((b) => (
              <li key={b.id}>
                <strong>{b.table?.name}</strong> · {b.items.length} ítems · {formatTime(b.sent_at)} ·
                <span className="cocina-recent-tot"> {money(b.items.reduce((s, it) => s + Number(it.unit_price_snapshot) * it.qty, 0))} Bs</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {confirmBatch && (
        <div className="sheet-scrim" onClick={() => setConfirmId(null)}>
          <div className="pay-sheet confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <h3 className="sheet-title">¿Marcar como listo?</h3>
            <p className="sheet-sub">
              <strong>{confirmBatch.table?.name}</strong> ·{' '}
              {confirmBatch.items.reduce((s, it) => s + it.qty, 0)} ítems
            </p>
            <ul className="confirm-items">
              {confirmBatch.items.map((it) => (
                <li key={it.id}><span className="qty">{it.qty}×</span> {it.product_name_snapshot}</li>
              ))}
            </ul>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setConfirmId(null)}>Cancelar</button>
              <button className="btn-gold" onClick={confirmReady}>Sí, está listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
