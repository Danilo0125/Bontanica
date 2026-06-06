// PaymentSheet.jsx — bottom-sheet de cobro (tema blanco).
// Emite onConfirm con { method, received_amount } y deja al caller la persistencia.
import { useEffect, useState } from 'react';
import { money } from '../../lib/format.js';
import { Banknote, Smartphone, AlertTriangle, Leaf } from '../../lib/icons.jsx';

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
  const [step, setStep] = useState('choose');
  const [received, setReceived] = useState('');
  const qrAvailable = useQrAvailability();

  const change = step === 'efectivo' && received !== '' ? Number(received) - total : null;
  const quick = [total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100]
    .filter((v, i, a) => a.indexOf(v) === i);

  const confirm = (method) => {
    if (submitting) return;
    onConfirm({
      method,
      received_amount: method === 'efectivo' ? Number(received) : null,
    });
  };

  return (
    <div className="s-scrim" onClick={() => !submitting && onClose()}>
      <div className="s-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="s-grip" />
        {step === 'choose' && (
          <>
            <h3 className="s-title">Cobrar {money(total)} Bs</h3>
            {contextLabel && <p className="s-sheet-sub">{contextLabel} · elegí el método de pago</p>}
            <div className="pay-methods">
              <button className="pay-opt" onClick={() => setStep('efectivo')}>
                <span className="pay-ico"><Banknote size={26} strokeWidth={1.6} /></span><span>Efectivo</span>
              </button>
              <button className="pay-opt" onClick={() => setStep('qr')}>
                <span className="pay-ico"><Smartphone size={26} strokeWidth={1.6} /></span><span>QR / Transferencia</span>
              </button>
            </div>
          </>
        )}
        {step === 'efectivo' && (
          <>
            <h3 className="s-title">Efectivo</h3>
            <p className="s-sheet-sub">Total a cobrar: <strong>{money(total)} Bs</strong></p>
            <label className="field">
              <span>¿Con cuánto paga?</span>
              <input type="number" inputMode="numeric" value={received} autoFocus placeholder="0"
                     onChange={(e) => setReceived(e.target.value)} />
            </label>
            {change !== null && received !== '' && (
              <div className={`vuelto ${change < 0 ? 'neg' : ''}`}>
                {change < 0 ? `Faltan ${money(Math.abs(change))} Bs` : `Vuelto: ${money(change)} Bs`}
              </div>
            )}
            <div className="quick-cash">
              {quick.map((v) => (
                <button key={v} onClick={() => setReceived(String(v))}>{money(v)}</button>
              ))}
            </div>
            <button className="btn-primary"
                    disabled={received === '' || Number(received) < total || submitting}
                    onClick={() => confirm('efectivo')}>
              {submitting ? 'Cobrando…' : 'Confirmar y enviar a cocina'}
            </button>
          </>
        )}
        {step === 'qr' && (
          <>
            <h3 className="s-title">Pago con QR</h3>
            {contextLabel && <p className="s-sheet-sub">{contextLabel}</p>}
            <div className="qr-box">
              <div className="qr-amount">
                <strong>{money(total)}</strong><span>Bs</span>
              </div>
              {qrAvailable === null && <p style={{ fontSize: 12.5 }}>Cargando QR…</p>}
              {qrAvailable === true && (
                <>
                  <div className="qr-card">
                    <div className="qr-card-head">
                      <Leaf size={14} strokeWidth={1.8} aria-hidden="true" /> Botánica
                    </div>
                    <img className="qr-img" src={QR_PATH} alt="QR de pago de Botánica" />
                    <div className="qr-card-foot">
                      <b>Luz Selina Orozco Gonzales</b>
                      <span>Cuenta receptora · Botánica RestoBar</span>
                    </div>
                  </div>
                  <p className="qr-tip">
                    El cliente escanea con <b>Yape</b> y muestra el comprobante. Verificá el monto
                    antes de confirmar.
                  </p>
                </>
              )}
              {qrAvailable === false && (
                <div className="qr-pending">
                  <span className="qr-pending-icon" aria-hidden="true">
                    <AlertTriangle size={28} strokeWidth={1.7} />
                  </span>
                  <strong>QR aún no configurado</strong>
                  <p>Mostrá el QR impreso del banco y verificá el comprobante.<br/>
                  <small>Para automatizarlo: guardar PNG en <code>public/assets/qr-pago.png</code>.</small></p>
                </div>
              )}
            </div>
            <button
              className="btn-primary"
              disabled={submitting || qrAvailable === false}
              onClick={() => confirm('qr')}
              title={qrAvailable === false ? 'Subí primero el QR del banco' : undefined}
            >
              {submitting
                ? 'Cobrando…'
                : qrAvailable === false
                  ? 'Configurá el QR primero'
                  : 'Confirmar pago recibido'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
