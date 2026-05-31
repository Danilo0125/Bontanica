// sections.jsx — Galería, Ubicación, Reservas/Contacto, Redes, About, Footer
const { useState: useStateS } = React;

function About() {
  return (
    <section className="section section--about" data-screen-label="Nosotros">
      <Reveal>
        <span className="kicker"><span className="kicker-line" />Botánica<span className="kicker-line" /></span>
        <p className="about-text">{VENUE.about}</p>
      </Reveal>
    </section>
  );
}

const GALLERY = [
  { id: "g1", span: "tall", ph: "Jardín de noche" },
  { id: "g2", span: "", ph: "Cócteles" },
  { id: "g3", span: "", ph: "Pizza al horno" },
  { id: "g4", span: "wide", ph: "Música en vivo" },
  { id: "g5", span: "", ph: "Las luces" },
  { id: "g6", span: "tall", ph: "Rincón verde" },
];

function Gallery() {
  return (
    <section className="section section--gallery" id="galeria" data-screen-label="Galería">
      <SectionTitle kicker="Galería" title="Noches en Botánica" />
      <Reveal className="gallery-grid">
        {GALLERY.map((g) => (
          <image-slot key={g.id} id={g.id} class={`g-slot g-${g.span}`} shape="rounded" radius="14" placeholder={g.ph}></image-slot>
        ))}
      </Reveal>
      <Reveal className="gallery-note"><p>Arrastra tus fotos a cada recuadro para llenar la galería.</p></Reveal>
    </section>
  );
}

function Location() {
  return (
    <section className="section section--location" id="ubicacion" data-screen-label="Ubicación">
      <SectionTitle kicker="Cómo llegar" title="Encuéntranos" />
      <Reveal className="map-card">
        <div className="map-visual" aria-hidden="true">
          <div className="map-grid" />
          <div className="map-pin">
            <svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7Z" fill="var(--gold)" /><circle cx="12" cy="9" r="2.6" fill="var(--bg)" /></svg>
          </div>
          <span className="map-roads r1" /><span className="map-roads r2" /><span className="map-roads r3" />
        </div>
        <div className="map-info">
          <h3>Botánica Resto Bar</h3>
          <p className="map-addr">Jardín interior · consulta la dirección exacta en el mapa.</p>
          <div className="map-hours"><span className="dot" /> Sáb 6 jun · desde las 18:00</div>
          <a className="btn-gold btn-gold--block" href={VENUE.mapsUrl} target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7Z" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
            Abrir en Google Maps
          </a>
        </div>
      </Reveal>
    </section>
  );
}

function Reservas() {
  const [name, setName] = useStateS("");
  const [people, setPeople] = useStateS(2);
  const [when, setWhen] = useStateS("Sábado 6 de junio");
  const msg = encodeURIComponent(
    `¡Hola Botánica! Quiero reservar una mesa.\n\nNombre: ${name || "—"}\nPersonas: ${people}\nFecha: ${when}`
  );
  const waUrl = `https://wa.me/${VENUE.whatsapp}?text=${msg}`;
  return (
    <section className="section section--reservas" id="reservas" data-screen-label="Reservas">
      <SectionTitle kicker="Reservas" title="Aparta tu mesa" />
      <Reveal className="reserva-card">
        <label className="field">
          <span>Tu nombre</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. María" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Personas</span>
            <div className="stepper">
              <button onClick={() => setPeople((p) => Math.max(1, p - 1))} aria-label="menos">−</button>
              <span className="stepper-val">{people}</span>
              <button onClick={() => setPeople((p) => Math.min(20, p + 1))} aria-label="más">+</button>
            </div>
          </label>
          <label className="field field--grow">
            <span>Fecha</span>
            <input type="text" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
        </div>
        <a className="btn-wa btn-gold--block" href={waUrl} target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2A10 10 0 0 0 3.5 17.2L2 22l4.9-1.5A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.6-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.6 0 1Z" /></svg>
          Reservar por WhatsApp
        </a>
        <p className="reserva-note">Te abrimos WhatsApp con tu mensaje listo para enviar.</p>
      </Reveal>
    </section>
  );
}

function SocialFooter() {
  return (
    <footer className="footer" data-screen-label="Footer">
      <div className="footer-leaf" aria-hidden="true">
        <svg viewBox="0 0 60 60" width="48" height="48"><path d="M30 6C18 16 12 30 16 44c2 7 8 10 14 10s12-3 14-10C48 30 42 16 30 6Z" fill="none" stroke="var(--gold)" strokeWidth="1.2" opacity="0.7" /><path d="M30 10v40M30 22c-5 2-9 6-12 11M30 22c5 2 9 6 12 11" fill="none" stroke="var(--gold)" strokeWidth="1" opacity="0.6" /></svg>
      </div>
      <h3 className="footer-name">BOTÁNICA</h3>
      <p className="footer-tag">{VENUE.tagline}</p>
      <div className="socials">
        <a href={VENUE.ig} target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
        </a>
        <a href={VENUE.fb} target="_blank" rel="noopener" aria-label="Facebook">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v6h3v-6h2.5l.5-3H13v-2c0-.6.4-1 1-1Z" /></svg>
        </a>
        <a href={`https://wa.me/${VENUE.whatsapp}`} target="_blank" rel="noopener" aria-label="WhatsApp">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2A10 10 0 0 0 3.5 17.2L2 22l4.9-1.5A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.6-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.6 0 1Z" /></svg>
        </a>
      </div>
      <p className="footer-credit">© 2026 Botánica Resto Bar · Hecho con cariño bajo las luces 🌿</p>
    </footer>
  );
}

Object.assign(window, { About, Gallery, Location, Reservas, SocialFooter });
