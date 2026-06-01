// ProductPicker.jsx — selector de productos agrupados por categoría.
// El "draft" se maneja afuera: callbacks onAdd/onDec, count del padre.
import { useProducts } from '../../lib/useProducts.js';

export function ProductPicker({ draft, onAdd, onDec }) {
  const { categories, loading, error } = useProducts();

  if (loading) {
    return <div className="picker picker-skel" aria-hidden="true" />;
  }
  if (error) {
    return <p className="caja-error">No se pudo cargar la carta: {error.message}</p>;
  }

  return (
    <div className="picker">
      {categories.map((cat) => (
        <div className="pick-cat" key={cat.id}>
          <span className="pick-cat-name">{cat.name}</span>
          <div className="pick-items">
            {cat.items.map((it) => {
              const qty = draft[it.id] ?? 0;
              return (
                <div key={it.id} className="pick-row">
                  <button className="pick-btn" onClick={() => onAdd(it)}>
                    <span className="pick-name">{it.name}</span>
                    <span className="pick-price">{it.price} Bs</span>
                    {qty > 0 && <span className="pick-badge">{qty}</span>}
                  </button>
                  {qty > 0 && (
                    <button className="pick-dec" onClick={() => onDec(it)} aria-label={`Quitar ${it.name}`}>−</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
