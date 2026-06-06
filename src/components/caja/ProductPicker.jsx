// ProductPicker.jsx — selector de productos agrupados por categoría +
// sección de combos al final. Productos con >1 variante abren VariantSheet,
// combos abren ComboSheet.
import { useMemo, useState } from 'react';
import { useProducts } from '../../lib/useProducts.js';
import { useVariants } from '../../lib/useVariants.js';
import { useCombos } from '../../lib/useCombos.js';
import { VariantSheet } from './VariantSheet.jsx';
import { ComboSheet } from './ComboSheet.jsx';
import { money } from '../../lib/format.js';

// productKeyOf — clave única para draft cuando hay variantes.
export const draftKeyOf = (productId, variantId) => `${productId}__${variantId ?? 'none'}`;

function stockBadge(stock) {
  if (stock <= 0) return { text: 'Agotado', color: '#b23636', bg: '#fbe1e1' };
  if (stock <= 3) return { text: `Quedan ${stock}`, color: '#a16207', bg: '#fff4d6' };
  return null;
}

export function ProductPicker({
  productDraft,   // { [productId__variantId]: { product, variant, qty, unitPrice } }
  onAddVariant,   // (product, variant) => void
  onDecVariant,   // (product, variant) => void
  onAddCombo,     // ({ combo, items }) => void
}) {
  const { products, categories, loading: pLoading, error: pError } = useProducts();
  const { byProduct: variantsByProduct, totalStockOf, loading: vLoading } = useVariants();
  const { combos, loading: cLoading } = useCombos();

  const [variantSheetFor, setVariantSheetFor] = useState(null);
  const [comboSheetFor, setComboSheetFor] = useState(null);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const loading = pLoading || vLoading || cLoading;
  if (loading) return <div className="picker picker-skel" aria-hidden="true" />;
  if (pError) return <p className="caja-error">No se pudo cargar la carta: {pError.message}</p>;

  // Qty de un producto sumando todas sus variantes en el draft.
  const totalQtyOfProduct = (productId) => {
    const variants = variantsByProduct.get(productId) ?? [];
    return variants.reduce((s, v) => s + (productDraft[draftKeyOf(productId, v.id)]?.qty ?? 0), 0);
  };
  // Qty por variante (para el sheet).
  const qtyByVariantForProduct = (productId) => {
    const variants = variantsByProduct.get(productId) ?? [];
    const out = {};
    for (const v of variants) out[v.id] = productDraft[draftKeyOf(productId, v.id)]?.qty ?? 0;
    return out;
  };

  const onProductClick = (product) => {
    const variants = (variantsByProduct.get(product.id) ?? []).filter((v) => v.is_active);
    if (variants.length === 0) return; // sin variantes activas, no se puede vender
    if (variants.length === 1) {
      // Variante única: agrega directo sin sheet.
      onAddVariant(product, variants[0]);
    } else {
      setVariantSheetFor(product);
    }
  };

  return (
    <div className="picker">
      {categories.map((cat) => (
        <div className="pick-cat" key={cat.id}>
          <span className="pick-cat-name">{cat.name}</span>
          <div className="pick-items">
            {cat.items.map((it) => {
              const totalStock = totalStockOf(it.id);
              const qty = totalQtyOfProduct(it.id);
              const variants = (variantsByProduct.get(it.id) ?? []).filter((v) => v.is_active);
              const isOut = variants.length === 0 || totalStock <= 0;
              const isSingle = variants.length === 1;
              const badge = stockBadge(totalStock);
              return (
                <div key={it.id} className="pick-row">
                  <button
                    className="pick-btn"
                    onClick={() => !isOut && onProductClick(it)}
                    disabled={isOut}
                    style={isOut ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                  >
                    <span className="pick-name">
                      {it.name}
                      {!isSingle && variants.length > 1 && (
                        <span style={{
                          fontSize: 11, color: 'var(--s-muted)', marginLeft: 6,
                          padding: '1px 6px', borderRadius: 999, background: '#fafaf9',
                          border: '1px solid var(--s-line)', fontWeight: 500,
                        }}>{variants.length} sabores</span>
                      )}
                    </span>
                    <span className="pick-price">{money(it.price)} Bs</span>
                    {qty > 0 && <span className="pick-badge">{qty}</span>}
                    {badge && qty === 0 && (
                      <span style={{
                        fontSize: 11, color: badge.color, background: badge.bg,
                        padding: '1px 7px', borderRadius: 999, fontWeight: 600,
                        marginLeft: 6,
                      }}>{badge.text}</span>
                    )}
                  </button>
                  {qty > 0 && isSingle && (
                    <button
                      className="pick-dec"
                      onClick={() => onDecVariant(it, variants[0])}
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

      {variantSheetFor && (
        <VariantSheet
          product={variantSheetFor}
          variants={(variantsByProduct.get(variantSheetFor.id) ?? []).filter((v) => v.is_active)}
          qtyByVariantId={qtyByVariantForProduct(variantSheetFor.id)}
          onAdd={(v) => onAddVariant(variantSheetFor, v)}
          onDec={(v) => onDecVariant(variantSheetFor, v)}
          onClose={() => setVariantSheetFor(null)}
        />
      )}

      {comboSheetFor && (
        <ComboSheet
          combo={comboSheetFor}
          productsById={productsById}
          variantsByProduct={variantsByProduct}
          onConfirm={(payload) => { onAddCombo(payload); setComboSheetFor(null); }}
          onClose={() => setComboSheetFor(null)}
        />
      )}
    </div>
  );
}
