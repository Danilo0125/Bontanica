// PaymentSheet.jsx — bottom-sheet de cobro. Reusable: emite onConfirm con
// { method, received_amount } y deja que el caller haga la persistencia.
import { useEffect, useState } from 'react';
import { money } from '../../lib/format.js';

const QR_PATH = '/assets/qr-pago.png';
function useQrAvailability() {
  const [available, setAvailable] = useState(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setAvailable(true);
    img.onerror = () => setAvailable(false);
    img.src = QR_PATH;
  }, []);
  return available;
}

export function PaymentSheet({ total, onClose, onConfirm, submitting = false, contextLabel }) {
  const [step, setStep] = useState('choose'); // 'choose' | 'efectivo' | 'qr'
  const [received, setReceived] = useState('');
  const qrAvailable = useQrAvailability();

  const change = step === 'efectivo' && received !== '' ? Number(received) - total : null;

  const confirm = (method) => {
    if (submitting) return;
    onConfirm({
      method,
      received_amount: method === 'efectivo' ? Number(received) : null,
    });
  };

  return (
    <div className="sheet-scrim" onClick={() => !submitting && onClose()}>
      <div className="pay-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {step === 'choose' && (
          <>
            <h3 className="sheet-title">Cobrar {money(total)} Bs</h3>
            {contextLabel && <p className="sheet-sub">{contextLabel}</p>}
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
            <p className="sheet-sub">Total: <strong>{money(total)} Bs</strong></p>
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
            <button className="btn-gold btn-gold--block"
                    disabled={received === '' || Number(received) < total || submitting}
                    onClick={() => confirm('efectivo')}>
              {submitting ? 'Cobrando…' : 'Confirmar cobro'}
            </button>
          </>
        )}
        {step === 'qr' && (
          <>
            <h3 className="sheet-title">QR / Transferencia</h3>
            <p className="sheet-sub">Total: <strong>{money(total)} Bs</strong></p>
            <div className="qr-box">
              {qrAvailable === null && <div className="qr-loading">Cargando QR…</div>}
              {qrAvailable === true && (
                <>
                  <img className="qr-img" src={QR_PATH} alt="QR de pago de Botánica" />
                  <p>Escaneá con tu app del banco y confirmá manualmente abajo.</p>
                </>
              )}
              {qrAvailable === false && (
                <div className="qr-pending">
                  <span className="qr-pending-icon" aria-hidden="true">⚠️</span>
                  <strong>QR aún no configurado</strong>
                  <p>Mostrá el QR impreso del banco y verificá el comprobante.<br/>
                  <small>Para automatizarlo: guardar PNG en <code>public/assets/qr-pago.png</code>.</small></p>
                </div>
              )}
            </div>
            <button className="btn-gold btn-gold--block" disabled={submitting}
                    onClick={() => confirm('qr')}>
              {submitting ? 'Cobrando…' : 'Confirmé el cobro'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
