// PublicLayout.jsx — landing pública (lo que antes era todo el App.jsx).
// Nota: el acceso a /caja NO se enlaza desde la UI pública. Es por seguridad
// social: el personal entra escribiendo la ruta directamente.
import { useState, useEffect, useRef } from 'react';
import { Hero } from './Hero.jsx';
import { Catalog } from './Catalog.jsx';
import { About, Gallery, Location, Reservas, SocialFooter } from './Sections.jsx';

const HERO_STYLE = 'vitral';

const NAV = [
  { id: 'inicio', label: 'Inicio', icon: 'M3 11l9-8 9 8M5 10v10h14V10' },
  { id: 'carta', label: 'Carta', icon: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4ZM8 8h8M8 12h8M8 16h5' },
  { id: 'galeria', label: 'Galería', icon: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M9 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z' },
  { id: 'ubicacion', label: 'Mapa', icon: 'M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z' },
];

export function PublicLayout() {
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('inicio');
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ids = NAV.map((n) => n.id).concat(['reservas']);
    const onScroll = () => {
      setScrolled(el.scrollTop > 320);
      const probe = el.scrollTop + window.innerHeight * 0.4;
      let cur = 'inicio';
      for (const id of ids) {
        const sec = document.getElementById(id);
        if (sec && sec.offsetTop <= probe) cur = id;
      }
      setActiveNav(cur);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    const el = scrollRef.current;
    const sec = document.getElementById(id);
    if (!el) return;
    if (id === 'inicio' || !sec) { el.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    el.scrollTo({ top: sec.offsetTop - 8, behavior: 'smooth' });
  };

  return (
    <>
      <div className={`topbar ${scrolled ? 'is-shown' : ''}`}>
        <span className="topbar-name" onClick={() => scrollTo('inicio')}>BOTÁNICA</span>
        <button className="topbar-cta" onClick={() => scrollTo('reservas')}>Reservar</button>
      </div>

      <div className="app-scroll" ref={scrollRef}>
        <Hero heroStyle={HERO_STYLE} onReserve={() => scrollTo('reservas')} onScrollDown={() => scrollTo('carta')} />
        <About />
        <Catalog />
        <Gallery />
        <Location />
        <Reservas />
        <SocialFooter />
        <div className="scroll-pad" />
      </div>

      <nav className="bottom-nav">
        {NAV.map((n) => (
          <button key={n.id} className={`nav-item ${activeNav === n.id ? 'is-active' : ''}`} onClick={() => scrollTo(n.id)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
