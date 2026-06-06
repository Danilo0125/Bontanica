// Analytics.jsx — dashboard de admin con KPIs + 4 charts.
// Usa recharts. Tema blanco con paleta cálida del staff.
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  fetchKpis, fetchTopProducts, fetchTopVariants, fetchRevenueByDay, fetchRevenueByHour,
  fetchServerPerformance, fetchKitchenTimes, rangePresets,
} from '../../../lib/analyticsApi.js';
import { money } from '../../../lib/format.js';

// Paleta alineada al tema blanco del staff
const COLORS = {
  primary:   '#8a6a22',
  primarySoft: '#c9a85f',
  ok:        '#1f7a3e',
  crit:      '#b23636',
  blue:      '#3b6ea5',
  orange:    '#c2410c',
  muted:     '#8b8b82',
  line:      '#e8e8e2',
  text:      '#1c1c1a',
};

const SERVER_PALETTE = [COLORS.primary, COLORS.ok, COLORS.blue, COLORS.orange, COLORS.crit];

function StatCard({ label, value, sub, accent = COLORS.primary }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--s-line)', borderRadius: 12,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4,
      borderLeft: `4px solid ${accent}`,
    }}>
      <span style={{ fontSize: 12, color: 'var(--s-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {label}
      </span>
      <strong style={{ fontSize: 22, color: 'var(--s-text)', fontFamily: 'var(--f-display)' }}>{value}</strong>
      {sub && <span style={{ fontSize: 12, color: 'var(--s-muted)' }}>{sub}</span>}
    </div>
  );
}

function Panel({ title, sub, height = 280, children, action }) {
  return (
    <section style={{
      background: '#fff', border: '1px solid var(--s-line)', borderRadius: 14,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
    }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15.5, fontFamily: 'var(--f-display)', color: 'var(--s-text)' }}>{title}</h3>
          {sub && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--s-muted)' }}>{sub}</p>}
        </div>
        {action}
      </header>
      <div style={{ width: '100%', height }}>{children}</div>
    </section>
  );
}

function tooltipStyle() {
  return {
    background: '#fff', border: '1px solid var(--s-line)', borderRadius: 8,
    fontSize: 12.5, color: COLORS.text,
    boxShadow: '0 8px 24px rgba(0,0,0,.08)',
  };
}

