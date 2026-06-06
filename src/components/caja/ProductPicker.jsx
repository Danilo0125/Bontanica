// ProductPicker.jsx — selector de productos agrupados por categoría +
// sección de combos al final. Productos con sabores abren FlavorSheet,
// combos abren ComboSheet. Sin stock — solo is_active.
import { useMemo, useState } from 'react';
import { useProducts } from '../../lib/useProducts.js';
import { useFlavors } from '../../lib/useFlavors.js';
import { useCombos } from '../../lib/useCombos.js';
import { FlavorSheet } from './FlavorSheet.jsx';
import { ComboSheet } from './ComboSheet.jsx';
import { money } from '../../lib/format.js';

// draftKeyOf — clave única para draft cuando hay sabor.
export const draftKeyOf = (productId, flavorId) => `${productId}__${flavorId ?? 'none'}`;

export function ProductPicker({
  productDraft,   // { [productId__flavorId]: { product, flavor, qty, unitPrice } }
  onAddFlavor,    // (product, flavor|null) => void
  onDecFlavor,    // (product, flavor|null) => void
  onAddCombo,     // ({ combo, items }) => void
}) {
  const { products, categories, loading: pLoading, error: pError } = useProducts();
  const { byProduct: flavorsByProduct, loading: fLoading } = useFlavors();
  const { combos, loading: cLoading } = useCombos();

  const [flavorSheetFor, setFlavorSheetFor] = useState(null);
  const [comboSheetFor, setComboSheetFor] = useState(null);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const loading = pLoading || fLoading || cLoading;
  if (loading) return <div className="picker picker-skel" aria-hidden="true" />;
  if (pError) return <p className="caja-error">No se pudo cargar la carta: {pError.message}</p>;

  // Qty agregada de un producto (sumando todos sus sabores en el draft).
  const totalQtyOfProduct = (productId) => {
    const flavors = flavorsByProduct.get(productId) ?? [];
    if (flavors.length === 0) {
      return productDraft[draftKeyOf(productId, null)]?.qty ?? 0;
    }
    return flavors.reduce((s, f) => s + (productDraft[draftKeyOf(productId, f.id)]?.qty ?? 0), 0);
  };
  // Qty por flavor (para la sheet).
  const qtyByFlavorForProduct = (productId) => {
    const flavors = flavorsByProduct.get(productId) ?? [];
    const out = {};
    for (const f of flavors) out[f.id] = productDraft[draftKeyOf(productId, f.id)]?.qty ?? 0;
    return out;
  };

  const onProductClick = (product) => {
    const flavors = flavorsByProduct.get(product.id) ?? [];
    if (flavors.length === 0) {
      // Sin sabores: agrega directo.
      onAddFlavor(product, null);
    } else {
      setFlavorSheetFor(product);
    }
  };

  return (
    <div className="picker">
      {categories.map((cat) => (
        <div className="pick-cat" key={cat.id}>
          <span className="pick-cat-name">{cat.name}</span>
          <div className="pick-items">
            {cat.items.map((it) => {
              const qty = totalQtyOfProduct(it.id);
              const flavors = flavorsByProduct.get(it.id) ?? [];
              const hasFlavors = flavors.length > 0;
              return (
                <div key={it.id} className="pick-row">
                  <button
                    className="pick-btn"
                    onClick={() => onProductClick(it)}
                  >
                    <span className="pick-name">
                      {it.name}
                      {hasFlavors && (
                        <span style={{
                          fontSize: 11, color: 'var(--s-muted)', marginLeft: 6,
                          padding: '1px 6px', borderRadius: 999, background: '#fafaf9',
                          border: '1px solid var(--s-line)', fontWeight: 500,
                        }}>{flavors.length} sabor{flavors.length === 1 ? '' : 'es'}</span>
                      )}
                    </span>
                    <span className="pick-price">{money(it.price)} Bs</span>
                    {qty > 0 && <span className="pick-badge">{qty}</span>}
                  </button>
                  {qty > 0 && !hasFlavors && (
                    <button
                      className="pick-dec"
                      onClick={() => onDecFlavor(it, null)}
                      aria-label={`Quitar ${it.name}`}
                    >−</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Sección Combos al final */}
      {combos.length > 0 && (
        <div className="pick-cat">
          <span className="pick-cat-name">Combos · ahorro</span>
          <div className="pick-items">
            {combos.map((c) => (
              <div key={c.id} className="pick-row">
                <button
                  className="pick-btn"
                  onClick={() => setComboSheetFor(c)}
                  style={{ background: 'linear-gradient(180deg, var(--s-accent-bg), #fff 70%)' }}
                >
                  <span className="pick-name">
                    {c.name}
                    {c.description && (
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--s-muted)', marginTop: 2, fontWeight: 400 }}>
                        {c.description}
                      </span>
                    )}
                  </span>
                  <span className="pick-price" style={{ color: 'var(--s-accent)', fontWeight: 700 }}>
                    {money(c.price)} Bs
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {flavorSheetFor && (
        <FlavorSheet
          product={flavorSheetFor}
          flavors={flavorsByProduct.get(flavorSheetFor.id) ?? []}
          qtyByFlavorId={qtyByFlavorForProduct(flavorSheetFor.id)}
          onAdd={(f) => onAddFlavor(flavorSheetFor, f)}
          onDec={(f) => onDecFlavor(flavorSheetFor, f)}
          onClose={() => setFlavorSheetFor(null)}
        />
      )}

      {comboSheetFor && (
        <ComboSheet
          combo={comboSheetFor}
          productsById={productsById}
          flavorsByProduct={flavorsByProduct}
          onConfirm={(payload) => { onAddCombo(payload); setComboSheetFor(null); }}
          onClose={() => setComboSheetFor(null)}
        />
      )}
    </div>
  );
}
