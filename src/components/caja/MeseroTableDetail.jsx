// MeseroTableDetail.jsx — vista de una mesa: batches enviados + draft + cobrar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTables } from '../../lib/useTables.js';
import { useOpenOrders } from '../../lib/useOrders.js';
import { getOrCreateOpenOrder, addItemsToOrder, cancelBatch } from '../../lib/orderApi.js';
import { getSession } from '../../lib/cajaSession.js';
import { money, formatTime, minutesSince } from '../../lib/format.js';
import { ProductPicker } from './ProductPicker.jsx';
import { PaymentSheet } from './PaymentSheet.jsx';

export function MeseroTableDetail() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const session = getSession();
  const { tables } = useTables();
  const { orders, refresh } = useOpenOrders(`mesero-table-${tableId}`);

  const table = tables.find((t) => String(t.id) === String(tableId));
  const order = useMemo(
    () => orders.find((o) => String(o.table_id) === String(tableId)) ?? null,
    [orders, tableId]
  );

  const [orderId, setOrderId] = useState(order?.id ?? null);
  const [opening, setOpening] = useState(false);
  const [draft, setDraft] = useState({}); // {product_id: {product, qty}}
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [paidToast, setPaidToast] = useState(null);

  // Asegura una orden abierta apenas entramos a la mesa.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session?.server || !tableId) return;
      try {
        setOpening(true);
        const o = await getOrCreateOpenOrder(Number(tableId), session.server);
        if (!cancelled) {
          setOrderId(o.id);
          refresh();
        }
      } catch (e) {
        if (!cancelled) setError(e.message ?? String(e));
      } finally {
        if (!cancelled) setOpening(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tableId, session?.server, refresh]);

  const draftItems = Object.values(draft);
  const draftTotal = draftItems.reduce((s, { product, qty }) => s + Number(product.price) * qty, 0);

  const sentItems = order?.items ?? [];
  const sentTotal = sentItems.reduce(
    (s, it) => s + Number(it.unit_price_snapshot) * it.qty, 0
  );

  // Agrupa items enviados por batch_id para mostrarlos como "tandas".
  const batches = useMemo(() => {
    const map = new Map();
    for (const it of sentItems) {
      if (!map.has(it.batch_id)) {
        map.set(it.batch_id, {
          id: it.batch_id, items: [], sent_at: it.sent_at,
          status: it.status, server_id: it.server_id,
        });
      }
      const b = map.get(it.batch_id);
      b.items.push(it);
      // status del batch = el "menos avanzado" de sus items.
      if (it.status === 'pending') b.status = 'pending';
      else if (it.status === 'ready' && b.status !== 'pending') b.status = 'ready';
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.sent_at) - new Date(b.sent_at)
    );
  }, [sentItems]);

  const addToDraft = useCallback((product) => {
    setDraft((d) => ({
      ...d,
      [product.id]: { product, qty: (d[product.id]?.qty ?? 0) + 1 },
    }));
  }, []);
  const decFromDraft = useCallback((product) => {
    setDraft((d) => {
      const cur = d[product.id]?.qty ?? 0;
      if (cur <= 1) { const next = { ...d }; delete next[product.id]; return next; }
      return { ...d, [product.id]: { product, qty: cur - 1 } };
    });
  }, []);

  const sendBatch = async () => {
    if (!orderId || !draftItems.length) return;
    try {
      setSending(true);
      setError(null);
      await addItemsToOrder(orderId, draftItems, session.server);
      setDraft({});
      refresh();
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  const onPaid = ({ total, method }) => {
    setPayOpen(false);
    setPaidToast({ total, method });
    setTimeout(() => { setPaidToast(null); navigate('/caja/mesero'); }, 1500);
  };

  if (!session) return null;
  if (opening && !orderId) return <div className="caja-empty">Abriendo cuenta de {table?.name ?? `mesa ${tableId}`}…</div>;

  const scrollToPicker = () => {
    document.querySelector('.picker-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mesa-detail">
      <header className="mesa-detail-head">
        <button className="cobro-back" onClick={() => navigate('/caja/mesero')} aria-label="Volver">
          ←
        </button>
        <div className="mesa-detail-title">
          <strong>{table?.name ?? `Mesa ${tableId}`}</strong>
          <span>{sentItems.length} ítems enviados</span>
        </div>
      </header>

      {batches.length > 0 && (
        <section className="batches">
          <h3 className="caja-h3">Enviado a cocina</h3>
          {batches.map((b) => (
            <div key={b.id} className={`batch batch-${b.status}`}>
              <div className="batch-head">
                <span className="batch-time">{formatTime(b.sent_at)} · hace {minutesSince(b.sent_at)} min</span>
                <span className={`batch-pill ${b.status}`}>
                  {b.status === 'pending' ? '⏳ En cocina'
                    : b.status === 'ready'  ? '✓ Listo'
                    : '× Cancelado'}
                </span>
              </div>
              <ul className="batch-items">
                {b.items.map((it) => (
                  <li key={it.id}>
                    <span>{it.qty}× {it.product_name_snapshot}</span>
                    <span>{money(it.unit_price_snapshot * it.qty)} Bs</span>
                  </li>
                ))}
              </ul>
              {b.status === 'pending' && (
                <button className="batch-cancel" onClick={() => cancelBatch(b.id).then(refresh)}>
                  Cancelar tanda
                </button>
              )}
            </div>
          ))}
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
            <small>{draftItems.reduce((s, it) => s + it.qty, 0)} ítems</small>
          </div>
          <button className="btn-cobrar" disabled={sending} onClick={sendBatch}>
            {sending ? 'Enviando…' : 'Enviar a cocina'}
          </button>
        </section>
      )}

      {error && <p className="caja-error">{error}</p>}

      <section className="total-bar">
        <div className="total-info">
          <span>Total acumulado</span>
          <strong>{money(sentTotal)} <small>Bs</small></strong>
        </div>
        <button className="btn-cobrar" disabled={sentTotal === 0} onClick={() => setPayOpen(true)}>
          Cobrar
        </button>
      </section>

      {payOpen && order && (
        <PaymentSheet
          order={order}
          total={sentTotal}
          onClose={() => setPayOpen(false)}
          onPaid={onPaid}
        />
      )}

      {paidToast && (
        <div className="sheet-scrim">
          <div className="pay-sheet success">
            <div className="check-ring">
              <svg viewBox="0 0 52 52" width="64" height="64">
                <circle cx="26" cy="26" r="24" fill="none" stroke="var(--gold)" strokeWidth="2" />
                <path d="M16 27l7 7 13-14" fill="none" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="sheet-title">¡Cobro registrado!</h3>
            <p className="sheet-sub">{table?.name} · {money(paidToast.total)} Bs · {paidToast.method}</p>
          </div>
        </div>
      )}

      <button className="fab-add" onClick={scrollToPicker} aria-label="Agregar producto">
        <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}
