// Cierre.jsx — vista de "cierre del día" para hacer cuentas de todo lo vendido.
// Línea de tiempo cronológica inversa de batches con KPIs arriba y mini barra
// por 30 min con click-to-filter. Pensado para que Luz cierre la caja al final
// de la noche sin desencuadres.
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchSalesTimeline, rangePresets } from '../../../lib/analyticsApi.js';
import { money, formatTime, formatItemName } from '../../../lib/format.js';
import { Banknote, Smartphone, Ban, ChevronRight, RefreshCw } from '../../../lib/icons.jsx';

const COLORS = {
  primary: '#8a6a22', ok: '#1f7a3e', crit: '#b23636', blue: '#3b6ea5',
  muted: '#8b8b82', line: '#e8e8e2', text: '#1c1c1a',
};

// Bucket: 30 min. Devuelve labels "HH:00" / "HH:30".
function bucketKey(iso) {
  const d = new Date(iso);
  const half = d.getMinutes() < 30 ? 0 : 30;
  return `${String(d.getHours()).padStart(2, '0')}:${String(half).padStart(2, '0')}`;
}
function hourKey(iso) {
  return `${String(new Date(iso).getHours()).padStart(2, '0')}:00`;
}

function StatCard({ label, value, sub, accent = COLORS.primary, icon = null }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--s-line)', borderRadius: 12,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4,
      borderLeft: `4px solid ${accent}`, minWidth: 0,
    }}>
      <span style={{
        fontSize: 11.5, color: 'var(--s-muted)', textTransform: 'uppercase',
        letterSpacing: '.05em', display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        {icon}{label}
      </span>
      <strong style={{ fontSize: 22, color: 'var(--s-text)', fontFamily: 'var(--f-display)' }}>{value}</strong>
      {sub && <span style={{ fontSize: 12, color: 'var(--s-muted)' }}>{sub}</span>}
    </div>
  );
}

function Chip({ active, onClick, children, color = COLORS.primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600,
        border: `1.5px solid ${active ? color : 'var(--s-line)'}`,
        background: active ? color : '#fff',
        color: active ? '#fff' : 'var(--s-text)',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >{children}</button>
  );
}

