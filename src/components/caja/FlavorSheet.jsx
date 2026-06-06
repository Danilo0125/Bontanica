// FlavorSheet.jsx — bottom-sheet con los sabores compartidos de un producto.
// Sin stock (el toggle del sabor en admin filtra si aparece o no).
import { useEffect } from 'react';
import { money } from '../../lib/format.js';
import { Check } from '../../lib/icons.jsx';

export function FlavorSheet({
  product,
  flavors,
  qtyByFlavorId,
  onAdd,
  onDec,
  onClose,
}) {
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

  const total = flavors.reduce((s, f) => s + (qtyByFlavorId[f.id] ?? 0), 0);

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
                  onClick={() => onAdd(f)}
                  aria-label={`Agregar ${f.name}`}
                  style={{
                    width: 36, height: 36, borderRadius: 999, border: 'none',
                    background: 'var(--s-accent)', color: '#fff',
                    fontSize: 20, lineHeight: 1, cursor: 'pointer',
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
