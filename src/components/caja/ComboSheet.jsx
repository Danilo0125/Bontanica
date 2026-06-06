// ComboSheet.jsx — bottom-sheet para configurar un combo antes de agregarlo
// al draft. Por cada combo_item con qty=N, muestra N selectores de sabor
// (filtrado por los sabores activos del producto base).
// El precio del combo se reparte entre los N items al cobrar.
import { useEffect, useMemo, useState } from 'react';
import { money } from '../../lib/format.js';
import { Check } from '../../lib/icons.jsx';

function defaultFlavorFor(productId, flavorsByProduct) {
  const flavors = flavorsByProduct.get(productId) ?? [];
  return flavors[0] ?? null;
}

export function ComboSheet({
  combo,
  productsById,
  flavorsByProduct,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const slots = useMemo(() => {
    const arr = [];
    for (const ci of combo.items ?? []) {
      for (let i = 0; i < ci.qty; i++) {
        arr.push({ index: arr.length, productId: ci.product_id });
      }
    }
    return arr;
  }, [combo]);

  // Estado: para cada slot, qué flavor_id (si el producto tiene sabores).
  const [selections, setSelections] = useState(() => {
    const init = {};
    for (const s of slots) {
      const flavors = flavorsByProduct.get(s.productId) ?? [];
      if (flavors.length > 0) {
        init[s.index] = defaultFlavorFor(s.productId, flavorsByProduct)?.id ?? null;
      } else {
        init[s.index] = null; // producto sin sabores
      }
    }
    return init;
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Validación: cada slot que tiene sabores debe tener uno elegido.
  const allChosen = slots.every((s) => {
    const flavors = flavorsByProduct.get(s.productId) ?? [];
    return flavors.length === 0 || selections[s.index];
  });
  const totalSlots = slots.length;

  // Reparto del precio del combo entre los slots (igual + remainder al último).
  const perSlot = useMemo(() => {
    const base = Math.floor((Number(combo.price) * 100) / totalSlots) / 100;
    const totalBase = Number((base * totalSlots).toFixed(2));
    const remainder = Number((Number(combo.price) - totalBase).toFixed(2));
    return slots.map((_, i) => i === totalSlots - 1 ? Number((base + remainder).toFixed(2)) : base);
  }, [combo.price, totalSlots, slots]);

  const handleConfirm = () => {
    if (!allChosen) return;
    const items = slots.map((s, i) => {
      const product = productsById.get(s.productId);
      const flavors = flavorsByProduct.get(s.productId) ?? [];
      const flavor = flavors.find((f) => f.id === selections[s.index]) ?? null;
      return { product, flavor, qty: 1, unitPrice: perSlot[i] };
    });
    onConfirm({ combo, items });
  };

  return (
    <div className="s-scrim" onClick={onClose} role="presentation">
      <div className="s-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="s-grip" />
        <h3 className="s-title" style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span>{combo.name}</span>
          <span style={{ fontSize: 14, color: 'var(--s-accent)', fontWeight: 600 }}>
            {money(Number(combo.price))} Bs
          </span>
        </h3>
        {combo.description && <p className="s-sheet-sub">{combo.description}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {slots.map((s) => {
            const product = productsById.get(s.productId);
            const flavors = flavorsByProduct.get(s.productId) ?? [];
            if (!product) {
              return (
                <div key={s.index} style={{ color: 'var(--s-crit)', fontSize: 13 }}>
                  Producto {s.productId} no encontrado.
                </div>
              );
            }
            return (
              <div key={s.index} style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: '10px 14px',
                border: '1px solid var(--s-line)', borderRadius: 12, background: '#fff',
              }}>
                <div style={{ fontSize: 12, color: 'var(--s-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Slot {s.index + 1} · {product.name}
                </div>
                {flavors.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--s-muted)', padding: '6px 0' }}>
                    Sin sabores — se agrega directo.
                  </div>
                ) : (
                  <select
                    value={selections[s.index] ?? ''}
                    onChange={(e) => setSelections((cur) => ({ ...cur, [s.index]: e.target.value || null }))}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      border: '1px solid var(--s-line)', background: '#fff', fontSize: 14,
                    }}
                  >
                    {flavors.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 16, padding: '12px 14px',
          background: 'var(--s-accent-bg)', borderRadius: 12, fontSize: 13.5,
        }}>
          <span style={{ color: 'var(--s-accent-strong)', fontWeight: 600 }}>
            Total combo
          </span>
          <strong style={{ fontSize: 17, color: 'var(--s-accent)' }}>
            {money(Number(combo.price))} Bs
          </strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!allChosen}
            style={{ width: 'auto', padding: '10px 22px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Check size={18} strokeWidth={2.2} aria-hidden="true" /> Agregar a la cuenta
          </button>
        </div>
      </div>
    </div>
  );
}
