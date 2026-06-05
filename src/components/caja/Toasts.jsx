// Toasts.jsx — sistema global de notificaciones.
// Provider + hook useToast(). Renderizado a nivel App, no por-vista,
// para que las notificaciones sigan visibles aunque cambies de ruta.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastCtx = createContext(null);

let _id = 0;
const nextId = () => ++_id;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
    const tm = timersRef.current.get(id);
    if (tm) { clearTimeout(tm); timersRef.current.delete(id); }
  }, []);

  const push = useCallback((toast) => {
    const id = nextId();
    const t = { id, ...toast };
    setToasts((arr) => [...arr, t]);
    if (t.duration !== 0) { // 0 = sticky
      const tm = setTimeout(() => dismiss(id), t.duration ?? 5000);
      timersRef.current.set(id, tm);
    }
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
  }, []);

  const value = useMemo(() => ({
    push,
    dismiss,
    success: (message, opts) => push({ kind: 'success', message, ...opts }),
    error:   (message, opts) => push({ kind: 'error', message, ...opts }),
    info:    (message, opts) => push({ kind: 'info', message, ...opts }),
    ready:   (message, opts) => push({ kind: 'ready', message, duration: 0, ...opts }), // sticky por default
  }), [push, dismiss]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-live="polite" aria-label="Notificaciones">
        {toasts.map((t) => {
          const clickable = typeof t.onClick === 'function';
          const handleClick = clickable ? () => { t.onClick(); dismiss(t.id); } : undefined;
          return (
            <div
              key={t.id}
              className={`toast toast--${t.kind ?? 'info'}${clickable ? ' is-clickable' : ''}`}
              role={clickable ? 'button' : 'status'}
              tabIndex={clickable ? 0 : undefined}
              onClick={handleClick}
              onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
            >
              {t.icon && <span className="toast-icon" aria-hidden="true">{t.icon}</span>}
              <div className="toast-body">
                {t.title && <strong className="toast-title">{t.title}</strong>}
                <span className="toast-msg">{t.message}</span>
                {clickable && <span className="toast-hint">Tocá para ver la mesa →</span>}
              </div>
              {t.action && (
                <button
                  className="toast-action"
                  onClick={(e) => { e.stopPropagation(); t.action.onClick?.(); dismiss(t.id); }}
                >
                  {t.action.label}
                </button>
              )}
              <button
                className="toast-close"
                onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
                aria-label="Cerrar"
              >×</button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
