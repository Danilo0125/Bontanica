// app.jsx — App shell: navegación, top-bar, overlay de caja, tweaks
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "heroStyle": "Jardín",
  "gold": ["#d8b56a", "#f0d99a", "#b8923f"],
  "leaves": true
}/*EDITMODE-END*/;

const STYLE_MAP = { "Jardín": "jardin", "Vitral": "vitral", "Selva": "selva" };

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [cobroOpen, setCobroOpen] = useStateA(false);
  const [scrolled, setScrolled] = useStateA(false);
  const [activeNav, setActiveNav] = useStateA("inicio");
  const scrollRef = useRefA(null);

  // apply gold palette tweak
  useEffectA(() => {
    const r = document.documentElement;
    const g = t.gold || TWEAK_DEFAULTS.gold;
    r.style.setProperty("--gold", g[0]);
    r.style.setProperty("--gold-bright", g[1]);
    r.style.setProperty("--gold-deep", g[2]);
  }, [t.gold]);

  useEffectA(() => {
    document.documentElement.classList.toggle("no-leaves", !t.leaves);
  }, [t.leaves]);

  const heroStyle = STYLE_MAP[t.heroStyle] || "jardin";

  // track scroll for top bar + active section
  useEffectA(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ids = ["inicio", "carta", "galeria", "ubicacion", "reservas"];
    const onScroll = () => {
      setScrolled(el.scrollTop > 320);
      const probe = el.scrollTop + window.innerHeight * 0.4;
      let cur = "inicio";
      for (const id of ids) {
        const sec = document.getElementById(id);
        if (sec && sec.offsetTop <= probe) cur = id;
      }
      setActiveNav(cur);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) => {
    const el = scrollRef.current;
    const sec = document.getElementById(id);
    if (!el) return;
    if (id === "inicio" || !sec) { el.scrollTo({ top: 0, behavior: "smooth" }); return; }
    el.scrollTo({ top: sec.offsetTop - 8, behavior: "smooth" });
  };

  const NAV = [
    { id: "inicio", label: "Inicio", icon: "M3 11l9-8 9 8M5 10v10h14V10" },
    { id: "carta", label: "Carta", icon: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4ZM8 8h8M8 12h8M8 16h5" },
    { id: "galeria", label: "Galería", icon: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M9 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" },
    { id: "ubicacion", label: "Mapa", icon: "M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" },
  ];

  return (
    <>
      {/* Top mini-bar */}
      <div className={`topbar ${scrolled ? "is-shown" : ""}`}>
        <span className="topbar-name" onClick={() => scrollTo("inicio")}>BOTÁNICA</span>
        <button className="topbar-cta" onClick={() => scrollTo("reservas")}>Reservar</button>
      </div>

      <div className="app-scroll" ref={scrollRef}>
        <Hero heroStyle={heroStyle} onReserve={() => scrollTo("reservas")} onScrollDown={() => scrollTo("carta")} />
        <About />
        <Catalog />
        <Gallery />
        <Location />
        <Reservas />
        <SocialFooter />
        <div className="scroll-pad" />
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {NAV.map((n) => (
          <button key={n.id} className={`nav-item ${activeNav === n.id ? "is-active" : ""}`} onClick={() => scrollTo(n.id)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
            <span>{n.label}</span>
          </button>
        ))}
        <button className="nav-item nav-caja" onClick={() => setCobroOpen(true)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16v12H4zM4 7l2-3h12l2 3M9 12h6" /></svg>
          <span>Caja</span>
        </button>
      </nav>

      <Cobro open={cobroOpen} onClose={() => setCobroOpen(false)} />

      {/* Tweaks */}
      <TweaksPanel>
        <TweakSection label="Estilo del hero" />
        <TweakRadio label="Atmósfera" value={t.heroStyle} options={["Jardín", "Vitral", "Selva"]} onChange={(v) => setTweak("heroStyle", v)} />
        <TweakSection label="Marca" />
        <TweakColor label="Tono dorado" value={t.gold}
          options={[["#d8b56a", "#f0d99a", "#b8923f"], ["#e8c36b", "#f7e3a0", "#c79a3a"], ["#cdb98a", "#ece0bf", "#a8946a"]]}
          onChange={(v) => setTweak("gold", v)} />
        <TweakToggle label="Hojas flotantes" value={t.leaves} onChange={(v) => setTweak("leaves", v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
