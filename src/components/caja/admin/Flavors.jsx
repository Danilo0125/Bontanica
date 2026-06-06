// Flavors.jsx — gestión global de sabores como árbol por producto.
// Toggle is_active de un sabor lo desactiva en TODOS los productos donde está
// asignado (vínculo M:N). El buscador filtra por producto o sabor.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminListAllFlavors, adminListAllProductFlavorLinks,
  createFlavor, updateFlavor, deleteFlavor,
  attachFlavorToProduct, detachFlavorFromProduct,
} from '../../../lib/flavorApi.js';
import { useProducts } from '../../../lib/useProducts.js';
import { useToast } from '../Toasts.jsx';
import { useDialog } from '../Dialog.jsx';
import { Search, ChevronLeft, Plus, X, Trash2, Link2 } from '../../../lib/icons.jsx';

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function Flavors() {
  const [flavors, setFlavors] = useState([]);
  const [links, setLinks] = useState([]); // {product_id, flavor_id, sort_order}
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set()); // product_ids colapsados
  const { products } = useProducts();
  const toast = useToast();
  const dialog = useDialog();

  const load = useCallback(async () => {
    try {
      const [fl, lk] = await Promise.all([adminListAllFlavors(), adminListAllProductFlavorLinks()]);
      setFlavors(fl);
      setLinks(lk);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const flavorsById = useMemo(() => new Map(flavors.map((f) => [f.id, f])), [flavors]);

  const productsWithFlavors = useMemo(() => {
    // Map: product_id -> [{flavor, link_sort_order}]
    const m = new Map();
    for (const l of links) {
      const f = flavorsById.get(l.flavor_id);
      if (!f) continue;
      if (!m.has(l.product_id)) m.set(l.product_id, []);
      m.get(l.product_id).push({ flavor: f, sortOrder: l.sort_order ?? 0 });
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.sortOrder - b.sortOrder || a.flavor.name.localeCompare(b.flavor.name));
    }
    return m;
  }, [links, flavorsById]);

  // Para cada sabor, lista de products en los que aparece (para el badge "compartido")
  const productsByFlavor = useMemo(() => {
    const m = new Map();
    for (const l of links) {
      if (!m.has(l.flavor_id)) m.set(l.flavor_id, []);
      m.get(l.flavor_id).push(l.product_id);
    }
    return m;
  }, [links]);

  const orphanFlavors = useMemo(() => {
    const used = new Set(links.map((l) => l.flavor_id));
    return flavors.filter((f) => !used.has(f.id));
  }, [flavors, links]);

  // Filtro: aparece un producto si su nombre matchea, o si alguno de sus sabores matchea.
  const q = norm(query.trim());
  const matchesProduct = (p, flavorRows) => {
    if (!q) return true;
    if (norm(p.name).includes(q)) return true;
    return flavorRows.some(({ flavor }) => norm(flavor.name).includes(q));
  };
  const flavorMatches = (name) => q && norm(name).includes(q);

  const visibleSections = useMemo(() => {
    return products
      .filter((p) => productsWithFlavors.has(p.id))
      .map((p) => ({ product: p, rows: productsWithFlavors.get(p.id) }))
      .filter(({ product, rows }) => matchesProduct(product, rows));
  }, [products, productsWithFlavors, q]);

  const visibleOrphans = useMemo(
    () => orphanFlavors.filter((f) => !q || norm(f.name).includes(q)),
    [orphanFlavors, q],
  );

  // ─── Mutaciones ──────────────────────────────────────────────────────────
  const onToggleActive = async (flavor, checked) => {
    try {
      const updated = await updateFlavor(flavor.id, { is_active: checked });
      setFlavors((arr) => arr.map((f) => f.id === flavor.id ? updated : f));
    } catch (e) { toast.error(e.message); }
  };

  const onRenameFlavor = async (flavor, newName) => {
    const nv = newName.trim();
    if (!nv || nv === flavor.name) return;
    try {
      const updated = await updateFlavor(flavor.id, { name: nv });
      setFlavors((arr) => arr.map((f) => f.id === flavor.id ? updated : f));
    } catch (e) { toast.error(e.message); }
  };

  const onDetach = async (productId, flavor) => {
    const otherProducts = (productsByFlavor.get(flavor.id) ?? []).filter((id) => id !== productId);
    const productName = products.find((p) => p.id === productId)?.name ?? productId;
    const ok = await dialog.confirm({
      title: `Quitar "${flavor.name}" de ${productName}`,
      message: otherProducts.length > 0
        ? `El sabor sigue asignado a ${otherProducts.length} producto(s) más. No se borra del sistema.`
        : 'Queda sin asignar a ningún producto. Lo vas a encontrar al final de la lista.',
      confirmLabel: 'Quitar',
    });
    if (!ok) return;
    try {
      await detachFlavorFromProduct(productId, flavor.id);
      setLinks((arr) => arr.filter((l) => !(l.product_id === productId && l.flavor_id === flavor.id)));
    } catch (e) { toast.error(e.message); }
  };

  const onAttach = async (productId, flavorId) => {
    const product = products.find((p) => p.id === productId);
    const currentRows = productsWithFlavors.get(productId) ?? [];
    try {
      await attachFlavorToProduct(productId, flavorId, currentRows.length + 1);
      setLinks((arr) => [...arr, { product_id: productId, flavor_id: flavorId, sort_order: currentRows.length + 1 }]);
      toast.success(`Asignado a ${product?.name ?? productId}`);
    } catch (e) { toast.error(e.message); }
  };

  const onCreateGlobal = async () => {
    const name = await dialog.prompt({
      title: 'Nuevo sabor',
      message: 'Después podés asignarlo a uno o varios productos desde el árbol.',
      placeholder: 'ej. Margherita, Pepperoni, Tinto…',
      minLength: 1,
      confirmLabel: 'Crear',
    });
    if (!name) return;
    try {
      const created = await createFlavor({ name, sortOrder: flavors.length + 1 });
      setFlavors((arr) => [...arr, created]);
      toast.success(`"${created.name}" creado`);
    } catch (e) { toast.error(e.message); }
  };

  const onCreateForProduct = async (product) => {
    const name = await dialog.prompt({
      title: `Nuevo sabor para ${product.name}`,
      message: 'Se crea y se asigna a este producto. Más tarde podés agregarlo a otros.',
      placeholder: 'ej. Margherita, Pepperoni, Tinto…',
      minLength: 1,
      confirmLabel: 'Crear y asignar',
    });
    if (!name) return;
    try {
      const created = await createFlavor({ name, sortOrder: flavors.length + 1 });
      setFlavors((arr) => [...arr, created]);
      const currentRows = productsWithFlavors.get(product.id) ?? [];
      await attachFlavorToProduct(product.id, created.id, currentRows.length + 1);
      setLinks((arr) => [...arr, { product_id: product.id, flavor_id: created.id, sort_order: currentRows.length + 1 }]);
      toast.success(`"${created.name}" agregado a ${product.name}`);
    } catch (e) { toast.error(e.message); }
  };

  const onDeleteGlobal = async (flavor) => {
    const products_using = productsByFlavor.get(flavor.id) ?? [];
    const ok = await dialog.confirm({
      title: `¿Borrar "${flavor.name}" para siempre?`,
      message: products_using.length > 0
        ? `Está asignado a ${products_using.length} producto(s). Se borra de todos. El historial de ventas mantiene el snapshot del nombre.`
        : 'No está asignado a ningún producto. El historial de ventas mantiene el snapshot del nombre.',
      confirmLabel: 'Sí, borrar',
      confirmKind: 'danger',
    });
    if (!ok) return;
    try {
      await deleteFlavor(flavor.id);
      setFlavors((arr) => arr.filter((f) => f.id !== flavor.id));
      setLinks((arr) => arr.filter((l) => l.flavor_id !== flavor.id));
      toast.info('Sabor eliminado');
    } catch (e) { toast.error(e.message); }
  };

  const toggleCollapsed = (productId) => {
    setCollapsed((s) => { const n = new Set(s); if (n.has(productId)) n.delete(productId); else n.add(productId); return n; });
  };

  if (loading) return <div className="s-empty">Cargando sabores…</div>;

  const totalActive = flavors.filter((f) => f.is_active).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="s-h2" style={{ margin: 0 }}>Sabores</h2>
          <p className="s-sub" style={{ margin: '2px 0 0', maxWidth: 640 }}>
            Cada producto tiene sus sabores. El toggle ON/OFF es <strong>global</strong>:
            apagar Hawaiana la oculta en todos los productos que la usan al mismo tiempo.
          </p>
        </div>
        <button className="btn-primary" onClick={onCreateGlobal}
                style={{ width: 'auto', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} strokeWidth={2.2} /> Nuevo sabor
        </button>
      </header>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#fff', border: '1px solid var(--s-line)', borderRadius: 10,
        padding: '8px 12px',
      }}>
        <Search size={16} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--s-muted)', flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por producto o sabor (ej. pizza, hawaiana, vino…)"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 14, color: 'var(--s-text)',
          }}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--s-muted)', padding: 4, display: 'inline-flex',
            }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        )}
        <span style={{ fontSize: 12, color: 'var(--s-muted)', whiteSpace: 'nowrap' }}>
          {totalActive}/{flavors.length} activos
        </span>
      </div>

      {visibleSections.length === 0 && visibleOrphans.length === 0 ? (
        <div className="s-empty" style={{ padding: 20, background: '#fff', borderRadius: 10, border: '1px solid var(--s-line)' }}>
          {q ? `Nada coincide con "${query}".` : 'Todavía no hay productos con sabores asignados.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleSections.map(({ product, rows }) => {
            const isCollapsed = collapsed.has(product.id);
            const shownRows = q
              ? rows.filter(({ flavor }) => norm(product.name).includes(q) || norm(flavor.name).includes(q))
              : rows;
            return (
              <section key={product.id} style={{
                background: '#fff', border: '1px solid var(--s-line)', borderRadius: 12, overflow: 'hidden',
              }}>
                <button type="button" onClick={() => toggleCollapsed(product.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    background: 'var(--s-surface-2)', border: 'none', cursor: 'pointer',
                    padding: '12px 14px', textAlign: 'left',
                  }}
                >
                  <ChevronLeft size={16} strokeWidth={2}
                    style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(-90deg)', transition: 'transform .15s', color: 'var(--s-muted)' }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--s-text)' }}>{product.name}</span>
                  <span style={{
                    background: '#fff', border: '1px solid var(--s-line)', color: 'var(--s-muted)',
                    padding: '1px 9px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  }}>
                    {rows.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div style={{ padding: '4px 0' }}>
                    {shownRows.length === 0 ? (
                      <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--s-muted)', fontStyle: 'italic' }}>
                        Sin coincidencias dentro de este producto.
                      </div>
                    ) : shownRows.map(({ flavor }, i) => {
                      const sharedWith = (productsByFlavor.get(flavor.id) ?? []).filter((id) => id !== product.id);
                      const sharedNames = sharedWith.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean);
                      const highlighted = flavorMatches(flavor.name);
                      return (
                        <div key={flavor.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 16px',
                          borderTop: i > 0 ? '1px solid var(--s-line-2)' : 'none',
                          background: highlighted ? 'var(--s-accent-bg)' : 'transparent',
                          opacity: flavor.is_active ? 1 : 0.55,
                        }}>
                          <input
                            defaultValue={flavor.name}
                            onBlur={(e) => onRenameFlavor(flavor, e.target.value)}
                            aria-label={`Nombre de ${flavor.name}`}
                            style={{
                              flex: 1, minWidth: 0, maxWidth: 360,
                              padding: '6px 10px', border: '1px solid var(--s-line)',
                              borderRadius: 6, background: '#fff',
                              fontSize: 14, fontWeight: 600,
                            }}
                          />
                          {sharedNames.length > 0 && (
                            <span title={`También en: ${sharedNames.join(' · ')}`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '2px 8px', borderRadius: 999,
                                background: 'var(--s-surface-2)', color: 'var(--s-muted)',
                                fontSize: 11.5, fontWeight: 600,
                              }}>
                              <Link2 size={12} strokeWidth={2.2} />
                              {sharedNames.length}
                            </span>
                          )}
                          <label className="sw" title={flavor.is_active ? 'Activo (global)' : 'Inactivo (global)'}>
                            <input type="checkbox" checked={flavor.is_active}
                              onChange={(e) => onToggleActive(flavor, e.target.checked)} />
                            <span className="sw-track" />
                          </label>
                          <button type="button" onClick={() => onDetach(product.id, flavor)}
                            aria-label={`Quitar ${flavor.name} de ${product.name}`}
                            title={`Quitar de ${product.name}`}
                            style={{
                              width: 30, height: 30, borderRadius: 8,
                              border: '1px solid var(--s-line)', background: '#fff',
                              cursor: 'pointer', color: 'var(--s-muted)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                            <X size={15} strokeWidth={2} />
                          </button>
                        </div>
                      );
                    })}
                    <AddFlavorRow
                      product={product}
                      allFlavors={flavors}
                      assignedIds={new Set((rows ?? []).map(({ flavor }) => flavor.id))}
                      onAttach={(flavorId) => onAttach(product.id, flavorId)}
                      onCreateNew={() => onCreateForProduct(product)}
                    />
                  </div>
                )}
              </section>
            );
          })}

          {visibleOrphans.length > 0 && (
            <section style={{
              background: '#fff', border: '1px dashed var(--s-line)', borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px', background: 'var(--s-surface-2)',
                fontSize: 13.5, fontWeight: 700, color: 'var(--s-muted)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                Sabores sin asignar a productos
                <span style={{
                  background: '#fff', border: '1px solid var(--s-line)',
                  padding: '1px 8px', borderRadius: 999, fontSize: 11.5,
                }}>{visibleOrphans.length}</span>
              </div>
              {visibleOrphans.map((f, i) => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px',
                  borderTop: i > 0 ? '1px solid var(--s-line-2)' : 'none',
                  opacity: f.is_active ? 1 : 0.55,
                }}>
                  <input
                    defaultValue={f.name}
                    onBlur={(e) => onRenameFlavor(f, e.target.value)}
                    style={{
                      flex: 1, minWidth: 0, maxWidth: 360,
                      padding: '6px 10px', border: '1px solid var(--s-line)',
                      borderRadius: 6, background: '#fff',
                      fontSize: 14, fontWeight: 600,
                    }}
                  />
                  <label className="sw" title={f.is_active ? 'Activo' : 'Inactivo'}>
                    <input type="checkbox" checked={f.is_active}
                      onChange={(e) => onToggleActive(f, e.target.checked)} />
                    <span className="sw-track" />
                  </label>
                  <button type="button" onClick={() => onDeleteGlobal(f)}
                    aria-label={`Borrar ${f.name}`}
                    title="Borrar definitivamente"
                    style={{
                      width: 30, height: 30, borderRadius: 8,
                      border: '1px solid var(--s-line)', background: '#fff',
                      cursor: 'pointer', color: '#b04444',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// Selector de "Agregar sabor existente" + atajo "Crear sabor nuevo" por producto.
function AddFlavorRow({ product, allFlavors, assignedIds, onAttach, onCreateNew }) {
  const [picking, setPicking] = useState(false);
  const available = allFlavors
    .filter((f) => !assignedIds.has(f.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '10px 16px',
      borderTop: '1px solid var(--s-line-2)',
      background: 'var(--s-surface-2)',
    }}>
      {!picking ? (
        <>
          <button type="button" onClick={() => setPicking(true)}
            disabled={available.length === 0}
            style={{
              padding: '6px 12px', borderRadius: 8,
              border: '1px solid var(--s-line)', background: '#fff',
              cursor: available.length === 0 ? 'not-allowed' : 'pointer',
              color: available.length === 0 ? 'var(--s-muted)' : 'var(--s-text)',
              fontSize: 13, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <Plus size={14} strokeWidth={2.2} />
            Agregar sabor existente
            {available.length === 0 && <span style={{ fontWeight: 400, color: 'var(--s-muted)' }}>(todos asignados)</span>}
          </button>
          <button type="button" onClick={onCreateNew}
            style={{
              padding: '6px 12px', borderRadius: 8,
              border: '1px solid var(--s-line)', background: '#fff',
              cursor: 'pointer', color: 'var(--s-text)',
              fontSize: 13, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <Plus size={14} strokeWidth={2.2} />
            Crear sabor nuevo
          </button>
        </>
      ) : (
        <>
          <select
            autoFocus
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              onAttach(id);
              setPicking(false);
            }}
            style={{
              padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--s-line)', background: '#fff',
              fontSize: 13.5, fontWeight: 600, color: 'var(--s-text)',
              minWidth: 220,
            }}>
            <option value="" disabled>Elegí un sabor…</option>
            {available.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}{!f.is_active ? ' (inactivo)' : ''}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setPicking(false)}
            style={{
              padding: '6px 12px', borderRadius: 8,
              border: '1px solid var(--s-line)', background: '#fff',
              cursor: 'pointer', color: 'var(--s-muted)',
              fontSize: 13, fontWeight: 600,
            }}>
            Cancelar
          </button>
        </>
      )}
    </div>
  );
}
