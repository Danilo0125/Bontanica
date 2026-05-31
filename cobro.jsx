// cobro.jsx — Módulo Caja: comandas por mesa (efectivo / QR)
const { useState: useStateC, useMemo: useMemoC } = React;

const money = (n) => n.toLocaleString("es-BO");

function initialTables() {
  return Array.from({ length: 6 }).map((_, i) => ({ id: i + 1, name: `Mesa ${i + 1}`, items: {}, openedAt: null }));
}

function Cobro({ open, onClose }) {
  const [tables, setTables] = useStateC(initialTables);
  const [activeId, setActiveId] = useStateC(null);
  const [pay, setPay] = useStateC(null); // null | 'choose' | 'efectivo' | 'qr'
  const [received, setReceived] = useStateC("");
  const [done, setDone] = useStateC(null); // {table, total, method}

  const active = tables.find((t) => t.id === activeId);

  const tableTotal = (t) =>
    Object.entries(t.items).reduce((sum, [pid, qty]) => {
      const p = ALL_PRODUCTS.find((x) => x.id === pid);
      return sum + (p ? p.price * qty : 0);
    }, 0);

  const tableCount = (t) => Object.values(t.items).reduce((a, b) => a + b, 0);

  const updateActive = (mut) =>
    setTables((ts) => ts.map((t) => (t.id === activeId ? mut({ ...t, items: { ...t.items } }) : t)));

  const addItem = (pid) =>
    updateActive((t) => {
      t.items[pid] = (t.items[pid] || 0) + 1;
      if (!t.openedAt) t.openedAt = Date.now();
      return t;
    });
  const decItem = (pid) =>
    updateActive((t) => {
      t.items[pid] = Math.max(0, (t.items[pid] || 0) - 1);
      if (t.items[pid] === 0) delete t.items[pid];
      return t;
    });

  const total = active ? tableTotal(active) : 0;
  const change = pay === "efectivo" && received !== "" ? Number(received) - total : null;

  const finishPayment = (method) => {
    setDone({ name: active.name, total, method });
    setTables((ts) => ts.map((t) => (t.id === activeId ? { ...t, items: {}, openedAt: null } : t)));
    setPay(null); setReceived("");
  };

  if (!open) return null;

  return (
    <div className="cobro-overlay" data-screen-label="Caja">
      {/* Header */}
      <div className="cobro-top">
        {active ? (
          <button className="cobro-back" onClick={() => setActiveId(null)} aria-label="Volver">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        ) : <span className="cobro-leaf">🌿</span>}
        <div className="cobro-title">
          <strong>{active ? active.name : "Caja · Comandas"}</strong>
          <span>{active ? `${tableCount(active)} ítems` : "Toca una mesa para abrir su cuenta"}</span>
        </div>
        <button className="cobro-close" onClick={() => { setActiveId(null); onClose(); }} aria-label="Cerrar">✕</button>
      </div>

      {/* Tables grid */}
      {!active && (
        <div className="cobro-body">
          <div className="mesas-grid">
            {tables.map((t) => {
              const tot = tableTotal(t); const occupied = tot > 0;
              return (
                <button key={t.id} className={`mesa-card ${occupied ? "is-occupied" : ""}`} onClick={() => setActiveId(t.id)}>
                  <span className="mesa-status">{occupied ? "Ocupada" : "Libre"}</span>
                  <span className="mesa-name">{t.name}</span>
                  {occupied
                    ? <span className="mesa-total">{money(tot)} <small>Bs</small></span>
                    : <span className="mesa-empty">Abrir cuenta</span>}
                  {occupied && <span className="mesa-count">{tableCount(t)} ítems</span>}
                </button>
              );
            })}
            <button className="mesa-card mesa-add" onClick={() => setTables((ts) => [...ts, { id: Math.max(...ts.map((x) => x.id)) + 1, name: `Mesa ${ts.length + 1}`, items: {}, openedAt: null }])}>
              <span className="plus">＋</span>
              <span>Nueva mesa</span>
            </button>
          </div>
        </div>
      )}

      {/* Comanda */}
      {active && (
        <div className="cobro-body comanda">
          {/* current order */}
          {tableCount(active) > 0 && (
            <div className="order-list">
              <h4 className="order-h">Cuenta actual</h4>
              {Object.entries(active.items).map(([pid, qty]) => {
                const p = ALL_PRODUCTS.find((x) => x.id === pid);
                return (
                  <div className="order-row" key={pid}>
                    <span className="order-name">{p.name}</span>
                    <div className="qty">
                      <button onClick={() => decItem(pid)}>−</button>
                      <span>{qty}</span>
                      <button onClick={() => addItem(pid)}>＋</button>
                    </div>
                    <span className="order-line">{money(p.price * qty)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* product picker */}
          <h4 className="order-h">Agregar producto</h4>
          <div className="picker">
            {CATEGORIES.map((cat) => (
              <div className="pick-cat" key={cat.id}>
                <span className="pick-cat-name">{cat.name}</span>
                <div className="pick-items">
                  {cat.items.map((it) => (
                    <button className="pick-btn" key={it.id} onClick={() => addItem(it.id)}>
                      <span className="pick-name">{it.name}</span>
                      <span className="pick-price">{it.price} Bs</span>
                      {active.items[it.id] > 0 && <span className="pick-badge">{active.items[it.id]}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* total bar */}
          <div className="total-bar">
            <div className="total-info">
              <span>Total</span>
              <strong>{money(total)} <small>Bs</small></strong>
            </div>
            <button className="btn-cobrar" disabled={total === 0} onClick={() => setPay("choose")}>Cobrar</button>
          </div>
        </div>
      )}

      {/* Payment sheet */}
      {pay && (
        <div className="sheet-scrim" onClick={() => { setPay(null); setReceived(""); }}>
          <div className="pay-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            {pay === "choose" && (
              <>
                <h3 className="sheet-title">Cobrar {money(total)} Bs</h3>
                <p className="sheet-sub">{active.name} · selecciona el método de pago</p>
                <div className="pay-methods">
                  <button className="pay-opt" onClick={() => setPay("efectivo")}>
                    <span className="pay-ico">💵</span>
                    <span>Efectivo</span>
                  </button>
                  <button className="pay-opt" onClick={() => setPay("qr")}>
                    <span className="pay-ico">📱</span>
                    <span>QR / Transferencia</span>
                  </button>
                </div>
              </>
            )}
            {pay === "efectivo" && (
              <>
                <h3 className="sheet-title">Efectivo</h3>
                <p className="sheet-sub">Total a cobrar: <strong>{money(total)} Bs</strong></p>
                <label className="field">
                  <span>¿Con cuánto paga?</span>
                  <input type="number" inputMode="numeric" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="0" autoFocus />
                </label>
                {change !== null && received !== "" && (
                  <div className={`vuelto ${change < 0 ? "neg" : ""}`}>
                    {change < 0 ? `Faltan ${money(Math.abs(change))} Bs` : `Vuelto: ${money(change)} Bs`}
                  </div>
                )}
                <div className="quick-cash">
                  {[total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
                    <button key={v} onClick={() => setReceived(String(v))}>{money(v)}</button>
                  ))}
                </div>
                <button className="btn-gold btn-gold--block" disabled={received === "" || Number(received) < total} onClick={() => finishPayment("Efectivo")}>Confirmar cobro</button>
              </>
            )}
            {pay === "qr" && (
              <>
                <h3 className="sheet-title">QR / Transferencia</h3>
                <p className="sheet-sub">Total: <strong>{money(total)} Bs</strong> · {active.name}</p>
                <div className="qr-box">
                  <div className="qr-fake" aria-hidden="true">
                    {Array.from({ length: 144 }).map((_, i) => <span key={i} style={{ opacity: (i * 73 % 10) > 4 ? 1 : 0 }} />)}
                  </div>
                  <p>Escanea para pagar a Botánica</p>
                </div>
                <button className="btn-gold btn-gold--block" onClick={() => finishPayment("QR")}>Marcar como pagado</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Success toast */}
      {done && (
        <div className="sheet-scrim" onClick={() => setDone(null)}>
          <div className="pay-sheet success" onClick={(e) => e.stopPropagation()}>
            <div className="check-ring"><svg viewBox="0 0 52 52" width="64" height="64"><circle cx="26" cy="26" r="24" fill="none" stroke="var(--gold)" strokeWidth="2" /><path d="M16 27l7 7 13-14" fill="none" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <h3 className="sheet-title">¡Cobro registrado!</h3>
            <p className="sheet-sub">{done.name} · {money(done.total)} Bs · {done.method}</p>
            <button className="btn-gold btn-gold--block" onClick={() => setDone(null)}>Listo</button>
          </div>
        </div>
      )}
    </div>
  );
}

window.Cobro = Cobro;
