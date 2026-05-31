// catalog.jsx — Carta / Catálogo
function Catalog() {
  return (
    <section className="section section--catalog" id="carta" data-screen-label="Carta">
      <SectionTitle kicker="La carta" title="Para beber & compartir" />
      <div className="catalog">
        {CATEGORIES.map((cat, ci) => (
          <Reveal key={cat.id} delay={ci * 80}>
            <div className="cat-block">
              <div className="cat-head">
                <h3>{cat.name}</h3>
                <span className="cat-tag">{cat.tag}</span>
              </div>
              <ul className="item-list">
                {cat.items.map((it) => (
                  <li className="item" key={it.id}>
                    <div className="item-main">
                      <span className="item-name">{it.name}</span>
                      <span className="item-dots" />
                      <span className="item-price">{it.price} <small>Bs</small></span>
                    </div>
                    <p className="item-desc">{it.desc}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="carta-note">
        <p>Precios referenciales en bolivianos. La carta varía según la noche.</p>
      </Reveal>
    </section>
  );
}
window.Catalog = Catalog;
