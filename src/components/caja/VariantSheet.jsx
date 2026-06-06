// VariantSheet.jsx — bottom-sheet que se abre al tocar un producto con
// múltiples sabores. Muestra cada variante con su stock + controles +/−.
import { useEffect } from 'react';
import { money } from '../../lib/format.js';
import { X, Check } from '../../lib/icons.jsx';

function stockLabel(v) {
  const s = v.stock ?? 0;
  if (s <= 0) return { text: 'Agotado', kind: 'out' };
  if (s <= 3) return { text: `Quedan ${s}`, kind: 'low' };
  return { text: `${s} disp.`, kind: 'ok' };
}

export function VariantSheet({
  product,
  variants,
  qtyByVariantId,
  onAdd,
  onDec,
  onClose,
}) {
  // Lockea scroll del body mientras la sheet está abierta (mobile)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape cierra
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = variants.reduce((s, v) => s + (qtyByVariantId[v.id] ?? 0), 0);

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
        <p className="s-sheet-sub">Elegí el sabor. Cada toque suma una unidad.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {variants.map((v) => {
            const qty = qtyByVariantId[v.id] ?? 0;
            const stock = stockLabel(v);
            const isOut = stock.kind === 'out';
            const remaining = (v.stock ?? 0) - qty;
            const canAdd = !isOut && remaining > 0;
            const extra = Number(v.extra_price ?? 0);
            return (
              <div
                key={v.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  border: '1.5px solid var(--s-line)',
                  borderRadius: 12,
                  background: qty > 0 ? 'var(--s-accent-bg)' : (isOut ? '#fafaf9' : '#fff'),
                  opacity: isOut ? 0.55 : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--s-text)' }}>
                    {v.name}
                    {extra > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--s-accent)', marginLeft: 8 }}>
                        +{money(extra)} Bs
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 12, marginTop: 2,
                    color: stock.kind === 'out' ? 'var(--s-crit)' :
                          stock.kind === 'low' ? '#a16207' : 'var(--s-muted)',
                    fontWeight: stock.kind === 'low' ? 600 : 400,
                  }}>
                    {stock.text}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDec(v)}
                  disabled={qty <= 0}
                  aria-label={`Quitar ${v.name}`}
                  style={{
                    width: 36, height: 36, borderRadius: 999,
                    border: '1px solid var(--s-line)',
                    background: qty > 0 ? '#fff' : 'transparent',
                    color: qty > 0 ? 'var(--s-text)' : 'var(--s-muted)',
                    fontSize: 18, lineHeight: 1, cursor: qty > 0 ? 'pointer' : 'not-allowed',
                  }}
                >−</button>
                <span style={{
                  minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 16,
                  color: 'var(--s-text)',
                }}>
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => onAdd(v)}
                  disabled={!canAdd}
                  aria-label={`Agregar ${v.name}`}
                  style={{
                    width: 36, height: 36, borderRadius: 999, border: 'none',
                    background: canAdd ? 'var(--s-accent)' : 'var(--s-line-2)',
                    color: canAdd ? '#fff' : 'var(--s-muted)',
                    fontSize: 20, lineHeight: 1, cursor: canAdd ? 'pointer' : 'not-allowed',
                  }}
                >+</button>
              </div>
            );
          })}
        </div>

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
