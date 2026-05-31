// ui.jsx — helpers compartidos (Reveal on-scroll, títulos de sección)
const { useState: useStateU, useEffect: useEffectU, useRef: useRefU } = React;

function Reveal({ children, delay = 0, className = "", as = "div" }) {
  const ref = useRefU(null);
  const [shown, setShown] = useStateU(false);
  useEffectU(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.unobserve(el); } }),
      { threshold: 0.15, root: document.querySelector(".app-scroll") }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag = as;
  return (
    <Tag ref={ref} className={`reveal ${shown ? "is-shown" : ""} ${className}`} style={{ transitionDelay: delay + "ms" }}>
      {children}
    </Tag>
  );
}

function SectionTitle({ kicker, title }) {
  return (
    <div className="sec-title">
      {kicker && <span className="kicker"><span className="kicker-line" />{kicker}<span className="kicker-line" /></span>}
      <h2>{title}</h2>
    </div>
  );
}

Object.assign(window, { Reveal, SectionTitle });
