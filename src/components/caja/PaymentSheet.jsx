// PaymentSheet.jsx — bottom-sheet de cobro (efectivo / QR).
import { useState } from 'react';
import { money } from '../../lib/format.js';
import { payOrder } from '../../lib/orderApi.js';

export function PaymentSheet({ order, total, onClose, onPaid }) {
  const [step, setStep] = useState('choose'); // 'choose' | 'efectivo' | 'qr'
  const [received, setReceived] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const change = step === 'efectivo' && received !== '' ? Number(received) - total : null;

  const finish = async (method) => {
    try {
      setSubmitting(true);
      setError(null);
      await payOrder(order.id, {
        method,
        received: method === 'efectivo' ? Number(received) : null,
        total,
      });
      onPaid({ method, total });
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="pay-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {step === 'choose' && (
          <>
            <h3 className="sheet-title">Cobrar {money(total)} Bs</h3>
            <p className="sheet-sub">Selecciona el método de pago</p>
            <div className="pay-methods">
              <button className="pay-opt" onClick={() => setStep('efectivo')}>
                <span className="pay-ico">💵</span><span>Efectivo</span>
              </button>
              <button className="pay-opt" onClick={() => setStep('qr')}>
                <span className="pay-ico">📱</span><span>QR / Transferencia</span>
              </button>
            </div>
          </>
        )}
        {step === 'efectivo' && (
          <>
            <h3 className="sheet-title">Efectivo</h3>
            <p className="sheet-sub">Total a cobrar: <strong>{money(total)} Bs</strong></p>
            <label className="field">
              <span>¿Con cuánto paga?</span>
              <input type="number" inputMode="numeric" value={received}
                     onChange={(e) => setReceived(e.target.value)} placeholder="0" autoFocus />
            </label>
            {change !== null && received !== '' && (
              <div className={`vuelto ${change < 0 ? 'neg' : ''}`}>
                {change < 0 ? `Faltan ${money(Math.abs(change))} Bs` : `Vuelto: ${money(change)} Bs`}
              </div>
            )}
            <div className="quick-cash">
              {[total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100]
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((v) => (
                  <button key={v} onClick={() => setReceived(String(v))}>{money(v)}</button>
                ))}
            </div>
            {error && <p className="caja-error">{error}</p>}
            <button className="btn-gold btn-gold--block"
                    disabled={received === '' || Number(received) < total || submitting}
                    onClick={() => finish('efectivo')}>
              {submitting ? 'Cobrando…' : 'Confirmar cobro'}
            </button>
          </>
        )}
        {step === 'qr' && (
          <>
            <h3 className="sheet-title">QR / Transferencia</h3>
            <p className="sheet-sub">Total: <strong>{money(total)} Bs</strong></p>
            <div className="qr-box">
              <div className="qr-fake" aria-hidden="true">
                {Array.from({ length: 144 }).map((_, i) => (
                  <span key={i} style={{ opacity: (i * 73 % 10) > 4 ? 1 : 0 }} />
                ))}
              </div>
              <p>Pendiente: API de pago real.</p>
            </div>
            {error && <p className="caja-error">{error}</p>}
            <button className="btn-gold btn-gold--block" disabled={submitting}
                    onClick={() => finish('qr')}>
              {submitting ? 'Cobrando…' : 'Marcar como pagado'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
