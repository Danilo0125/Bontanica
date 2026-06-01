// Products.jsx — tabla CRUD de productos con edición inline.
import { useEffect, useMemo, useState } from 'react';
import { listAllProducts, createProduct, updateProduct } from '../../../lib/productApi.js';
import { useToast } from '../Toasts.jsx';

function NewProductModal({ onClose, onCreated, existingCategories }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryMode, setCategoryMode] = useState(existingCategories[0] ?? 'new');
  const [newCatId, setNewCatId] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !price) return;
    try {
      setBusy(true);
      const cat = categoryMode === 'new'
        ? { category_id: newCatId.trim() || newCatName.toLowerCase().replace(/\s+/g, '-'), category_name: newCatName }
        : (() => {
          const found = existingCategories.find((c) => c.id === categoryMode);
          return found ? { category_id: found.id, category_name: found.name, category_tag: found.tag } : null;
        })();
      if (!cat) throw new Error('Elegí una categoría');
      await createProduct({
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        ...cat,
      });
      toast.success(`"${name}" creado`);
      onCreated();
    } catch (e) {
      toast.error(e.message ?? String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="admin-modal-scrim" onClick={() => !busy && onClose()}>
      <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="admin-modal-head">
          <h3>Nuevo producto</h3>
          <button type="button" className="admin-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="admin-modal-body admin-form">
          <div className="admin-field">
            <label>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="admin-field">
            <label>Precio (Bs)</label>
            <input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label>Descripción (opcional)</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Categoría</label>
            <select value={categoryMode} onChange={(e) => setCategoryMode(e.target.value)}>
              {existingCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="new">+ Nueva categoría</option>
            </select>
          </div>
          {categoryMode === 'new' && (
            <>
              <div className="admin-field">
                <label>Nombre de la categoría nueva</label>
                <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} required />
              </div>
              <div className="admin-field">
                <label>ID (slug, opcional)</label>
                <input value={newCatId} onChange={(e) => setNewCatId(e.target.value)} placeholder="auto" />
              </div>
            </>
          )}
        </div>
        <div className="admin-modal-foot">
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
            {busy ? 'Creando…' : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const toast = useToast();

  const load = async () => {
    try {
      const ps = await listAllProducts();
      setProducts(ps);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const categories = useMemo(() => {
    const m = new Map();
    for (const p of products) {
      if (!m.has(p.category_id)) m.set(p.category_id, { id: p.category_id, name: p.category_name, tag: p.category_tag });
    }
    return Array.from(m.values());
  }, [products]);

  const onPatch = async (id, patch) => {
    setSavingId(id);
    try {
      const updated = await updateProduct(id, patch);
      setProducts((arr) => arr.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      toast.error(`No se pudo guardar: ${e.message}`);
      load(); // revert UI
    } finally { setSavingId(null); }
  };

  if (loading) return <p className="admin-empty">Cargando productos…</p>;

  return (
    <>
      <h1 className="admin-h1">Productos</h1>
      <p className="admin-sub">Editá precios, nombres, o desactivá productos. Los cambios impactan al instante en la carta y el picker del mesero.</p>

      <div className="admin-actions-bar">
        <span style={{ color: 'var(--a-text-muted)', fontSize: 13 }}>{products.length} producto{products.length !== 1 ? 's' : ''}</span>
        <button className="admin-btn admin-btn-primary" onClick={() => setModal(true)}>+ Nuevo producto</button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th className="admin-cell-num">Precio (Bs)</th>
              <th className="admin-cell-num">Orden</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <input defaultValue={p.name}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) onPatch(p.id, { name: v }); }} />
                </td>
                <td style={{ color: 'var(--a-text-muted)', fontSize: 13 }}>{p.category_name}</td>
                <td className="admin-cell-num">
                  <input type="number" min="0" step="1" defaultValue={p.price}
                    onBlur={(e) => { const v = Number(e.target.value); if (v >= 0 && v !== Number(p.price)) onPatch(p.id, { price: v }); }} />
                </td>
                <td className="admin-cell-num">
                  <input type="number" defaultValue={p.sort_order}
                    onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(p.sort_order)) onPatch(p.id, { sort_order: v }); }} />
                </td>
                <td>
                  <label className="admin-toggle">
                    <input type="checkbox" checked={p.is_active}
                      onChange={(e) => onPatch(p.id, { is_active: e.target.checked })}
                      disabled={savingId === p.id} />
                    <span className="admin-toggle-track" />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <NewProductModal
          onClose={() => setModal(false)}
          onCreated={() => { setModal(false); load(); }}
          existingCategories={categories}
        />
      )}
    </>
  );
}
