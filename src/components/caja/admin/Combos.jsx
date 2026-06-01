// Combos.jsx — gestión de combos. Lista + modal de edición.
import { useEffect, useState } from 'react';
import { listCombos, createCombo, updateCombo, deleteCombo } from '../../../lib/comboApi.js';
import { listAllProducts } from '../../../lib/productApi.js';
import { useToast } from '../Toasts.jsx';
import { money } from '../../../lib/format.js';

function ComboModal({ initial, products, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [items, setItems] = useState(initial?.items?.map((i) => ({ product_id: i.product_id, qty: i.qty })) ?? []);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const addLine = () => setItems((arr) => [...arr, { product_id: products[0]?.id, qty: 1 }]);
  const removeLine = (idx) => setItems((arr) => arr.filter((_, i) => i !== idx));
  const setLine = (idx, patch) => setItems((arr) => arr.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const sumIndividual = items.reduce((s, it) => {
    const p = products.find((x) => x.id === it.product_id);
    return s + (p ? Number(p.price) * Number(it.qty || 0) : 0);
  }, 0);
  const discount = Number(price) > 0 && sumIndividual > 0 ? sumIndividual - Number(price) : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !price || items.length === 0) {
      toast.error('Falta nombre, precio o al menos un producto'); return;
    }
    try {
      setBusy(true);
      if (isEdit) {
        await updateCombo(initial.id, { name, description, price: Number(price), items });
        toast.success('Combo actualizado');
      } else {
        await createCombo({ name, description, price: Number(price), items });
        toast.success('Combo creado');
      }
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="admin-modal-scrim" onClick={() => !busy && onClose()}>
      <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="admin-modal-head">
          <h3>{isEdit ? `Editar "${initial.name}"` : 'Nuevo combo'}</h3>
          <button type="button" className="admin-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form">
            <div className="admin-field">
              <label>Nombre del combo</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="admin-field">
              <label>Descripción</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="opcional" />
            </div>
            <div className="admin-field">
              <label>Precio del combo (Bs)</label>
              <input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
          </div>

          <h2 className="admin-h2" style={{ marginTop: 18 }}>Productos del combo</h2>
          {items.length === 0
            ? <p style={{ color: 'var(--a-text-muted)', fontSize: 13 }}>Agregá al menos un producto.</p>
            : (
              <table className="admin-table" style={{ marginBottom: 10 }}>
                <thead><tr><th>Producto</th><th className="admin-cell-num" style={{ width: 90 }}>Cant.</th><th style={{ width: 40 }}></th></tr></thead>
                <tbody>
                  {items.map((line, idx) => (
                    <tr key={idx}>
                      <td>
                        <select value={line.product_id} onChange={(e) => setLine(idx, { product_id: e.target.value })}>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.price} Bs</option>)}
                        </select>
                      </td>
                      <td className="admin-cell-num">
                        <input type="number" min="1" step="1" value={line.qty}
                          onChange={(e) => setLine(idx, { qty: Number(e.target.value) || 1 })} />
                      </td>
                      <td>
                        <button type="button" className="admin-btn admin-btn-danger admin-btn-icon"
                                onClick={() => removeLine(idx)} aria-label="Quitar">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          <button type="button" className="admin-btn admin-btn-secondary" onClick={addLine}>+ Agregar producto</button>

          {items.length > 0 && (
            <p style={{ marginTop: 14, padding: 10, background: 'var(--a-accent-bg)', borderRadius: 8, fontSize: 13 }}>
              Suma individual: <strong>{money(sumIndividual)} Bs</strong>
              {discount > 0 && <> · descuento del combo: <strong>{money(discount)} Bs</strong></>}
            </p>
          )}
        </div>
        <div className="admin-modal-foot">
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : (isEdit ? 'Guardar' : 'Crear combo')}
          </button>
        </div>
      </form>
    </div>
  );
}

export function Combos() {
  const [combos, setCombos] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | {id?,...}
  const toast = useToast();

  const load = async () => {
    try {
      const [c, p] = await Promise.all([listCombos(), listAllProducts()]);
      setCombos(c);
      setProducts(p.filter((x) => x.is_active));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const remove = async (combo) => {
    if (!confirm(`¿Borrar "${combo.name}"?`)) return;
    try { await deleteCombo(combo.id); toast.info('Combo eliminado'); load(); }
    catch (e) { toast.error(e.message); }
  };

  if (loading) return <p className="admin-empty">Cargando combos…</p>;

  return (
    <>
      <h1 className="admin-h1">Combos</h1>
      <p className="admin-sub">Productos compuestos con precio fijo (descuento implícito). En cocina aparecen los items individuales.</p>

      <div className="admin-actions-bar">
        <span style={{ color: 'var(--a-text-muted)', fontSize: 13 }}>{combos.length} combo{combos.length !== 1 ? 's' : ''}</span>
        <button className="admin-btn admin-btn-primary"
                onClick={() => setEditing({ name: '', description: '', price: '', items: [] })}>
          + Nuevo combo
        </button>
      </div>

      {combos.length === 0 ? (
        <div className="admin-empty">
          <p>Todavía no creaste combos.</p>
          <p style={{ fontSize: 12 }}>Ej: "Combo noche" = 1 Mojito + 1 Pizza tajada a 40 Bs (en vez de 45 sumando individual).</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Nombre</th><th>Productos</th><th className="admin-cell-num">Precio</th><th>Activo</th><th></th></tr></thead>
            <tbody>
              {combos.map((c) => {
                const itemsText = (c.items ?? []).map((it) => {
                  const p = products.find((x) => x.id === it.product_id);
                  return `${it.qty}× ${p?.name ?? it.product_id}`;
                }).join(', ');
                return (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong>{c.description && <><br/><small style={{ color: 'var(--a-text-muted)' }}>{c.description}</small></>}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--a-text-soft)' }}>{itemsText || '—'}</td>
                    <td className="admin-cell-num"><strong>{money(c.price)} Bs</strong></td>
                    <td>{c.is_active
                      ? <span className="admin-pill admin-pill-ok">activo</span>
                      : <span className="admin-pill admin-pill-muted">inactivo</span>}</td>
                    <td>
                      <button className="admin-btn admin-btn-secondary admin-btn-icon" onClick={() => setEditing(c)}>Editar</button>
                      <button className="admin-btn admin-btn-danger admin-btn-icon" onClick={() => remove(c)} style={{ marginLeft: 6 }}>Borrar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ComboModal
          initial={editing}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}
