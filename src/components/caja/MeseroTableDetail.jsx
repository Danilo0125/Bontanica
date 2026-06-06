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
import { ProductPicker, draftKeyOf } from './ProductPicker.jsx';
import { PaymentSheet } from './PaymentSheet.jsx';
import { useToast } from './Toasts.jsx';
import { useDialog } from './Dialog.jsx';
import { markBatchNotificationsRead } from '../../lib/notificationsApi.js';
import { ChevronLeft, X, Eye, UtensilsCrossed, Check } from '../../lib/icons.jsx';

// v2 del draft (con variantes + combos). El prefijo v2 invalida los drafts
// viejos guardados en localStorage de la versión sin variantes.
const draftKey = (tableId) => `botanica_draft_v2_mesa_${tableId}`;
function loadDraft(tableId) {
  try {
    const raw = localStorage.getItem(draftKey(tableId));
    if (!raw) return { products: {}, combos: [] };
    const parsed = JSON.parse(raw) || {};
    return { products: parsed.products ?? {}, combos: parsed.combos ?? [] };
  } catch { return { products: {}, combos: [] }; }
}
function saveDraft(tableId, draft) {
  try {
    const empty = !draft || (Object.keys(draft.products ?? {}).length === 0 && (draft.combos ?? []).length === 0);
    if (empty) localStorage.removeItem(draftKey(tableId));
    else localStorage.setItem(draftKey(tableId), JSON.stringify(draft));
  } catch {}
}

