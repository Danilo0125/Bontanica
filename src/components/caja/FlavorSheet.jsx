// FlavorSheet.jsx — bottom-sheet con los sabores compartidos de un producto.
// Soporta dos modos:
//   1) Sabor entero: tap un sabor → suma 1 (comportamiento clásico).
//   2) Mitad-mitad: dos selectores, agrega un item con flavor + flavor2.
// Los splits ya creados se listan abajo con su propio +/−.
import { useEffect, useState } from 'react';
import { money } from '../../lib/format.js';
import { Check } from '../../lib/icons.jsx';

export function FlavorSheet({
  product,
  flavors,
  qtyByFlavorId,
  splits = [],
  onAdd,
  onDec,
  onAddSplit,
  onDecSplit,
  onClose,
}) {
  const [splitMode, setSplitMode] = useState(false);
  const [pickA, setPickA] = useState('');
  const [pickB, setPickB] = useState('');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSplit = flavors.length >= 2;
  const totalWhole = flavors.reduce((s, f) => s + (qtyByFlavorId[f.id] ?? 0), 0);
  const totalSplits = splits.reduce((s, sp) => s + sp.qty, 0);
  const total = totalWhole + totalSplits;

  const flavorById = (id) => flavors.find((f) => f.id === id);

  const confirmSplit = () => {
    if (!pickA || !pickB || pickA === pickB) return;
    onAddSplit(flavorById(pickA), flavorById(pickB));
    setPickA('');
    setPickB('');
  };

  return (
    <div className="s-scrim" onClick={onClose} role="presentation">
      <div className="s-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="s-grip" />
        <h3 className="s-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{product.name}</span>
          <span style={{ fontSize: 13, color: 'var(--s-muted)', fontWeight: 500 }}>
            {money(Number(product.price))} Bs c/u
          </span>
        </h3>
        <p className="s-sheet-sub">
          {splitMode
            ? 'Elegí dos sabores para una unidad mitad-mitad.'
            : 'Elegí el sabor. Cada toque suma una unidad.'}
        </p>

        {canSplit && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4, marginBottom: 10 }} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!splitMode}
              onClick={() => setSplitMode(false)}
              style={pillStyle(!splitMode)}
            >
              Sabor entero
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={splitMode}
              onClick={() => setSplitMode(true)}
              style={pillStyle(splitMode)}
            >
              ½ + ½ mitad-mitad
            </button>
          </div>
        )}

        {!splitMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {flavors.map((f) => {
              const qty = qtyByFlavorId[f.id] ?? 0;
              return (
                <div
                  key={f.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    border: '1.5px solid var(--s-line)',
                    borderRadius: 12,
                    background: qty > 0 ? 'var(--s-accent-bg)' : '#fff',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--s-text)' }}>
                    {f.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDec(f)}
                    disabled={qty <= 0}
                    aria-label={`Quitar ${f.name}`}
                    style={roundBtn(qty > 0 ? '#fff' : 'transparent', qty > 0 ? 'var(--s-text)' : 'var(--s-muted)', qty > 0)}
                  >−</button>
                  <span style={qtyStyle}>{qty}</span>
                  <button
                    type="button"
                    onClick={() => onAdd(f)}
                    aria-label={`Agregar ${f.name}`}
                    style={roundBtnPrimary}
                  >+</button>
                </div>
              );
            })}
          </div>
        )}

        {splitMode && canSplit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center',
              padding: '12px 14px', border: '1.5px dashed var(--s-accent-line)', borderRadius: 12,
              background: 'var(--s-accent-bg)',
            }}>
              <select
                value={pickA}
                onChange={(e) => setPickA(e.target.value)}
                style={selectStyle}
                aria-label="Primer sabor"
              >
                <option value="">½ Sabor A…</option>
                {flavors.filter((f) => f.id !== pickB).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <span style={{ fontWeight: 700, color: 'var(--s-accent-strong)' }}>+</span>
              <select
                value={pickB}
                onChange={(e) => setPickB(e.target.value)}
                style={selectStyle}
                aria-label="Segundo sabor"
              >
                <option value="">½ Sabor B…</option>
                {flavors.filter((f) => f.id !== pickA).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={confirmSplit}
              disabled={!pickA || !pickB || pickA === pickB}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              Agregar mitad-mitad ({money(Number(product.price))} Bs)
            </button>

            {splits.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11.5, color: 'var(--s-muted)', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                  En la tanda
                </span>
                {splits.map((sp) => (
                  <div
                    key={sp.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12,
                      background: '#fff', border: '1.5px solid var(--s-accent-line)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--s-text)' }}>
                      <strong style={{ fontWeight: 600 }}>½ {sp.flavor.name}</strong>
                      <span style={{ color: 'var(--s-muted)' }}> / </span>
                      <strong style={{ fontWeight: 600 }}>½ {sp.flavor2.name}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDecSplit(sp.flavor, sp.flavor2)}
                      aria-label="Quitar split"
                      style={roundBtn('#fff', 'var(--s-text)', true)}
                    >−</button>
                    <span style={qtyStyle}>{sp.qty}</span>
                    <button
                      type="button"
                      onClick={() => onAddSplit(sp.flavor, sp.flavor2)}
                      aria-label="Agregar otra split igual"
                      style={roundBtnPrimary}
                    >+</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
            style={{ width: 'auto', padding: '10px 22px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Check size={18} strokeWidth={2.2} aria-hidden="true" /> Listo ({total})
          </button>
        </div>
      </div>
    </div>
  );
}

const pillStyle = (active) => ({
  flex: 1, padding: '8px 10px', borderRadius: 10, fontSize: 13, fontWeight: 600,
  border: active ? '1.5px solid var(--s-accent)' : '1.5px solid var(--s-line)',
  background: active ? 'var(--s-accent-bg)' : '#fff',
  color: active ? 'var(--s-accent-strong)' : 'var(--s-muted)',
  cursor: 'pointer',
});

const roundBtn = (bg, color, enabled) => ({
  width: 36, height: 36, borderRadius: 999, border: '1px solid var(--s-line)',
  background: bg, color, fontSize: 18, lineHeight: 1,
  cursor: enabled ? 'pointer' : 'not-allowed',
});

const roundBtnPrimary = {
  width: 36, height: 36, borderRadius: 999, border: 'none',
  background: 'var(--s-accent)', color: '#fff', fontSize: 20, lineHeight: 1, cursor: 'pointer',
};

const qtyStyle = {
  minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 16, color: 'var(--s-text)',
};

const selectStyle = {
  width: '100%', padding: '10px 8px', borderRadius: 8, border: '1px solid var(--s-line)',
  background: '#fff', fontSize: 13.5, color: 'var(--s-text)', fontWeight: 500,
};
