// Hero.jsx — Hero animado con 3 variaciones de estilo
import { useState, useEffect, useRef } from 'react';
import { VENUE } from '../data/data.js';

function useCountdown(targetISO) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = new Date(targetISO).getTime();
  let diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000); diff -= d * 86400000;
  const h = Math.floor(diff / 3600000); diff -= h * 3600000;
  const m = Math.floor(diff / 60000); diff -= m * 60000;
  const s = Math.floor(diff / 1000);
  return { d, h, m, s, done: target - now <= 0 };
}

function CountdownUnit({ value, label }) {
  return (
    <div className="cd-unit">
      <span className="cd-num">{String(value).padStart(2, '0')}</span>
      <span className="cd-lbl">{label}</span>
    </div>
  );
}

const LIGHTS = [
  { l: 8, t: 64, s: 1.1, dur: 3.4, d: 0 }, { l: 22, t: 78, s: 0.7, dur: 4.1, d: 0.6 },
  { l: 30, t: 58, s: 0.9, dur: 3.0, d: 1.2 }, { l: 44, t: 70, s: 1.3, dur: 4.6, d: 0.2 },
  { l: 52, t: 82, s: 0.6, dur: 3.7, d: 1.8 }, { l: 63, t: 60, s: 1.0, dur: 4.0, d: 0.9 },
  { l: 74, t: 74, s: 0.8, dur: 3.3, d: 0.4 }, { l: 86, t: 66, s: 1.2, dur: 4.4, d: 1.5 },
  { l: 92, t: 80, s: 0.7, dur: 3.8, d: 0.7 }, { l: 16, t: 52, s: 0.6, dur: 4.2, d: 2.1 },
  { l: 38, t: 86, s: 0.9, dur: 3.1, d: 1.0 }, { l: 68, t: 88, s: 0.7, dur: 4.3, d: 0.3 },
];

const LeafSVG = ({ style, className }) => (
  <svg className={className} style={style} viewBox="0 0 32 40" width="26" height="32" aria-hidden="true">
    <path d="M16 2C9 9 4 18 4 27c0 7 5 11 12 11s12-4 12-11C28 18 23 9 16 2Z"
      fill="none" stroke="var(--gold)" strokeWidth="1.1" opacity="0.55" />
    <path d="M16 5v30M16 12c-3 1-6 3-8 6M16 12c3 1 6 3 8 6M16 22c-3 1-5 3-7 6M16 22c3 1 5 3 7 6"
      fill="none" stroke="var(--gold)" strokeWidth="0.9" opacity="0.5" />
  </svg>
);

const Frond = ({ side }) => (
  <svg className={`frond frond-${side}`} viewBox="0 0 200 320" aria-hidden="true">
    <g fill="none" stroke="var(--gold)" strokeWidth="1.4" opacity="0.4">
      <path d="M100 320C70 250 60 170 80 90 88 56 100 28 100 10" />
      {Array.from({ length: 9 }).map((_, i) => {
        const y = 40 + i * 28; const len = 60 - i * 4;
        return <g key={i}>
          <path d={`M${100 - i * 2} ${y}c-${len} -10 -${len + 10} 6 -${len + 18} 26`} />
          <path d={`M${100 + i * 2} ${y}c${len} -10 ${len + 10} 6 ${len + 18} 26`} />
        </g>;
      })}
    </g>
  </svg>
);

export function Hero({ heroStyle, onReserve, onScrollDown }) {
  const { d, h, m, s, done } = useCountdown(VENUE.eventTargetISO);
  const heroRef = useRef(null);

  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const root = document.querySelector('.app-scroll');
    if (!root) return;
    const onScroll = () => setScrollY(root.scrollTop);
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className={`hero hero--${heroStyle}`} ref={heroRef} data-screen-label="Inicio">
      <div className="hero-bg" style={{ transform: `translateY(${scrollY * 0.18}px) scale(1.04)` }} />
      <div className="hero-vignette" />

      {heroStyle === 'vitral' && <div className="hero-sweep" />}
      {heroStyle === 'vitral' && <div className="hero-frame" />}
      {heroStyle === 'selva' && <div className="hero-glow" />}
      {heroStyle === 'selva' && <><Frond side="l" /><Frond side="r" /></>}

      <div className="lights">
        {LIGHTS.map((p, i) => (
          <span key={i} className="light"
            style={{ left: p.l + '%', top: p.t + '%', '--ls': p.s, animationDuration: p.dur + 's', animationDelay: p.d + 's' }} />
        ))}
      </div>

      <div className="leaves">
        {[12, 34, 56, 72, 88].map((l, i) => (
          <LeafSVG key={i} className="leaf"
            style={{ left: l + '%', animationDuration: 9 + i * 2 + 's', animationDelay: i * 1.7 + 's' }} />
        ))}
      </div>

      <div className="hero-content">
        <h1 className="hero-event-title">{VENUE.eventTitle}</h1>
        <div className="event-chip">
          <span className="dot" />
          {VENUE.eventDate} · {VENUE.eventTime}
        </div>
        {!done ? (
          <div className="countdown">
            <CountdownUnit value={d} label="días" />
            <span className="cd-sep">:</span>
            <CountdownUnit value={h} label="hrs" />
            <span className="cd-sep">:</span>
            <CountdownUnit value={m} label="min" />
            <span className="cd-sep">:</span>
            <CountdownUnit value={s} label="seg" />
          </div>
        ) : (
          <div className="countdown countdown--live"><span className="live-dot" /> Estamos abiertos · ¡Te esperamos!</div>
        )}

        <button className="btn-gold" onClick={onReserve}>Reservar mesa</button>

        <button className="scroll-cue" onClick={onScrollDown} aria-label="Ver más">
          <span>Explorar</span>
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </section>
  );
}