export function Analytics() {
  const presets = useMemo(() => rangePresets(), []);
  const [presetKey, setPresetKey] = useState('today');
  const [productMode, setProductMode] = useState('units'); // 'units' | 'revenue'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [topVariants, setTopVariants] = useState([]);
  const [byDay, setByDay] = useState([]);
  const [byHour, setByHour] = useState([]);
  const [servers, setServers] = useState([]);
  const [kitchen, setKitchen] = useState([]);

  const range = presets[presetKey];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const [k, p, tv, d, h, s, kt] = await Promise.all([
          fetchKpis(range.from, range.to),
          fetchTopProducts(range.from, range.to, 10),
          fetchTopVariants(range.from, range.to, 10),
          fetchRevenueByDay(range.from, range.to),
          fetchRevenueByHour(range.from, range.to),
          fetchServerPerformance(range.from, range.to),
          fetchKitchenTimes(range.from, range.to),
        ]);
        if (cancelled) return;
        setKpis(k); setTopProducts(p); setTopVariants(tv); setByDay(d); setByHour(h);
        setServers(s); setKitchen(kt);
      } catch (e) {
        if (!cancelled) setError(e.message ?? String(e));
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [range.from, range.to]);

  // Hour chart: hidratar 0-23 con ceros para mostrar todas las horas
  const hourData = useMemo(() => {
    const byH = new Map(byHour.map((r) => [r.hour, r]));
    return Array.from({ length: 24 }, (_, h) => {
      const r = byH.get(h);
      return {
        hour: `${String(h).padStart(2, '0')}h`,
        revenue: Number(r?.revenue ?? 0),
        batches: Number(r?.batches ?? 0),
      };
    });
  }, [byHour]);

  const dayData = useMemo(() => byDay.map((r) => ({
    day: new Date(r.day).toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric' }),
    revenue: Number(r.revenue),
    batches: Number(r.batches),
  })), [byDay]);

  const topData = useMemo(() => topProducts.map((r) => ({
    name: r.product_name,
    units: Number(r.units),
    revenue: Number(r.revenue),
  })), [topProducts]);

  const topVariantData = useMemo(() => topVariants.map((r) => ({
    name: `${r.product_name} · ${r.variant_name}`,
    units: Number(r.units),
    revenue: Number(r.revenue),
  })), [topVariants]);

  const serverData = useMemo(() => servers.map((r) => ({
    name: r.full_name ?? r.server_id,
    batches: Number(r.batches),
    revenue: Number(r.revenue),
    avg_ticket: Number(r.avg_ticket),
    items: Number(r.items),
    tables: Number(r.tables_served),
  })), [servers]);

  // Histograma de tiempos de cocina (buckets de 2 min hasta 20+)
  const kitchenStats = useMemo(() => {
    if (!kitchen.length) return { avg: 0, median: 0, p90: 0, max: 0, buckets: [] };
    const mins = kitchen.map((k) => Number(k.minutes)).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
    const avg = mins.reduce((s, x) => s + x, 0) / mins.length;
    const median = mins[Math.floor(mins.length / 2)];
    const p90 = mins[Math.floor(mins.length * 0.9)] ?? mins[mins.length - 1];
    const max = mins[mins.length - 1];
    const buckets = Array.from({ length: 11 }, (_, i) => ({
      label: i === 10 ? '20+' : `${i * 2}-${i * 2 + 2}`,
      count: 0,
    }));
    for (const m of mins) {
      const idx = Math.min(10, Math.floor(m / 2));
      buckets[idx].count++;
    }
    return { avg, median, p90, max, buckets };
  }, [kitchen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="s-h2" style={{ margin: 0 }}>Analíticas</h2>
          <p className="s-sub" style={{ margin: '2px 0 0' }}>
            Ventas, productos, performance del equipo y tiempos de cocina.
          </p>
        </div>
        <div role="tablist" style={{ display: 'inline-flex', gap: 6, background: '#fafaf9', padding: 4, borderRadius: 999, border: '1px solid var(--s-line)' }}>
          {Object.entries(presets).map(([k, v]) => (
            <button
              key={k}
              role="tab"
              aria-selected={presetKey === k}
              onClick={() => setPresetKey(k)}
              style={{
                background: presetKey === k ? COLORS.primary : 'transparent',
                color: presetKey === k ? '#fff' : 'var(--s-text)',
                border: 'none', borderRadius: 999,
                padding: '6px 12px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}
            >{v.label}</button>
          ))}
        </div>
      </header>

      {error && (
        <div style={{ background: 'var(--s-crit-bg)', color: 'var(--s-crit)', padding: 12, borderRadius: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <StatCard label="Revenue" value={`${money(Number(kpis?.revenue ?? 0))} Bs`} sub={loading ? '…' : `${kpis?.batches ?? 0} tandas`} accent={COLORS.primary} />
        <StatCard label="Ticket promedio" value={`${money(Number(kpis?.avg_ticket ?? 0))} Bs`} sub={loading ? '…' : 'por tanda'} accent={COLORS.ok} />
        <StatCard label="Ítems vendidos" value={Number(kpis?.items ?? 0)} sub={loading ? '…' : `en ${kpis?.active_tables ?? 0} mesas`} accent={COLORS.blue} />
        <StatCard label="Mesa promedio" value={`${money(Number(kpis?.active_tables) > 0 ? Number(kpis.revenue) / Number(kpis.active_tables) : 0)} Bs`} sub={loading ? '…' : 'por mesa atendida'} accent={COLORS.orange} />
        <StatCard label="Tiempo cocina" value={`${kitchenStats.avg.toFixed(1)} min`} sub={loading ? '…' : `mediana ${kitchenStats.median?.toFixed(1) ?? '–'} · p90 ${kitchenStats.p90?.toFixed(1) ?? '–'}`} accent={COLORS.crit} />
        <StatCard label="Personal activo" value={Number(kpis?.distinct_servers ?? 0)} sub={loading ? '…' : 'en este rango'} accent={COLORS.muted} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Panel
          title="Productos más vendidos"
          sub={productMode === 'units' ? 'Top 10 por unidades' : 'Top 10 por revenue'}
          height={Math.max(220, topData.length * 32)}
          action={
            <div style={{ display: 'inline-flex', gap: 4, background: '#fafaf9', borderRadius: 999, padding: 3, border: '1px solid var(--s-line)' }}>
              {['units', 'revenue'].map((m) => (
                <button key={m} onClick={() => setProductMode(m)}
                  style={{
                    background: productMode === m ? COLORS.primary : 'transparent',
                    color: productMode === m ? '#fff' : 'var(--s-muted)',
                    border: 'none', borderRadius: 999, padding: '4px 10px',
                    fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                  }}>{m === 'units' ? 'Unidades' : 'Bs'}</button>
              ))}
            </div>
          }
        >
          {topData.length === 0 ? (
            <EmptyChart text="Sin ventas en este rango" />
          ) : (
            <ResponsiveContainer>
              <BarChart data={topData} layout="vertical" margin={{ top: 6, right: 20, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} horizontal={false} />
                <XAxis type="number" stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke={COLORS.text} fontSize={12} tickLine={false} axisLine={false} width={120} />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  cursor={{ fill: 'rgba(138,106,34,.08)' }}
                  formatter={(v) => productMode === 'revenue' ? `${money(Number(v))} Bs` : `${v} u`}
                />
                <Bar dataKey={productMode} fill={COLORS.primary} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel
          title="Top sabores / variantes"
          sub={`Las variantes más vendidas (incluye sabor)`}
          height={Math.max(220, topVariantData.length * 32)}
        >
          {topVariantData.length === 0 ? (
            <EmptyChart text="Sin ventas con variantes en este rango" />
          ) : (
            <ResponsiveContainer>
              <BarChart data={topVariantData} layout="vertical" margin={{ top: 6, right: 20, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} horizontal={false} />
                <XAxis type="number" stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke={COLORS.text} fontSize={11.5} tickLine={false} axisLine={false} width={170} />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  cursor={{ fill: 'rgba(59,110,165,.08)' }}
                  formatter={(v, _k, payload) => [
                    productMode === 'revenue' ? `${money(Number(v))} Bs` : `${v} u`,
                    `${payload.payload.units} u · ${money(payload.payload.revenue)} Bs`,
                  ]}
                />
                <Bar dataKey={productMode} fill={COLORS.blue} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Revenue por día" sub="Total cobrado por día (zona horaria Bolivia)" height={260}>
          {dayData.length === 0 ? (
            <EmptyChart text="Sin datos para graficar" />
          ) : (
            <ResponsiveContainer>
              <LineChart data={dayData} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} />
                <XAxis dataKey="day" stroke={COLORS.muted} fontSize={11} tickLine={false} />
                <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle()} formatter={(v, k) => k === 'revenue' ? `${money(Number(v))} Bs` : `${v} tandas`} />
                <Line type="monotone" dataKey="revenue" stroke={COLORS.primary} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.primary }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Hora pico" sub="Tandas cobradas por hora del día" height={240}>
          <ResponsiveContainer>
            <BarChart data={hourData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="hour" stroke={COLORS.muted} fontSize={10} tickLine={false} interval={1} />
              <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle()} formatter={(v) => `${v} tandas`} />
              <Bar dataKey="batches" fill={COLORS.blue} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Performance por mesero" sub="Revenue por persona" height={Math.max(220, serverData.length * 60)}>
          {serverData.length === 0 ? (
            <EmptyChart text="Sin tandas cobradas en este rango" />
          ) : (
            <ResponsiveContainer>
              <BarChart data={serverData} layout="vertical" margin={{ top: 6, right: 20, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} horizontal={false} />
                <XAxis type="number" stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke={COLORS.text} fontSize={12} tickLine={false} axisLine={false} width={90} />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  cursor={{ fill: 'rgba(31,122,62,.08)' }}
                  formatter={(v, _k, payload) => [
                    `${money(Number(v))} Bs`,
                    `${payload.payload.batches} tandas · ticket avg ${money(payload.payload.avg_ticket)} Bs`,
                  ]}
                />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                  {serverData.map((_, i) => (
                    <Cell key={i} fill={SERVER_PALETTE[i % SERVER_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Tiempos de cocina" sub={`Distribución (minutos desde cobro hasta listo) · n=${kitchen.length}`} height={240}>
          {kitchen.length === 0 ? (
            <EmptyChart text="Aún no hay tandas marcadas como listas" />
          ) : (
            <ResponsiveContainer>
              <BarChart data={kitchenStats.buckets} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="label" stroke={COLORS.muted} fontSize={11} tickLine={false} />
                <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle()} formatter={(v) => `${v} tandas`} labelFormatter={(l) => `${l} min`} />
                <Bar dataKey="count" fill={COLORS.crit} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Detalle por mesero" sub="Mesas atendidas, ítems y ticket promedio" height="auto">
          {serverData.length === 0 ? (
            <EmptyChart text="Sin datos" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--s-muted)', fontWeight: 500 }}>
                    <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line)' }}>Mesero</th>
                    <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line)', textAlign: 'right' }}>Tandas</th>
                    <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line)', textAlign: 'right' }}>Mesas</th>
                    <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line)', textAlign: 'right' }}>Ítems</th>
                    <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line)', textAlign: 'right' }}>Ticket avg</th>
                    <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line)', textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {serverData.map((s) => (
                    <tr key={s.name}>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line-2)', fontWeight: 600 }}>{s.name}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line-2)', textAlign: 'right' }}>{s.batches}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line-2)', textAlign: 'right' }}>{s.tables}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line-2)', textAlign: 'right' }}>{s.items}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line-2)', textAlign: 'right' }}>{money(s.avg_ticket)} Bs</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--s-line-2)', textAlign: 'right', fontWeight: 600, color: COLORS.primary }}>{money(s.revenue)} Bs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function EmptyChart({ text }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--s-muted)', fontSize: 13, fontStyle: 'italic',
    }}>{text}</div>
  );
}
