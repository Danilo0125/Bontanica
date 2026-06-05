// Combos.jsx — gestión de combos en cards verticales.
import { useEffect, useState } from 'react';
import { listCombos, createCombo, updateCombo, deleteCombo } from '../../../lib/comboApi.js';
import { listAllProducts } from '../../../lib/productApi.js';
import { useToast } from '../Toasts.jsx';
import { money } from '../../../lib/format.js';
import { X } from '../../../lib/icons.jsx';

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
    <div className="s-modal-scrim" onClick={() => !busy && onClose()}>
      <form className="s-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="s-modal-head">
          <h3>{isEdit ? `Editar "${initial.name}"` : 'Nuevo combo'}</h3>
          <button type="button" className="s-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="s-modal-body">
          <div className="field">
            <label>Nombre del combo</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Descripción</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="opcional" />
          </div>
          <div className="field">
            <label>Precio del combo (Bs)</label>
            <input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>

          <h2 className="s-h2" style={{ marginTop: 8 }}>Productos del combo</h2>
          {items.length === 0
            ? <p className="s-sub">Agregá al menos un producto.</p>
            : items.map((line, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Producto</label>
                  <select value={line.product_id} onChange={(e) => setLine(idx, { product_id: e.target.value })}>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.price} Bs</option>)}
                  </select>
                </div>
                <div className="field" style={{ width: 80 }}>
                  <label>Cant.</label>
                  <input type="number" min="1" step="1" value={line.qty}
                    onChange={(e) => setLine(idx, { qty: Number(e.target.value) || 1 })} />
                </div>
                <button type="button" className="icon-del" onClick={() => removeLine(idx)} aria-label="Quitar">
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
            ))}
          <button type="button" className="btn-ghost" onClick={addLine}>+ Agregar producto</button>

          {items.length > 0 && (
            <p style={{ padding: 10, background: 'var(--s-accent-bg)', borderRadius: 8, fontSize: 13, color: 'var(--s-text)' }}>
              Suma individual: <strong>{money(sumIndividual)} Bs</strong>
              {discount > 0 && <> · descuento del combo: <strong>{money(discount)} Bs</strong></>}
            </p>
          )}
        </div>
        <div className="s-modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn-cobrar" disabled={busy}>
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
  const [editing, setEditing] = useState(null);
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

  if (loading) return <p className="s-empty">Cargando combos…</p>;

  return (
    <div>
      <div className="admin-bar">
        <h3>Combos <span className="count">· {combos.length}</span></h3>
        <button className="admin-add"
                onClick={() => setEditing({ name: '', description: '', price: '', items: [] })}>
          ＋ Nuevo combo
        </button>
      </div>
      <p className="s-sub" style={{ marginBottom: 12 }}>Productos compuestos con precio fijo. En cocina aparecen los items individuales.</p>

      {combos.length === 0 ? (
        <div className="s-empty">
          <p>Todavía no creaste combos.</p>
          <p style={{ fontSize: 12 }}>Ej: "Combo noche" = 1 Mojito + 1 Pizza tajada a 40 Bs.</p>
        </div>
      ) : (
        <div className="prod-list">
          {combos.map((c) => {
            const itemsText = (c.items ?? []).map((it) => {
              const p = products.find((x) => x.id === it.product_id);
              return `${it.qty}× ${p?.name ?? it.product_id}`;
            }).join(', ');
            return (
              <div key={c.id} className={`combo-card ${c.is_active ? '' : 'is-off'}`}>
                <div className="combo-top">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="combo-name">{c.name}</div>
                    {c.description && <div className="combo-desc">{c.description}</div>}
                  </div>
                  <span className="combo-price">{money(c.price)} Bs</span>
                </div>
                <div className="combo-items">{itemsText || '—'}</div>
                <div className="combo-actions">
                  <button className="btn-edit" onClick={() => setEditing(c)}>Editar</button>
                  <button className="icon-del" onClick={() => remove(c)} aria-label="Borrar">🗑</button>
                </div>
              </div>
            );
          })}
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
    </div>
  );
}
