// Flavors.jsx — gestión global de sabores. Toggle is_active de un sabor lo
// desactiva en TODOS los productos donde está asignado (vínculo M:N).
import { useCallback, useEffect, useState } from 'react';
import {
  adminListAllFlavors, adminListAllProductFlavorLinks,
  createFlavor, updateFlavor, deleteFlavor,
} from '../../../lib/flavorApi.js';
import { useProducts } from '../../../lib/useProducts.js';
import { useToast } from '../Toasts.jsx';
import { useDialog } from '../Dialog.jsx';
import { X } from '../../../lib/icons.jsx';

export function Flavors() {
  const [flavors, setFlavors] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
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

  const linksByFlavor = (() => {
    const m = new Map();
    for (const l of links) {
      if (!m.has(l.flavor_id)) m.set(l.flavor_id, []);
      m.get(l.flavor_id).push(l.product_id);
    }
    return m;
  })();

  const productsById = new Map(products.map((p) => [p.id, p]));

  const onPatch = async (id, patch) => {
    setSavingId(id);
    try {
      const updated = await updateFlavor(id, patch);
      setFlavors((arr) => arr.map((f) => f.id === id ? updated : f));
    } catch (e) { toast.error(e.message); }
    finally { setSavingId(null); }
  };

  const onCreate = async () => {
    const name = await dialog.prompt({
      title: 'Nuevo sabor',
      message: 'Después podés agregarlo a productos específicos desde la pestaña Productos.',
      placeholder: 'ej. Margherita, Pepperoni, Tinto...',
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

  const onDelete = async (flavor) => {
    const ok = await dialog.confirm({
      title: '¿Borrar sabor?',
      message: `"${flavor.name}" se borrará de todos los productos que lo usan. El historial de ventas mantiene el snapshot del nombre.`,
      confirmLabel: 'Sí, borrar',
      confirmKind: 'danger',
    });
    if (!ok) return;
    setSavingId(flavor.id);
    try {
      await deleteFlavor(flavor.id);
      setFlavors((arr) => arr.filter((f) => f.id !== flavor.id));
      toast.info('Sabor eliminado');
    } catch (e) { toast.error(e.message); }
    finally { setSavingId(null); }
  };

  if (loading) return <div className="s-empty">Cargando sabores…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="s-h2" style={{ margin: 0 }}>Sabores</h2>
          <p className="s-sub" style={{ margin: '2px 0 0' }}>
            Toggle un sabor → desaparece en <strong>todos</strong> los productos
            donde está asignado (ej. Hawaiana queda invisible en Pizza Familiar
            y en Pizza por porción al mismo tiempo).
          </p>
        </div>
        <button className="btn-primary" onClick={onCreate}
                style={{ width: 'auto', padding: '8px 16px' }}>
          + Nuevo sabor
        </button>
      </header>

      <div style={{
        background: '#fff', border: '1px solid var(--s-line)', borderRadius: 12, overflow: 'hidden',
      }}>
        {flavors.length === 0 ? (
          <div className="s-empty" style={{ padding: 24 }}>Sin sabores todavía.</div>
        ) : flavors.map((f, i) => {
          const productIds = linksByFlavor.get(f.id) ?? [];
          const productNames = productIds
            .map((id) => productsById.get(id)?.name)
            .filter(Boolean);
          const isBusy = savingId === f.id;
          return (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              borderTop: i > 0 ? '1px solid var(--s-line-2)' : 'none',
              opacity: isBusy ? 0.6 : 1, background: f.is_active ? '#fff' : '#fafaf9',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  defaultValue={f.name}
                  onBlur={(e) => {
                    const nv = e.target.value.trim();
                    if (nv && nv !== f.name) onPatch(f.id, { name: nv });
                  }}
                  style={{
                    width: '100%', maxWidth: 300, padding: '6px 10px',
                    border: '1px solid var(--s-line)', borderRadius: 6,
                    background: '#fff', fontSize: 14, fontWeight: 600,
                  }}
                />
                <div style={{ fontSize: 12, color: 'var(--s-muted)', marginTop: 4 }}>
                  {productNames.length === 0
                    ? <em>No está asignado a ningún producto</em>
                    : `Usado en: ${productNames.join(' · ')}`}
                </div>
              </div>

              <label className="sw" title={f.is_active ? 'Activo' : 'Inactivo'}>
                <input
                  type="checkbox"
                  checked={f.is_active}
                  onChange={(e) => onPatch(f.id, { is_active: e.target.checked })}
                  disabled={isBusy}
                />
                <span className="sw-track" />
              </label>

              <button
                type="button"
                onClick={() => onDelete(f)}
                disabled={isBusy}
                aria-label="Borrar sabor"
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  border: '1px solid var(--s-line)', background: '#fff',
                  cursor: 'pointer', color: 'var(--s-muted)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