export function Cierre() {
  const presets = useMemo(() => rangePresets(), []);
  const [presetKey, setPresetKey] = useState('today');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterServer, setFilterServer] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterBucket, setFilterBucket] = useState(null);
  const [openIds, setOpenIds] = useState(() => new Set());

  const range = presets[presetKey];

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchSalesTimeline(range.from, range.to);
      setRows(data ?? []);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range.from, range.to]);

  // Servidores únicos para los chips
  const servers = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.server_id)) m.set(r.server_id, r.server_name);
    }
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (filterServer !== 'all' && r.server_id !== filterServer) return false;
    if (filterMethod !== 'all' && r.payment_method !== filterMethod) return false;
    if (filterBucket && bucketKey(r.paid_at) !== filterBucket) return false;
    return true;
  }), [rows, filterServer, filterMethod, filterBucket]);

  // KPIs (sobre filtrados — útil cuando se aísla un mesero o un bucket)
  const kpis = useMemo(() => {
    let cash = 0, qr = 0, received = 0, cancelled = 0, batches = 0;
    for (const r of filtered) {
      const total = Number(r.total ?? 0);
      if (r.status === 'cancelled') { cancelled += total; continue; }
      batches++;
      if (r.payment_method === 'efectivo') {
        cash += total;
        if (r.received_amount != null) received += Number(r.received_amount);
      } else if (r.payment_method === 'qr') {
        qr += total;
      }
    }
    const change = Math.max(0, received - cash);
    const net = cash + qr;
    const avg = batches > 0 ? net / batches : 0;
    return { cash, qr, change, cancelled, net, batches, avg };
  }, [filtered]);

  // Buckets para el mini bar chart (todos los batches NO filtrados por bucket —
  // sí filtrados por mesero/método, para que el click-to-filter no se anule).
  const baseForBuckets = useMemo(() => rows.filter((r) => {
    if (filterServer !== 'all' && r.server_id !== filterServer) return false;
    if (filterMethod !== 'all' && r.payment_method !== filterMethod) return false;
    return r.status !== 'cancelled';
  }), [rows, filterServer, filterMethod]);

  const buckets = useMemo(() => {
    const map = new Map();
    for (const r of baseForBuckets) {
      const k = bucketKey(r.paid_at);
      const cur = map.get(k) ?? { bucket: k, total: 0, count: 0 };
      cur.total += Number(r.total ?? 0);
      cur.count++;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
  }, [baseForBuckets]);

  // Stream agrupado por hora (sticky headers)
  const groupedByHour = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const h = hourKey(r.paid_at);
      if (!map.has(h)) map.set(h, []);
      map.get(h).push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const toggleOpen = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="s-h2" style={{ margin: 0 }}>Cierre del día</h2>
          <p className="s-sub" style={{ margin: '2px 0 0' }}>
            Cuentas de todo lo cobrado en orden cronológico — para conciliar caja al final de la noche.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div role="tablist" style={{ display: 'inline-flex', gap: 6, background: '#fafaf9', padding: 4, borderRadius: 999, border: '1px solid var(--s-line)' }}>
            {Object.entries(presets).map(([k, v]) => (
              <button
                key={k}
                role="tab"
                aria-selected={presetKey === k}
                onClick={() => { setPresetKey(k); setFilterBucket(null); }}
                style={{
                  background: presetKey === k ? COLORS.primary : 'transparent',
                  color: presetKey === k ? '#fff' : 'var(--s-text)',
                  border: 'none', borderRadius: 999,
                  padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >{v.label}</button>
            ))}
          </div>
          <button onClick={load} disabled={loading} className="btn-ghost"
                  style={{ padding: '6px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} strokeWidth={1.8} aria-hidden="true" /> {loading ? '…' : 'Refrescar'}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: 'var(--s-crit-bg)', color: 'var(--s-crit)', padding: 12, borderRadius: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
        <StatCard
          label="Efectivo cobrado"
          value={`${money(kpis.cash)} Bs`}
          sub={kpis.change > 0 ? `recibido en mano ${money(kpis.cash + kpis.change)} Bs` : 'en caja'}
          accent={COLORS.ok}
          icon={<Banknote size={13} strokeWidth={1.8} />}
        />
        <StatCard
          label="QR cobrado"
          value={`${money(kpis.qr)} Bs`}
          sub="cuadrar con extracto"
          accent={COLORS.blue}
          icon={<Smartphone size={13} strokeWidth={1.8} />}
        />
        <StatCard
          label="Vuelto entregado"
          value={`${money(kpis.change)} Bs`}
          sub={kpis.change > 0 ? 'salida de caja' : 'sin vuelto'}
          accent={COLORS.primary}
        />
        <StatCard
          label="Cancelado"
          value={`${money(kpis.cancelled)} Bs`}
          sub={kpis.cancelled > 0 ? 'revisar motivo' : 'sin anulaciones'}
          accent={COLORS.crit}
          icon={<Ban size={13} strokeWidth={1.8} />}
        />
        <StatCard
          label="Total neto"
          value={`${money(kpis.net)} Bs`}
          sub={`${kpis.batches} tandas · ticket ${money(kpis.avg)} Bs`}
          accent={COLORS.text}
        />
      </div>

      {/* Mini barra por 30 min */}
      <section style={{
        background: '#fff', border: '1px solid var(--s-line)', borderRadius: 14, padding: 16,
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontFamily: 'var(--f-display)', color: 'var(--s-text)' }}>Ventas por franja de 30 min</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--s-muted)' }}>
              {filterBucket ? `Filtrado: ${filterBucket}–${nextHalf(filterBucket)}` : 'Tocá una barra para filtrar el stream'}
            </p>
          </div>
          {filterBucket && (
            <button onClick={() => setFilterBucket(null)} className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
              Limpiar filtro
            </button>
          )}
        </header>
        <div style={{ width: '100%', height: 180 }}>
          {buckets.length === 0 ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--s-muted)', fontSize: 13, fontStyle: 'italic' }}>
              Sin tandas cobradas en este rango
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={buckets} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="bucket" stroke={COLORS.muted} fontSize={11} tickLine={false} />
                <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false}
                       tickFormatter={(v) => money(v)} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid var(--s-line)', borderRadius: 8, fontSize: 12.5 }}
                  cursor={{ fill: 'rgba(138,106,34,.08)' }}
                  formatter={(v, _k, p) => [`${money(Number(v))} Bs`, `${p.payload.count} tandas`]}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}
                     onClick={(d) => setFilterBucket((cur) => cur === d.bucket ? null : d.bucket)}
                     style={{ cursor: 'pointer' }}>
                  {buckets.map((b) => (
                    <Cell key={b.bucket}
                          fill={filterBucket && filterBucket !== b.bucket ? '#d6cfba' : COLORS.primary} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Filtros */}
      {(servers.length > 1 || rows.some((r) => r.payment_method !== rows[0]?.payment_method)) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--s-muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
            Filtros
          </span>
          <Chip active={filterServer === 'all'} onClick={() => setFilterServer('all')}>Todos</Chip>
          {servers.map((s) => (
            <Chip key={s.id} active={filterServer === s.id} onClick={() => setFilterServer(s.id)}>{s.name}</Chip>
          ))}
          <span style={{ width: 1, height: 22, background: 'var(--s-line)', margin: '0 4px' }} />
          <Chip active={filterMethod === 'all'} onClick={() => setFilterMethod('all')}>Todos</Chip>
          <Chip active={filterMethod === 'efectivo'} onClick={() => setFilterMethod('efectivo')} color={COLORS.ok}>Efectivo</Chip>
          <Chip active={filterMethod === 'qr'} onClick={() => setFilterMethod('qr')} color={COLORS.blue}>QR</Chip>
        </div>
      )}

      {/* Stream cronológico inverso */}
      {loading && rows.length === 0 ? (
        <div className="s-empty">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="s-empty">
          <p>Sin tandas en este rango / filtro.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groupedByHour.map(([hour, batches]) => {
            const hourTotal = batches.filter((b) => b.status !== 'cancelled')
              .reduce((s, b) => s + Number(b.total ?? 0), 0);
            return (
              <section key={hour}>
                <h3 style={{
                  position: 'sticky', top: 0, zIndex: 1,
                  background: 'rgba(250,250,249,.96)', backdropFilter: 'blur(6px)',
                  fontSize: 12.5, color: 'var(--s-muted)', textTransform: 'uppercase',
                  letterSpacing: '.06em', margin: '0 0 8px 0', padding: '6px 4px', fontWeight: 700,
                  display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--s-line)',
                }}>
                  <span>{hour}</span>
                  <span>{batches.length} tandas · {money(hourTotal)} Bs</span>
                </h3>
                <div style={{
                  background: '#fff', border: '1px solid var(--s-line)', borderRadius: 12, overflow: 'hidden',
                }}>
                  {batches.map((b, i) => {
                    const open = openIds.has(b.batch_id);
                    const cancelled = b.status === 'cancelled';
                    const isCash = b.payment_method === 'efectivo';
                    const change = isCash && b.received_amount != null
                      ? Math.max(0, Number(b.received_amount) - Number(b.total))
                      : 0;
                    return (
                      <div key={b.batch_id} style={{
                        borderBottom: i < batches.length - 1 ? '1px solid var(--s-line-2)' : 'none',
                        background: cancelled ? '#fef2f2' : '#fff',
                      }}>
                        <button
                          type="button"
                          onClick={() => toggleOpen(b.batch_id)}
                          aria-expanded={open}
                          style={{
                            width: '100%', textAlign: 'left',
                            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                          }}
                        >
                          <ChevronRight size={16} strokeWidth={1.8}
                                        style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0, color: 'var(--s-muted)' }}
                                        aria-hidden="true" />
                          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--s-muted)', minWidth: 48 }}>
                            {formatTime(b.paid_at)}
                          </span>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                            background: isCash ? '#ecfdf5' : '#eff6ff',
                            color: isCash ? COLORS.ok : COLORS.blue,
                            border: `1px solid ${isCash ? '#a7f3d0' : '#bfdbfe'}`,
                          }}>
                            {isCash ? <Banknote size={11} strokeWidth={2} /> : <Smartphone size={11} strokeWidth={2} />}
                            {isCash ? 'Efectivo' : 'QR'}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: cancelled ? COLORS.crit : 'var(--s-text)' }}>
                            <strong style={{ fontWeight: 600 }}>{b.table_name ?? `Mesa ${b.table_id}`}</strong>
                            <span style={{ color: 'var(--s-muted)' }}> · {b.server_name}</span>
                            <span style={{ color: 'var(--s-muted)' }}> · {b.item_count} ítems</span>
                            {cancelled && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: COLORS.crit }}>CANCELADO</span>}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--f-display)', color: cancelled ? COLORS.crit : 'var(--s-text)' }}>
                            {money(b.total)} Bs
                          </span>
                        </button>
                        {open && (
                          <div style={{ padding: '0 14px 14px 40px', display: 'flex', flexDirection: 'column', gap: 6, background: '#fafaf9' }}>
                            <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {(b.items ?? []).map((it, idx) => (
                                <li key={idx} style={{ fontSize: 13, color: 'var(--s-text)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                  <span>
                                    <span style={{ fontFamily: 'var(--f-mono)', color: COLORS.primary, fontWeight: 600, marginRight: 6 }}>{it.qty}×</span>
                                    {formatItemName({
                                      product_name_snapshot: it.product_name,
                                      flavor_name_snapshot: it.flavor_name,
                                      flavor_name_snapshot_2: it.flavor_name_2,
                                    })}
                                  </span>
                                  <span style={{ color: 'var(--s-muted)', fontFamily: 'var(--f-mono)', fontSize: 12.5 }}>
                                    {money(Number(it.unit_price) * Number(it.qty))} Bs
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {(isCash && b.received_amount != null) && (
                              <div style={{ fontSize: 12, color: 'var(--s-muted)', marginTop: 4, paddingTop: 8, borderTop: '1px dashed var(--s-line)' }}>
                                Recibido en mano <strong style={{ color: 'var(--s-text)' }}>{money(b.received_amount)} Bs</strong> · Vuelto entregado <strong style={{ color: 'var(--s-text)' }}>{money(change)} Bs</strong>
                              </div>
                            )}
                            {b.ready_at && (
                              <div style={{ fontSize: 11.5, color: 'var(--s-muted)', marginTop: 2 }}>
                                Listo {formatTime(b.ready_at)}
                                {b.delivered_at && ` · Entregado ${formatTime(b.delivered_at)}`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// "20:30" -> "21:00", "20:00" -> "20:30"
function nextHalf(bucket) {
  const [h, m] = bucket.split(':').map(Number);
  if (m === 0) return `${String(h).padStart(2, '0')}:30`;
  return `${String((h + 1) % 24).padStart(2, '0')}:00`;
}