const BATCH_STATUS_LABEL = {
  paid:      { pill: 'Pagado · cocinando',   cls: 'paid' },
  ready:     { pill: 'Listo para entregar',  cls: 'ready' },
  delivered: { pill: 'Entregado',            cls: 'delivered' },
  cancelled: { pill: 'Cancelado',            cls: 'cancelled' },
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
  const dialog = useDialog();
  const { tables } = useTables();
  const { orders, refresh } = useOpenOrders(`mesero-table-${tableId}`);

  const table = tables.find((t) => String(t.id) === String(tableId));
  const order = useMemo(
    () => orders.find((o) => String(o.table_id) === String(tableId)) ?? null,
    [orders, tableId]
  );

  const [orderId, setOrderId] = useState(order?.id ?? null);
  const [opening, setOpening] = useState(false);
  // Draft v2: productos (keyed por product+variant) + combos (lista de bundles).
  const [draft, setDraft] = useState(() => loadDraft(tableId));
  const productDraft = draft.products;
  const comboDraft = draft.combos;
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

  // Items "planos" para enviar a sendBatchPaid: productos directos + items de combos.
  const draftItems = useMemo(() => {
    const items = [];
    for (const entry of Object.values(productDraft)) {
      items.push({
        product: entry.product,
        variant: entry.variant,
        qty: entry.qty,
        unitPrice: entry.unitPrice ?? Number(entry.product.price) + Number(entry.variant?.extra_price ?? 0),
      });
    }
    for (const c of comboDraft) {
      for (const it of c.items) items.push(it);
    }
    return items;
  }, [productDraft, comboDraft]);

  const draftTotal = useMemo(
    () => draftItems.reduce((s, it) => s + Number(it.unitPrice) * it.qty, 0),
    [draftItems]
  );
  const draftCount = useMemo(
    () => draftItems.reduce((s, it) => s + it.qty, 0),
    [draftItems]
  );

  const addVariantToDraft = useCallback((product, variant) => {
    if (!variant) return;
    const key = draftKeyOf(product.id, variant.id);
    setDraft((d) => {
      const cur = d.products[key]?.qty ?? 0;
      const unitPrice = Number(product.price) + Number(variant.extra_price ?? 0);
      return {
        ...d,
        products: { ...d.products, [key]: { product, variant, qty: cur + 1, unitPrice } },
      };
    });
  }, []);
  const decVariantFromDraft = useCallback((product, variant) => {
    const key = draftKeyOf(product.id, variant.id);
    setDraft((d) => {
      const cur = d.products[key]?.qty ?? 0;
      if (cur <= 1) {
        const next = { ...d.products }; delete next[key];
        return { ...d, products: next };
      }
      return {
        ...d,
        products: { ...d.products, [key]: { ...d.products[key], qty: cur - 1 } },
      };
    });
  }, []);
  const addComboToDraft = useCallback(({ combo, items }) => {
    setDraft((d) => ({
      ...d,
      combos: [...d.combos, { combo, items, addedAt: Date.now() }],
    }));
  }, []);
  const removeComboFromDraft = useCallback((addedAt) => {
    setDraft((d) => ({ ...d, combos: d.combos.filter((c) => c.addedAt !== addedAt) }));
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
        items: draftItems.map(({ product, variant, qty, unitPrice }) => ({
          product: { ...product, price: unitPrice }, // unitPrice incluye extra_price y/o split de combo
          variant, qty,
        })),
        serverId: username,
        payment: { method, received_amount },
      });
      setDraft({ products: {}, combos: [] });
      saveDraft(tableId, { products: {}, combos: [] });
      setPaySheetOpen(false);
      toast.success(`Tanda enviada a cocina · ${money(draftTotal)} Bs cobrados`);
      refresh();
    } catch (e) {
      setError(e.message ?? String(e));
      toast.error(`Error al enviar: ${e.message ?? e}`);
    } finally { setSubmitting(false); }
  };

  const onMarkDelivered = async (batch) => {
    try {
      await markBatchDelivered(batch.id);
      // Limpia notifs viejas para este batch (no quieren ver "tanda lista" en la
      // bandeja cuando ya la entregaron).
      markBatchNotificationsRead(username, batch.id);
      toast.success('Entregado', {
        icon: <UtensilsCrossed size={22} strokeWidth={1.7} />,
        duration: 2500,
      });
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
    const n = batch.items.length;
    const itemsTxt = n === 1 ? '1 ítem' : `${n} ítems`;
    const ok = await dialog.confirm({
      title: '¿Cancelar esta tanda?',
      message: `${itemsTxt} · ${money(batch.total)} Bs. Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, cancelar tanda',
      confirmKind: 'danger',
    });
    if (!ok) return;
    try {
      await cancelBatch(batch.id);
      markBatchNotificationsRead(username, batch.id);
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
      saveDraft(tableId, { products: {}, combos: [] });
      setDraft({ products: {}, combos: [] });
      toast.info(`${table?.name ?? `Mesa ${tableId}`} cancelada`);
      navigate('/caja/mesero', { replace: true });
    } catch (e) { toast.error(`Error: ${e.message ?? e}`); setConfirmCancel(false); }
  };

  if (!username) return null;
  if (opening && !orderId) {
    return <div className="s-empty">Abriendo cuenta de {table?.name ?? `mesa ${tableId}`}…</div>;
  }

  const sentItemsCount = (order?.items ?? [])
    .filter((it) => it.status !== 'cancelled')
    .reduce((s, it) => s + it.qty, 0);
  const accumulatedTotal = batches
    .filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + Number(b.total), 0);
  const itemsLabel = sentItemsCount === 1 ? '1 ítem enviado' : `${sentItemsCount} ítems enviados`;

  return (
    <div className="mesa-detail">
      <header className="mesa-detail-head">
        <button className="detail-back" onClick={() => navigate('/caja/mesero')} aria-label="Volver">
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
        <div className="mesa-detail-title">
          <b>{table?.name ?? `Mesa ${tableId}`}</b>
          <span>{itemsLabel} · {money(accumulatedTotal)} Bs cobrados</span>
        </div>
        {orderId && !isReadOnly && (
          <button className="detail-cancel" onClick={() => setConfirmCancel(true)}
                  aria-label="Cancelar mesa completa" title="Cancelar mesa completa">
            <X size={18} strokeWidth={2} />
          </button>
        )}
      </header>

      {isReadOnly && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10,
          padding: '8px 12px', fontSize: 13, color: '#92400e', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Eye size={16} strokeWidth={1.7} aria-hidden="true" />
          Modo solo lectura — admin no puede tomar pedidos ni entregar
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
                  <button
                    className="btn-primary batch-deliver"
                    onClick={() => onMarkDelivered(b)}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <UtensilsCrossed size={18} strokeWidth={1.7} aria-hidden="true" /> Marcar entregado
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
            productDraft={productDraft}
            onAddVariant={addVariantToDraft}
            onDecVariant={decVariantFromDraft}
            onAddCombo={addComboToDraft}
          />
          {comboDraft.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {comboDraft.map((c) => (
                <div key={c.addedAt} style={{
                  background: 'var(--s-accent-bg)', border: '1px solid var(--s-accent-line)',
                  borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 13.5, color: 'var(--s-accent-strong)' }}>
                      {c.combo.name}
                    </strong>
                    <div style={{ fontSize: 12, color: 'var(--s-muted)', marginTop: 2 }}>
                      {c.items.map((it, i) => (
                        <span key={i}>
                          {i > 0 && ' · '}
                          {it.variant?.name ?? it.product.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <strong style={{ fontSize: 14, color: 'var(--s-accent)' }}>
                    {money(Number(c.combo.price))} Bs
                  </strong>
                  <button
                    type="button"
                    onClick={() => removeComboFromDraft(c.addedAt)}
                    aria-label="Quitar combo"
                    style={{
                      width: 28, height: 28, borderRadius: 999, border: '1px solid var(--s-line)',
                      background: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1,
                      color: 'var(--s-muted)',
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
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
