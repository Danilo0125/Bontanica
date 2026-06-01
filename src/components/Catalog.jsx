// Catalog.jsx — Carta pública, lee productos de Supabase.
import { useProducts } from '../lib/useProducts.js';
import { Reveal, SectionTitle } from './ui.jsx';

function Skeleton() {
  return (
    <div className="catalog">
      {[0, 1, 2].map((i) => (
        <div key={i} className="cat-block cat-skel" aria-hidden="true">
          <div className="cat-skel-h" />
          <div className="cat-skel-line" />
          <div className="cat-skel-line" />
          <div className="cat-skel-line short" />
        </div>
      ))}
    </div>
  );
}

export function Catalog() {
  const { categories, loading, error } = useProducts();

  return (
    <section className="section section--catalog" id="carta" data-screen-label="Carta">
      <SectionTitle kicker="La carta" title="Para beber & compartir" />
      {loading && <Skeleton />}
      {error && !loading && (
        <Reveal className="carta-note">
          <p>No pudimos cargar la carta ahora. Volvé a intentar en un momento.</p>
        </Reveal>
      )}
      {!loading && !error && (
        <div className="catalog">
          {categories.map((cat, ci) => (
            <Reveal key={cat.id} delay={ci * 80}>
              <div className="cat-block">
                <div className="cat-head">
                  <h3>{cat.name}</h3>
                  {cat.tag && <span className="cat-tag">{cat.tag}</span>}
                </div>
                <ul className="item-list">
                  {cat.items.map((it) => (
                    <li className={`item ${it.image_url ? 'item--with-img' : ''}`} key={it.id}>
                      {it.image_url && (
                        <img className="item-img" src={it.image_url} alt={it.name}
                             loading="lazy" width="64" height="64" />
                      )}
                      <div className="item-text">
                        <div className="item-main">
                          <span className="item-name">{it.name}</span>
                          <span className="item-dots" />
                          <span className="item-price">{it.price} <small>Bs</small></span>
                        </div>
                        {it.description && <p className="item-desc">{it.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      )}
      <Reveal className="carta-note">
        <p>Precios referenciales en bolivianos. La carta varía según la noche.</p>
      </Reveal>
    </section>
  );
}
