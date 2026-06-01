// MeseroTableDetail.jsx — vista de una mesa con cobro pre-pago por tanda.
//
// Flujo:
//   1. Draft local (no DB todavía)
//   2. "Enviar a cocina" → abre PaymentSheet → confirmar cobro → crea batch (paid) + items (pending)
//   3. Cocina marca items → batch lo ve como ready → mesero recibe toast + sonido
//   4. Mesero toca "Marcar entregado" → batch.status='delivered'
//   5. Cuando ningún batch queda en paid (todos delivered/cancelled) → mesa auto-cierra
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTables } from '../../lib/useTables.js';
import { useOpenOrders } from '../../lib/useOrders.js';
import {
  getOrCreateOpenOrder, sendBatchPaid, markBatchDelivered,
  cancelBatch, cancelOrder, closeOrder,
} from '../../lib/orderApi.js';
import { getSession } from '../../lib/cajaSession.js';
import { money, formatTime, minutesSince } from '../../lib/format.js';
import { playBeep } from '../../lib/audio.js';
import { ProductPicker } from './ProductPicker.jsx';
import { PaymentSheet } from './PaymentSheet.jsx';
import { useToast } from './Toasts.jsx';

const draftKey = (tableId) => `botanica_draft_mesa_${tableId}`;
function loadDraft(tableId) {
  try {
    const raw = localStorage.getItem(draftKey(tableId));
    return raw ? JSON.parse(raw) || {} : {};
  } catch { return {}; }
}
function saveDraft(tableId, draft) {
  try {
    if (!draft || Object.keys(draft).length === 0) localStorage.removeItem(draftKey(tableId));
    else localStorage.setItem(draftKey(tableId), JSON.stringify(draft));
  } catch {}
}

const BATCH_STATUS_LABEL = {
  paid: { pill: '💰 Pagado · cocinando', cls: 'paid' },
  ready: { pill: '✓ Listo para entregar', cls: 'ready' },
  delivered: { pill: '🍽 Entregado', cls: 'delivered' },
  cancelled: { pill: '× Cancelado', cls: 'cancelled' },
};

// El status visible del batch: si todos sus items están ready → ready.
// Si batch.delivered_at, override.
function effectiveBatchStatus(batch, items) {
  if (batch.status === 'delivered') return 'delivered';
  if (batch.status === 'cancelled') return 'cancelled';
  // batch.status === 'paid' → mirar items
  if (!items.length) return 'paid';
  const allReady = items.every((it) => it.status === 'ready' || it.status === 'cancelled');
  return allReady ? 'ready' : 'paid';
}

