// ui.jsx — helpers compartidos (Reveal on-scroll, títulos de sección)
import { useState, useEffect, useRef } from 'react';

export function Reveal({ children, delay = 0, className = '', as = 'div' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.unobserve(el); } }),
      { threshold: 0.15, root: document.querySelector('.app-scroll') }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag = as;
  return (
    <Tag ref={ref} className={`reveal ${shown ? 'is-shown' : ''} ${className}`} style={{ transitionDelay: delay + 'ms' }}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ kicker, title }) {
  return (
    <div className="sec-title">
      {kicker && <span className="kicker"><span className="kicker-line" />{kicker}<span className="kicker-line" /></span>}
      <h2>{title}</h2>
    </div>
  );
}
