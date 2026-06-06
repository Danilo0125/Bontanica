// Stock.jsx — vista de stock por variante con ajuste manual + feed de
// movimientos. Solo admin (gateado por ProtectedRoute allow="admin").
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProducts } from '../../../lib/useProducts.js';
import { useVariants } from '../../../lib/useVariants.js';
import { adjustStock, fetchRecentStockMovements } from '../../../lib/stockApi.js';
import { useToast } from '../Toasts.jsx';
import { formatTime } from '../../../lib/format.js';

const REASONS = [
  { value: 'restock', label: 'Reposición (entrada)' },
  { value: 'adjust',  label: 'Ajuste manual' },
  { value: 'spoilage',label: 'Pérdida / merma' },
  { value: 'init',    label: 'Carga inicial' },
];

function stockLevel(s) {
  if (s <= 0) return { color: 'var(--s-crit)', bg: '#fbe1e1', label: 'Agotado' };
  if (s <= 3) return { color: '#a16207', bg: '#fff4d6', label: `Bajo · ${s}` };
  return { color: 'var(--s-ok)', bg: '#eaf6ed', label: `${s} disp.` };
}

export function Stock() {
  const { products, loading: pLoading } = useProducts();
  const { variants, loading: vLoading } = useVariants();
  const [movements, setMovements] = useState([]);
  const [movLoading, setMovLoading] = useState(true);
  const [adjustingId, setAdjustingId] = useState(null); // variant id que se está editando
  const toast = useToast();

  const refreshMovements = useCallback(async () => {
    try {
      setMovLoading(true);
      const rows = await fetchRecentStockMovements({ limit: 30 });
      setMovements(rows);
    } catch (e) { toast.error(`No pude cargar movimientos: ${e.message}`); }
    finally { setMovLoading(false); }
  }, [toast]);

  useEffect(() => { refreshMovements(); }, [refreshMovements]);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Filas: una por variante activa, agrupadas por producto.
  const rows = useMemo(() => {
    return variants
      .filter((v) => v.is_active)
      .map((v) => {
        const product = productsById.get(v.product_id);
        return { variant: v, product };
      })
      .filter((r) => r.product) // omitir si el producto está desactivado
      .sort((a, b) => {
        const cat = (a.product.category_name ?? '').localeCompare(b.product.category_name ?? '');
        if (cat !== 0) return cat;
        const pn = (a.product.name ?? '').localeCompare(b.product.name ?? '');
        if (pn !== 0) return pn;
        return (a.variant.sort_order ?? 0) - (b.variant.sort_order ?? 0);
      });
  }, [variants, productsById]);

  if (pLoading || vLoading) return <div className="s-empty">Cargando stock…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <h2 className="s-h2" style={{ margin: 0 }}>Stock</h2>
        <p className="s-sub" style={{ margin: '2px 0 0' }}>
          Una fila por variante activa. Al cobrar una tanda el stock se descuenta
          solo. Reponé o ajustá manualmente con "Editar".
        </p>
      </header>

      <div style={{
        background: '#fff', border: '1px solid var(--s-line)', borderRadius: 12, overflow: 'hidden',
      }}>
        {rows.length === 0 ? (
          <div className="s-empty" style={{ padding: 24 }}>Sin variantes activas todavía.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead style={{ background: '#fafaf9' }}>
              <tr style={{ textAlign: 'left', color: 'var(--s-muted)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Producto</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Variante</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>Stock</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, variant }) => {
                const lvl = stockLevel(variant.stock ?? 0);
                return (
                  <tr key={variant.id} style={{ borderTop: '1px solid var(--s-line-2)' }}>
                    <td style={{ padding: '12px', minWidth: 140 }}>
                      <strong>{product.name}</strong>
                      <div style={{ fontSize: 11.5, color: 'var(--s-muted)' }}>{product.category_name}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {variant.name}
                      {Number(variant.extra_price) > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--s-accent)', marginLeft: 6 }}>
                          +{variant.extra_price} Bs
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{
                        background: lvl.bg, color: lvl.color,
                        padding: '4px 10px', borderRadius: 999, fontWeight: 700, fontSize: 12.5,
                      }}>{lvl.label}</span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        className="btn-ghost"
                        style={{ padding: '6px 12px', fontSize: 12.5 }}
                        onClick={() => setAdjustingId(variant.id)}
                      >Editar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Feed de movimientos */}
      <div>
        <h3 className="s-h2" style={{ margin: 0, fontSize: 15, marginBottom: 8 }}>
          Movimientos recientes
        </h3>
        <p className="s-sub" style={{ margin: '0 0 10px' }}>
          Toda venta y todo ajuste queda registrado acá.
        </p>
        {movLoading ? (
          <div className="s-empty">Cargando…</div>
        ) : movements.length === 0 ? (
          <div className="s-empty">Sin movimientos todavía.</div>
        ) : (
          <div style={{
            background: '#fff', border: '1px solid var(--s-line)', borderRadius: 12, overflow: 'hidden',
          }}>
            {movements.map((m, i) => {
              const isOut = m.delta < 0;
              const reason = REASONS.find((r) => r.value === m.reason)?.label ?? m.reason;
              return (
                <div key={m.id} style={{
                  display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px',
                  borderTop: i > 0 ? '1px solid var(--s-line-2)' : 'none', fontSize: 13.5,
                }}>
                  <span style={{
                    width: 38, height: 28, borderRadius: 999, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12.5,
                    background: isOut ? '#fbe1e1' : '#eaf6ed',
                    color: isOut ? 'var(--s-crit)' : 'var(--s-ok)',
                  }}>{isOut ? m.delta : `+${m.delta}`}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>
                      <strong>{m.variant?.name ?? m.variant_id}</strong>
                      <span style={{ color: 'var(--s-muted)', marginLeft: 6 }}>· {reason}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--s-muted)', marginTop: 1 }}>
                      {m.actor_username ? `@${m.actor_username}` : 'auto'} · {formatTime(m.created_at)}
                      {m.note ? ` · "${m.note}"` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {adjustingId && (
        <AdjustModal
          variant={variants.find((v) => v.id === adjustingId)}
          product={productsById.get(variants.find((v) => v.id === adjustingId)?.product_id)}
          onClose={() => setAdjustingId(null)}
          onSaved={() => { setAdjustingId(null); refreshMovements(); }}
        />
      )}
    </div>
  );
}

function AdjustModal({ variant, product, onClose, onSaved }) {
  const [newValue, setNewValue] = useState(String(variant?.stock ?? 0));
  const [reason, setReason] = useState('restock');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(newValue);
    if (!Number.isFinite(n) || n < 0) { toast.error('Valor inválido'); return; }
    try {
      setBusy(true);
      const delta = await adjustStock(variant.id, n, reason, note.trim() || null);
      if (delta === 0) toast.info('Stock sin cambios');
      else toast.success(`Stock actualizado · ${delta > 0 ? '+' : ''}${delta}`);
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="s-scrim" onClick={() => !busy && onClose()} role="presentation">
      <form className="s-sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true">
        <div className="s-grip" />
        <h3 className="s-title">Ajustar stock</h3>
        <p className="s-sheet-sub">
          <strong>{product?.name}</strong> · {variant?.name} · actual {variant?.stock}
        </p>
        <label className="field">
          <span>Nuevo stock</span>
          <input
            type="number" inputMode="numeric" min="0"
            value={newValue} autoFocus
            onChange={(e) => setNewValue(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Motivo</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Nota (opcional)</span>
          <input
            type="text" value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ej. compré 20 más, vinieron 2 partidas..."
          />
        </label>
        <div className="confirm-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={busy}
                  style={{ width: 'auto', padding: '8px 16px' }}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