export function MeseroTableDetail() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const session = getSession();
  const toast = useToast();
  const { tables } = useTables();
  const { orders, refresh } = useOpenOrders(`mesero-table-${tableId}`);

  const table = tables.find((t) => String(t.id) === String(tableId));
  const order = useMemo(
    () => orders.find((o) => String(o.table_id) === String(tableId)) ?? null,
    [orders, tableId]
  );

  const [orderId, setOrderId] = useState(order?.id ?? null);
  const [opening, setOpening] = useState(false);
  const [draft, setDraft] = useState(() => loadDraft(tableId));
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => { saveDraft(tableId, draft); }, [tableId, draft]);

  // Asegura una orden abierta apenas entramos.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.server || !tableId) return;
      try {
        setOpening(true);
        const o = await getOrCreateOpenOrder(Number(tableId), session.server);
        if (!cancelled) { setOrderId(o.id); refresh(); }
      } catch (e) {
        if (!cancelled) { setError(e.message ?? String(e)); toast.error('No pude abrir la mesa'); }
      } finally { if (!cancelled) setOpening(false); }
    })();
    return () => { cancelled = true; };
  }, [tableId, session?.server, refresh, toast]);

  // Construir batches con sus items.
  const batches = useMemo(() => {
    if (!order) return [];
    const itemsByBatch = new Map();
    for (const it of order.items ?? []) {
      if (!itemsByBatch.has(it.batch_id)) itemsByBatch.set(it.batch_id, []);
      itemsByBatch.get(it.batch_id).push(it);
    }
    const list = (order.batches ?? []).map((b) => {
      const items = itemsByBatch.get(b.id) ?? [];
      return { ...b, items, effective: effectiveBatchStatus(b, items) };
    });
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return list;
  }, [order]);

  // Detección de batches que pasaron a "ready" para alertar al mesero dueño.
  const prevReadyRef = useRef(new Set());
  const seededRef = useRef(false);
  useEffect(() => {
    const myReadyBatchIds = new Set(
      batches.filter((b) => b.effective === 'ready' && b.server_id === session?.server).map((b) => b.id)
    );
    if (!seededRef.current) {
      // primer render: no notificar lo que ya estaba ready
      seededRef.current = true;
      prevReadyRef.current = myReadyBatchIds;
      return;
    }
    const newReady = [...myReadyBatchIds].filter((id) => !prevReadyRef.current.has(id));
    if (newReady.length > 0) {
      playBeep('delivered');
      newReady.forEach(() => {
        toast.ready(`Mesa ${tableId} · tanda lista para entregar`, {
          icon: '🍽️',
          title: 'Pedido listo',
        });
      });
    }
    prevReadyRef.current = myReadyBatchIds;
  }, [batches, session?.server, tableId, toast]);

  // ── Draft helpers ─────────────────────────────────────────────────
  const draftItems = Object.values(draft);
  const draftTotal = draftItems.reduce((s, { product, qty }) => s + Number(product.price) * qty, 0);
  const draftCount = draftItems.reduce((s, it) => s + it.qty, 0);

  const addToDraft = useCallback((product) => {
    setDraft((d) => ({ ...d, [product.id]: { product, qty: (d[product.id]?.qty ?? 0) + 1 } }));
  }, []);
  const decFromDraft = useCallback((product) => {
    setDraft((d) => {
      const cur = d[product.id]?.qty ?? 0;
      if (cur <= 1) { const n = { ...d }; delete n[product.id]; return n; }
      return { ...d, [product.id]: { product, qty: cur - 1 } };
    });
  }, []);

  // ── Acciones ───────────────────────────────────────────────────────
  const onConfirmPayment = async ({ method, received_amount }) => {
    if (!orderId || !draftItems.length) return;
    try {
      setSubmitting(true);
      setError(null);
      await sendBatchPaid({
        orderId,
        items: draftItems,
        serverId: session.server,
        payment: { method, received_amount },
      });
      setDraft({});
      saveDraft(tableId, {});
      setPaySheetOpen(false);
      toast.success(`Tanda enviada a cocina · ${money(draftTotal)} Bs cobrados`, { icon: '✓' });
      refresh();
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(`Error al enviar: ${e.message ?? e}`);
    } finally { setSubmitting(false); }
  };

  const onMarkDelivered = async (batch) => {
    try {
      await markBatchDelivered(batch.id);
      toast.success('Entregado', { icon: '🍽', duration: 2500 });
      refresh();
      // Si era el último batch activo, auto-cerrar la mesa.
      const remaining = batches.filter(
        (b) => b.id !== batch.id && b.status !== 'delivered' && b.status !== 'cancelled'
      );
      if (remaining.length === 0 && orderId) {
        await closeOrder(orderId);
        toast.info(`${table?.name ?? `Mesa ${tableId}`} cerrada`);
        navigate('/caja/mesero', { replace: true });
      }
    } catch (e) {
      toast.error(`No se pudo marcar entregado: ${e.message ?? e}`);
    }
  };

  const onCancelBatch = async (batch) => {
    if (!confirm(`¿Cancelar esta tanda? (${batch.items.length} items, ${money(batch.total)} Bs)`)) return;
    try {
      await cancelBatch(batch.id);
      toast.info('Tanda cancelada');
      refresh();
    } catch (e) {
      toast.error(`Error: ${e.message ?? e}`);
    }
  };

  const doCancelOrder = async () => {
    if (!orderId) return;
    try {
      await cancelOrder(orderId);
      saveDraft(tableId, {});
      toast.info(`${table?.name ?? `Mesa ${tableId}`} cancelada`);
      navigate('/caja/mesero', { replace: true });
    } catch (e) { toast.error(`Error: ${e.message ?? e}`); setConfirmCancel(false); }
  };

  if (!session) return null;
  if (opening && !orderId) {
    return <div className="caja-empty">Abriendo cuenta de {table?.name ?? `mesa ${tableId}`}…</div>;
  }

  const sentItemsCount = (order?.items ?? []).filter((it) => it.status !== 'cancelled').length;
  const accumulatedTotal = batches
    .filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + Number(b.total), 0);

  const scrollToPicker = () => {
    document.querySelector('.picker-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mesa-detail">
      <header className="mesa-detail-head">
        <button className="cobro-back" onClick={() => navigate('/caja/mesero')} aria-label="Volver">←</button>
        <div className="mesa-detail-title">
          <strong>{table?.name ?? `Mesa ${tableId}`}</strong>
          <span>{sentItemsCount} ítems · {money(accumulatedTotal)} Bs cobrados</span>
        </div>
        {orderId && (
          <button className="mesa-detail-cancel" onClick={() => setConfirmCancel(true)}
                  aria-label="Cancelar mesa completa" title="Cancelar mesa completa">✕</button>
        )}
      </header>

      {batches.length > 0 && (
        <section className="batches">
          <h3 className="caja-h3">Tandas</h3>
          {batches.map((b) => {
            const eff = b.effective;
            const meta = BATCH_STATUS_LABEL[eff] ?? BATCH_STATUS_LABEL.paid;
            const mine = b.server_id === session.server;
            return (
              <div key={b.id} className={`batch batch-${meta.cls} ${mine && eff === 'ready' ? 'batch--mine-ready' : ''}`}>
                <div className="batch-head">
                  <span className="batch-time">
                    {formatTime(b.paid_at)} · hace {minutesSince(b.paid_at)} min · {money(b.total)} Bs · {b.payment_method}
                  </span>
                  <span className={`batch-pill ${meta.cls}`}>{meta.pill}</span>
                </div>
                <ul className="batch-items">
                  {b.items.map((it) => (
                    <li key={it.id} className={`batch-item batch-item--${it.status}`}>
                      <div className="batch-item-main">
                        <span className="batch-item-name">
                          <span className="batch-item-qty">{it.qty}×</span>{it.product_name_snapshot}
                        </span>
                        <span className="batch-item-price">{money(it.unit_price_snapshot * it.qty)} Bs</span>
                      </div>
                    </li>
                  ))}
                </ul>
                {eff === 'ready' && (
                  <button className="btn-gold btn-gold--block batch-deliver"
                          onClick={() => onMarkDelivered(b)}>
                    🍽 Marcar entregado
                  </button>
                )}
                {eff === 'paid' && (
                  <button className="batch-cancel" onClick={() => onCancelBatch(b)}>
                    Cancelar tanda
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      <section className="picker-wrap">
        <h3 className="caja-h3">Agregar a la cuenta</h3>
        <ProductPicker
          draft={Object.fromEntries(draftItems.map(({ product, qty }) => [product.id, qty]))}
          onAdd={addToDraft}
          onDec={decFromDraft}
        />
      </section>

      {draftItems.length > 0 && (
        <section className="draft-bar">
          <div className="draft-info">
            <span>Tanda nueva</span>
            <strong>{money(draftTotal)} <small>Bs</small></strong>
            <small>{draftCount} ítems</small>
          </div>
          <button className="btn-cobrar" disabled={submitting} onClick={() => setPaySheetOpen(true)}>
            Cobrar y enviar
          </button>
        </section>
      )}

      {error && <p className="caja-error">{error}</p>}

      {paySheetOpen && (
        <PaymentSheet
          total={draftTotal}
          onClose={() => !submitting && setPaySheetOpen(false)}
          onConfirm={onConfirmPayment}
          submitting={submitting}
          contextLabel={`${table?.name ?? `Mesa ${tableId}`} · ${draftCount} ítems`}
        />
      )}

      {confirmCancel && (
        <div className="sheet-scrim" onClick={() => setConfirmCancel(false)}>
          <div className="pay-sheet confirm-sheet danger-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <h3 className="sheet-title">¿Cancelar la mesa completa?</h3>
            <p className="sheet-sub">
              <strong>{table?.name}</strong> — se cancelan todas las tandas pendientes.
            </p>
            <p className="confirm-warn">⚠ Esta acción no se puede deshacer.</p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setConfirmCancel(false)}>Volver</button>
              <button className="btn-danger" onClick={doCancelOrder}>Sí, cancelar mesa</button>
            </div>
          </div>
        </div>
      )}

      <button className="fab-add" onClick={scrollToPicker} aria-label="Agregar producto">
        <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}
