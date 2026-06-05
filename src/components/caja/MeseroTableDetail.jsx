// MeseroTableDetail.jsx — vista de una mesa con cobro pre-pago por tanda.
// Tema blanco minimal. Toda la lógica existente se mantiene.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTables } from '../../lib/useTables.js';
import { useOpenOrders } from '../../lib/useOrders.js';
import {
  getOrCreateOpenOrder, sendBatchPaid, markBatchDelivered,
  cancelBatch, cancelOrder, closeOrder,
} from '../../lib/orderApi.js';
import { useAuth } from '../../lib/auth.jsx';
import { money, formatTime, minutesSince } from '../../lib/format.js';
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
  paid:      { pill: 'Pagado · cocinando', cls: 'paid' },
  ready:     { pill: '✓ Listo para entregar', cls: 'ready' },
  delivered: { pill: 'Entregado', cls: 'delivered' },
  cancelled: { pill: 'Cancelado', cls: 'cancelled' },
};

function effectiveBatchStatus(batch, items) {
  if (batch.status === 'delivered') return 'delivered';
  if (batch.status === 'cancelled') return 'cancelled';
  if (!items.length) return 'paid';
  const allReady = items.every((it) => it.status === 'ready' || it.status === 'cancelled');
  return allReady ? 'ready' : 'paid';
}

export function MeseroTableDetail() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { username, role } = useAuth();
  const isReadOnly = role === 'admin';
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!username || !tableId) return;
      if (isReadOnly) {
        // Admin solo observa: no abre orden si no existe.
        setOpening(false);
        return;
      }
      try {
        setOpening(true);
        const o = await getOrCreateOpenOrder(Number(tableId), username);
        if (!cancelled) { setOrderId(o.id); refresh(); }
      } catch (e) {
        if (!cancelled) { setError(e.message ?? String(e)); toast.error('No pude abrir la mesa'); }
      } finally { if (!cancelled) setOpening(false); }
    })();
    return () => { cancelled = true; };
  }, [tableId, username, refresh, toast]);

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

  // El aviso global de "tanda lista" vive en CajaLayout — funciona desde
  // cualquier ruta del staff. Acá solo mostramos el estado visual del batch.

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

  const onConfirmPayment = async ({ method, received_amount }) => {
    if (!orderId) {
      toast.error('La mesa aún no está abierta — esperá un momento o salí y volvé a entrar');
      setPaySheetOpen(false);
      return;
    }
    if (!draftItems.length) {
      toast.error('No hay ítems en la tanda nueva');
      setPaySheetOpen(false);
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await sendBatchPaid({
        orderId,
        items: draftItems,
        serverId: username,
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

  if (!username) return null;
  if (opening && !orderId) {
    return <div className="s-empty">Abriendo cuenta de {table?.name ?? `mesa ${tableId}`}…</div>;
  }

  const sentItemsCount = (order?.items ?? []).filter((it) => it.status !== 'cancelled').length;
  const accumulatedTotal = batches
    .filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + Number(b.total), 0);

  return (
    <div className="mesa-detail">
      <header className="mesa-detail-head">
        <button className="detail-back" onClick={() => navigate('/caja/mesero')} aria-label="Volver">←</button>
        <div className="mesa-detail-title">
          <b>{table?.name ?? `Mesa ${tableId}`}</b>
          <span>{sentItemsCount} ítems enviados · {money(accumulatedTotal)} Bs cobrados</span>
        </div>
        {orderId && !isReadOnly && (
          <button className="detail-cancel" onClick={() => setConfirmCancel(true)}
                  aria-label="Cancelar mesa completa" title="Cancelar mesa completa">✕</button>
        )}
      </header>

      {isReadOnly && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10,
          padding: '8px 12px', fontSize: 13, color: '#92400e', marginBottom: 12,
        }}>
          👁 Modo solo lectura — admin no puede tomar pedidos ni entregar
        </div>
      )}

      {batches.length > 0 && (
        <section>
          <h2 className="s-h2">Tandas</h2>
          {batches.map((b) => {
            const eff = b.effective;
            const meta = BATCH_STATUS_LABEL[eff] ?? BATCH_STATUS_LABEL.paid;
            return (
              <div key={b.id} className={`batch batch--${meta.cls}`}>
                <div className="batch-head">
                  <span className="batch-time">
                    {formatTime(b.paid_at)} · {minutesSince(b.paid_at)}m · {money(b.total)} Bs · {b.payment_method === 'qr' ? 'QR' : 'Efectivo'}
                  </span>
                  <span className={`batch-pill ${meta.cls}`}>{meta.pill}</span>
                </div>
                <ul className="batch-items">
                  {b.items.filter((it) => it.status !== 'cancelled').map((it) => (
                    <li key={it.id} className="batch-item">
                      <span>
                        <span className="batch-item-qty">{it.qty}×</span>{it.product_name_snapshot}
                      </span>
                      <span className="batch-item-price">{money(it.unit_price_snapshot * it.qty)} Bs</span>
                    </li>
                  ))}
                </ul>
                {!isReadOnly && eff === 'ready' && (
                  <button className="btn-primary batch-deliver" onClick={() => onMarkDelivered(b)}>
                    🍽 Marcar entregado
                  </button>
                )}
                {!isReadOnly && eff === 'paid' && (
                  <button className="batch-cancel" onClick={() => onCancelBatch(b)}>
                    Cancelar tanda
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      {!isReadOnly && (
        <section>
          <h2 className="s-h2">Agregar a la cuenta</h2>
          <ProductPicker
            draft={Object.fromEntries(draftItems.map(({ product, qty }) => [product.id, qty]))}
            onAdd={addToDraft}
            onDec={decFromDraft}
          />
        </section>
      )}

      {!isReadOnly && draftItems.length > 0 && (
        <div className="draft-bar">
          <div className="draft-info">
            <span>Tanda nueva</span>
            <strong>{money(draftTotal)}<small> Bs</small></strong>
            <small>{draftCount} ítems</small>
          </div>
          <button
            className="btn-cobrar"
            disabled={submitting || paySheetOpen || !orderId}
            onClick={() => { if (!submitting && !paySheetOpen && orderId) setPaySheetOpen(true); }}
          >
            {!orderId ? 'Abriendo mesa…' : 'Cobrar y enviar'}
          </button>
        </div>
      )}

      {error && <p style={{ color: 'var(--s-crit)', fontSize: 13 }}>{error}</p>}

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
        <div className="s-scrim" onClick={() => setConfirmCancel(false)}>
          <div className="s-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="s-grip" />
            <h3 className="s-title">¿Cancelar la mesa?</h3>
            <p className="s-sheet-sub">
              <strong>{table?.name}</strong> — se cancelan todas las tandas pendientes. Esta acción no se puede deshacer.
            </p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setConfirmCancel(false)}>Volver</button>
              <button className="btn-danger" onClick={doCancelOrder}>Sí, cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
