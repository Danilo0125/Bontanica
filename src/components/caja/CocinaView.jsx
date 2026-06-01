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

// Tonos sintetizados con Web Audio — diferentes según el evento.
const TONES = {
  new:    [880, 660],        // tanda nueva — A5→E5 descendente, alegre
  change: [523, 392, 523],   // cambio — C5→G4→C5, llamada atención
  cancel: [440, 330],        // cancelación — A4→E4, grave-grave
};
function playBeep(audioCtx, kind = 'new') {
  try {
    const ctx = audioCtx ?? new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const tones = TONES[kind] ?? TONES.new;
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

// Un item está "editado" si fue modificado > 5s después de su envío original.
function wasEdited(item) {
  if (!item.last_modified_at) return false;
  const sent = new Date(item.sent_at).getTime();
  const mod = new Date(item.last_modified_at).getTime();
  return mod - sent > 5000;
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
  const seenSnapshotRef = useRef(null); // Map<batchId, signature>
  useTick(30000);

  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const allBatches = useMemo(() => buildBatches(orders, tablesById), [orders, tablesById]);
  const pending = allBatches.filter((b) => b.status === 'pending');
  const ready = allBatches.filter((b) => b.status === 'ready').slice(-6);

  // Detección de cambios para beeps contextuales.
  // - Nuevo batch (no estaba en el snapshot anterior) → beep 'new'
  // - Items modificados (qty cambia o nuevo cancelled) → beep 'change' o 'cancel'
  useEffect(() => {
    if (loading) return;
    const sig = (b) => b.items.map((it) => `${it.id}:${it.qty}:${it.status}`).sort().join('|');
    const snapshot = new Map(allBatches.map((b) => [b.id, sig(b)]));
    if (seenSnapshotRef.current === null) {
      seenSnapshotRef.current = snapshot;
      return;
    }
    const prev = seenSnapshotRef.current;
    let newBatch = false, change = false, cancel = false;
    for (const [id, s] of snapshot) {
      if (!prev.has(id)) {
        // Batch nuevo: pending o ya cancelado/ready (puede llegar en ese estado en updates atrasados)
        const b = allBatches.find((x) => x.id === id);
        if (b?.status === 'pending') newBatch = true;
        continue;
      }
      if (prev.get(id) !== s) {
        // Algo cambió en items de un batch existente
        const b = allBatches.find((x) => x.id === id);
        const anyCancelled = b?.items.some((it) => it.status === 'cancelled');
        if (anyCancelled) cancel = true;
        else change = true;
      }
    }
    if (audioOn) {
      // Priorizar: nuevo > cancel > change (un solo beep por tick)
      if (newBatch) playBeep(audioCtxRef.current, 'new');
      else if (cancel) playBeep(audioCtxRef.current, 'cancel');
      else if (change) playBeep(audioCtxRef.current, 'change');
    }
    seenSnapshotRef.current = snapshot;
  }, [allBatches, loading, audioOn]);

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
          const hasChanges = b.items.some((it) => wasEdited(it) || it.status === 'cancelled');
          return (
            <article key={b.id} className={`cocina-card cocina-card--${level} ${hasChanges ? 'cocina-card--changed' : ''}`}>
              <header className="cocina-card-head">
                <strong>{b.table?.name ?? `Mesa ${b.table_id}`}</strong>
                <div className="cocina-card-head-right">
                  {hasChanges && <span className="cocina-changed-pill">✏ Cambió</span>}
                  <span className={`cocina-timer cocina-timer--${level}`}>
                    <span className="cocina-timer-dot" />
                    {mins === 0 ? 'recién' : `${mins} min`}
                  </span>
                </div>
              </header>
              <p className="cocina-card-server">
                <span className="cocina-card-by">por</span> {NAME_MAP[b.server_id] ?? b.server_id}
                <span className="cocina-card-sep">·</span>
                <span className="cocina-card-time">{formatTime(b.sent_at)}</span>
              </p>
              <ul className="cocina-card-items">
                {b.items.map((it) => {
                  const edited = wasEdited(it) && it.status === 'pending';
                  const cancelled = it.status === 'cancelled';
                  return (
                    <li key={it.id} className={`coc-item ${edited ? 'coc-item--edited' : ''} ${cancelled ? 'coc-item--cancelled' : ''}`}>
                      <span className="qty">{it.qty}×</span>
                      <span className="coc-item-name">{it.product_name_snapshot}</span>
                      {edited && <span className="coc-item-flag">✏ editado</span>}
                      {cancelled && <span className="coc-item-flag coc-item-flag--crit">✕ cancelado</span>}
                    </li>
                  );
                })}
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
