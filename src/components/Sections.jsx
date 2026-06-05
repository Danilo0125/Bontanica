// Sections.jsx — About, Galería, Ubicación, Reservas, Footer
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { VENUE } from '../data/data.js';
import { Reveal, SectionTitle } from './ui.jsx';
import { Leaf } from '../lib/icons.jsx';

export function About() {
  return (
    <section className="section section--about" data-screen-label="Nosotros">
      <Reveal>
        <span className="kicker"><span className="kicker-line" />Botánica<span className="kicker-line" /></span>
        <p className="about-text">{VENUE.about}</p>
      </Reveal>
    </section>
  );
}

// Galería del local. Distribución de spans elegida para crear ritmo visual
// (alto / ancho / cuadrado) sobre el grid de 2 columnas.
const GALLERY = [
  { id: 'g1', span: 'tall', src: '/assets/Pasillo_de arboles_con_luces.jpeg', alt: 'Pasillo de árboles con luces cálidas' },
  { id: 'g2', span: '',     src: '/assets/Plantas01.jpeg',                    alt: 'Plantas del jardín' },
  { id: 'g3', span: '',     src: '/assets/Camino01.jpeg',                     alt: 'Camino entre las plantas' },
  { id: 'g4', span: 'wide', src: '/assets/Patio.jpeg',                        alt: 'Vista del patio principal' },
  { id: 'g5', span: 'tall', src: '/assets/Pasillo02.jpeg',                    alt: 'Otro pasillo iluminado' },
  { id: 'g6', span: '',     src: '/assets/Plantas02.jpeg',                    alt: 'Detalle de las plantas' },
  { id: 'g7', span: '',     src: '/assets/Plantas03.jpeg',                    alt: 'Rincón con vegetación' },
  { id: 'g8', span: 'wide', src: '/assets/Patio01.jpeg',                      alt: 'Patio al caer la noche' },
  { id: 'g9', span: '',     src: '/assets/Pasillo021.jpeg',                   alt: 'Pasillo con luces cálidas' },
  { id: 'g10', span: '',    src: '/assets/Plantas04.jpeg',                    alt: 'Más plantas del jardín' },
  { id: 'g11', span: 'wide', src: '/assets/Parqueo01.jpeg',                   alt: 'Entrada y parqueo del local' },
];

export function Gallery() {
  return (
    <section className="section section--gallery" id="galeria" data-screen-label="Galería">
      <SectionTitle kicker="Galería" title="Noches en Botánica" />
      <Reveal className="gallery-grid">
        {GALLERY.map((g) =>
          g.src ? (
            <figure key={g.id} className={`g-slot g-${g.span} g-figure`}>
              <img src={g.src} alt={g.alt} loading="lazy" />
              <figcaption>{g.alt}</figcaption>
            </figure>
          ) : (
            <div key={g.id} className={`g-slot g-${g.span} g-placeholder`} aria-label={g.ph}>
              <span className="g-placeholder-leaf" aria-hidden="true">
                <Leaf size={28} strokeWidth={1.5} />
              </span>
              <span className="g-placeholder-text">{g.ph}</span>
            </div>
          )
        )}
      </Reveal>
    </section>
  );
}

function MapEmbed() {
  return (
    <iframe
      className="map-iframe"
      src={VENUE.mapsEmbedUrl}
      title="Ubicación de Botánica RestoBar en Google Maps"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}

export function Location() {
  return (
    <section className="section section--location" id="ubicacion" data-screen-label="Ubicación">
      <SectionTitle kicker="Cómo llegar" title="Encuéntranos" />
      <Reveal className="map-card">
        <MapEmbed />
        <div className="map-info">
          <h3>Botánica RestoBar</h3>
          <p className="map-addr">{VENUE.address}</p>
          <div className="map-hours"><span className="dot" /> {VENUE.eventDate} · {VENUE.eventTime.toLowerCase()}</div>
          <a className="btn-gold btn-gold--block" href={VENUE.mapsUrl} target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7Z" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
            Abrir en Google Maps
          </a>
        </div>
      </Reveal>
    </section>
  );
}

// Fecha por defecto: el evento, o hoy si ya pasó.
const DEFAULT_DATE = (() => {
  const event = VENUE.eventTargetISO?.slice(0, 10) ?? '';
  const today = new Date().toISOString().slice(0, 10);
  return event && event >= today ? event : today;
})();

function formatHumanDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch { return iso; }
}

export function Reservas() {
  const [name, setName] = useState('');
  const [people, setPeople] = useState(2);
  const [when, setWhen] = useState(DEFAULT_DATE);
  const todayISO = new Date().toISOString().slice(0, 10);
  const msg = encodeURIComponent(
    `¡Hola Botánica! Quiero reservar una mesa.\n\nNombre: ${name || '—'}\nPersonas: ${people}\nFecha: ${formatHumanDate(when)}`
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
            <input type="date" value={when} min={todayISO}
                   onChange={(e) => setWhen(e.target.value)} />
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

export function SocialFooter() {
  const year = new Date().getFullYear();
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
      <p className="footer-credit">© {year} Botánica RestoBar · Hecho con cariño bajo las luces 🌿</p>
      <Link to="/caja" className="footer-staff">Personal · Caja</Link>
    </footer>
  );
}
