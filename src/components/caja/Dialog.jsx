// Dialog.jsx — sistema global de confirmaciones e inputs.
// Reemplaza window.confirm() y window.prompt() (que congelan la PWA y
// rompen el flujo de auth de Supabase).
//
// Uso:
//   const dialog = useDialog();
//   const ok = await dialog.confirm({ title, message, confirmLabel, confirmKind });
//   const text = await dialog.prompt({ title, message, placeholder, defaultValue });
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from '../../lib/icons.jsx';

const DialogCtx = createContext(null);

let _id = 0;
const nextId = () => ++_id;

export function DialogProvider({ children }) {
  const [items, setItems] = useState([]); // pila por si abren varios encadenados
  const resolversRef = useRef(new Map());

  const open = useCallback((kind, opts) => {
    return new Promise((resolve) => {
      const id = nextId();
      resolversRef.current.set(id, resolve);
      setItems((arr) => [...arr, { id, kind, ...opts }]);
    });
  }, []);

  const close = useCallback((id, result) => {
    const r = resolversRef.current.get(id);
    if (r) { r(result); resolversRef.current.delete(id); }
    setItems((arr) => arr.filter((d) => d.id !== id));
  }, []);

  const api = {
    confirm: (opts) => open('confirm', opts),
    prompt:  (opts) => open('prompt',  opts),
  };

  return (
    <DialogCtx.Provider value={api}>
      {children}
      {items.map((d) => (
        <DialogHost key={d.id} dialog={d} close={close} />
      ))}
    </DialogCtx.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogCtx);
  if (!ctx) throw new Error('useDialog debe usarse dentro de <DialogProvider>');
  return ctx;
}

function DialogHost({ dialog, close }) {
  const { id, kind, title, message, confirmLabel, cancelLabel, confirmKind,
          placeholder, defaultValue = '', inputType = 'text', minLength = 0 } = dialog;
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);
  const isPrompt = kind === 'prompt';
  const isDanger = confirmKind === 'danger';

  // Focus input cuando abre el prompt + Escape cierra
  useEffect(() => {
    if (isPrompt) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isPrompt]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close(id, isPrompt ? null : false);
      if (e.key === 'Enter' && isPrompt) {
        e.preventDefault();
        if (value.length >= minLength) close(id, value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, isPrompt, value, minLength, close]);

  const ok = () => {
    if (isPrompt) {
      if (value.length < minLength) return;
      close(id, value);
    } else {
      close(id, true);
    }
  };
  const cancel = () => close(id, isPrompt ? null : false);

  return (
    <div className="s-scrim" onClick={cancel} role="presentation">
      <div className="s-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="s-grip" />
        <h3 className="s-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDanger && <AlertTriangle size={20} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--s-crit)' }} />}
          {title}
        </h3>
        {message && <p className="s-sheet-sub">{message}</p>}
        {isPrompt && (
          <label className="field" style={{ marginTop: 4 }}>
            <input
              ref={inputRef}
              type={inputType}
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              style={{ width: '100%' }}
            />
          </label>
        )}
        <div className="confirm-actions">
          <button type="button" className="btn-ghost" onClick={cancel}>
            {cancelLabel ?? (isPrompt ? 'Cancelar' : 'Volver')}
          </button>
          <button
            type="button"
            className={isDanger ? 'btn-danger' : 'btn-primary'}
            style={{ width: 'auto', padding: '8px 16px' }}
            disabled={isPrompt && value.length < minLength}
            onClick={ok}
          >
            {confirmLabel ?? (isPrompt ? 'Guardar' : 'Sí')}
          </button>
        </div>
      </div>
    </div>
  );
}
