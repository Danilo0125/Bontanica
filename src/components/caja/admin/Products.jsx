// Products.jsx — CRUD de productos como lista vertical de cards (sin tabla).
import { useEffect, useMemo, useRef, useState } from 'react';
import { listAllProducts, createProduct, updateProduct } from '../../../lib/productApi.js';
import { uploadProductImage, deleteProductImageByUrl } from '../../../lib/storageApi.js';
import { useToast } from '../Toasts.jsx';
import { Camera } from '../../../lib/icons.jsx';

function NewProductModal({ onClose, onCreated, existingCategories }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryMode, setCategoryMode] = useState(existingCategories[0]?.id ?? 'new');
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
    <div className="s-modal-scrim" onClick={() => !busy && onClose()}>
      <form className="s-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="s-modal-head">
          <h3>Nuevo producto</h3>
          <button type="button" className="s-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="s-modal-body">
          <div className="field">
            <label>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Precio (Bs)</label>
            <input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className="field">
            <label>Descripción (opcional)</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>Categoría</label>
            <select value={categoryMode} onChange={(e) => setCategoryMode(e.target.value)}>
              {existingCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="new">+ Nueva categoría</option>
            </select>
          </div>
          {categoryMode === 'new' && (
            <>
              <div className="field">
                <label>Nombre de la categoría nueva</label>
                <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} required />
              </div>
              <div className="field">
                <label>ID (slug, opcional)</label>
                <input value={newCatId} onChange={(e) => setNewCatId(e.target.value)} placeholder="auto" />
              </div>
            </>
          )}
        </div>
        <div className="s-modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="btn-cobrar" disabled={busy}>
            {busy ? 'Creando…' : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProdPhoto({ product, disabled, onUpload, onRemove }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();
  const change = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    try { await onUpload(product, f); } finally { setUploading(false); }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="prod-photo" onClick={pick}
              disabled={disabled || uploading}
              aria-label={product.image_url ? 'Cambiar imagen' : 'Subir imagen'}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} loading="lazy" />
          : <span className="prod-photo-placeholder"><Camera size={26} strokeWidth={1.6} /></span>}
        {uploading && <span className="prod-photo-uploading">…</span>}
      </button>
      {product.image_url && !uploading && (
        <button type="button" className="prod-photo-remove" onClick={() => onRemove(product)}
                disabled={disabled} aria-label="Quitar imagen" title="Quitar imagen">×</button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={change} style={{ display: 'none' }} />
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
      load();
    } finally { setSavingId(null); }
  };

  const onUploadImage = async (product, file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('La imagen supera 8MB'); return; }
    setSavingId(product.id);
    try {
      const { url } = await uploadProductImage(product.id, file);
      const updated = await updateProduct(product.id, { image_url: url });
      if (product.image_url) deleteProductImageByUrl(product.image_url);
      setProducts((arr) => arr.map((p) => (p.id === product.id ? updated : p)));
      toast.success(`Foto de "${product.name}" actualizada`);
    } catch (e) {
      toast.error(`Subida falló: ${e.message}`);
    } finally { setSavingId(null); }
  };

  const onRemoveImage = async (product) => {
    if (!product.image_url) return;
    if (!confirm(`¿Quitar la imagen de "${product.name}"?`)) return;
    setSavingId(product.id);
    try {
      const oldUrl = product.image_url;
      const updated = await updateProduct(product.id, { image_url: null });
      deleteProductImageByUrl(oldUrl);
      setProducts((arr) => arr.map((p) => (p.id === product.id ? updated : p)));
    } catch (e) { toast.error(e.message); }
    finally { setSavingId(null); }
  };

  if (loading) return <p className="s-empty">Cargando productos…</p>;

  // Agrupar por categoría
  const byCat = new Map();
  for (const p of products) {
    if (!byCat.has(p.category_id)) byCat.set(p.category_id, { id: p.category_id, name: p.category_name, items: [] });
    byCat.get(p.category_id).items.push(p);
  }

  return (
    <div>
      <div className="admin-bar">
        <h3>Productos <span className="count">· {products.length}</span></h3>
        <button className="admin-add" onClick={() => setModal(true)}>＋ Nuevo</button>
      </div>

      {Array.from(byCat.values()).map((cat) => (
        <div key={cat.id} style={{ marginBottom: 18 }}>
          <h2 className="s-h2">{cat.name}</h2>
          <div className="prod-list">
            {cat.items.map((p) => (
              <div key={p.id} className={`prod-card ${p.is_active ? '' : 'is-off'}`}>
                <ProdPhoto product={p} disabled={savingId === p.id}
                           onUpload={onUploadImage} onRemove={onRemoveImage} />
                <div className="prod-fields">
                  <input className="prod-name-input" defaultValue={p.name}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) onPatch(p.id, { name: v }); }} />
                  <div className="prod-meta">
                    <div className="field-inline">
                      <label>Precio</label>
                      <div className="price-input">
                        <input type="number" min="0" step="1" defaultValue={p.price}
                          onBlur={(e) => { const v = Number(e.target.value); if (v >= 0 && v !== Number(p.price)) onPatch(p.id, { price: v }); }} />
                        <span>Bs</span>
                      </div>
                    </div>
                    <div className="field-inline">
                      <label>Categoría</label>
                      <select className="cat-select" value={p.category_id}
                              onChange={(e) => {
                                const newCat = categories.find((c) => c.id === e.target.value);
                                if (newCat) onPatch(p.id, { category_id: newCat.id, category_name: newCat.name });
                              }}>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="prod-actions">
                  <label className="sw" title={p.is_active ? 'Activo' : 'Inactivo'}>
                    <input type="checkbox" checked={p.is_active}
                      onChange={(e) => onPatch(p.id, { is_active: e.target.checked })}
                      disabled={savingId === p.id} />
                    <span className="sw-track" />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {modal && (
        <NewProductModal
          onClose={() => setModal(false)}
          onCreated={() => { setModal(false); load(); }}
          existingCategories={categories}
        />
      )}
    </div>
  );
}
