// PwaPrompt.jsx — banner para instalar la app + toast cuando hay nueva versión.
// Solo se muestra en el staff shell (los meseros/cocina/admin son quienes
// se benefician de tener la PWA en pantalla de inicio).
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Leaf, Download, Smartphone } from '../../lib/icons.jsx';

const STORAGE_KEY_DISMISSED = 'botanica_pwa_dismissed';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    window.navigator?.standalone === true
  );
}

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  // SW: prompt de actualización cuando hay nueva versión deployada.
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, _r) { /* opcional: log */ },
    onRegisterError(err) { console.warn('[pwa] sw register error', err); },
  });

  useEffect(() => {
    if (isStandalone()) return; // ya instalada
    if (localStorage.getItem(STORAGE_KEY_DISMISSED) === '1') return;

    // Android / desktop Chrome
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS Safari no soporta beforeinstallprompt — mostramos hint si es iOS y
    // todavía no instaló. Damos unos segundos para no ser intrusivos.
    let iosTimer;
    if (isIos()) {
      iosTimer = setTimeout(() => setShowIosHint(true), 12_000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
      setDeferred(null);
    } else {
      // El usuario rechazó — no insistir esta sesión, pero permitir volver más tarde.
      setShow(false);
    }
  };

  const dismiss = () => {
    setShow(false);
    setShowIosHint(false);
    try { localStorage.setItem(STORAGE_KEY_DISMISSED, '1'); } catch {}
  };

  return (
    <>
      {show && (
        <div className="pwa-banner" role="dialog" aria-label="Instalar app">
          <span className="pwa-banner-ico" aria-hidden="true">
            <Leaf size={26} strokeWidth={1.5} />
          </span>
          <div className="pwa-banner-body">
            <strong>Instalá Botánica</strong>
            <span>Acceso directo desde el cel, sin abrir el navegador.</span>
          </div>
          <button className="pwa-banner-cta" onClick={install}>Instalar</button>
          <button className="pwa-banner-close" onClick={dismiss} aria-label="Ahora no">×</button>
        </div>
      )}

      {showIosHint && (
        <div className="pwa-banner pwa-banner--ios" role="dialog" aria-label="Instalar en iOS">
          <span className="pwa-banner-ico" aria-hidden="true">
            <Smartphone size={26} strokeWidth={1.6} />
          </span>
          <div className="pwa-banner-body">
            <strong>Agregá Botánica a inicio</strong>
            <span>Tocá <b>Compartir</b> y luego <b>Añadir a pantalla de inicio</b>.</span>
          </div>
          <button className="pwa-banner-close" onClick={dismiss} aria-label="Cerrar">×</button>
        </div>
      )}

      {needRefresh && (
        <div className="pwa-banner pwa-banner--update" role="status">
          <span className="pwa-banner-ico" aria-hidden="true">
            <Download size={26} strokeWidth={1.6} />
          </span>
          <div className="pwa-banner-body">
            <strong>Nueva versión disponible</strong>
            <span>Recargá para usar los últimos cambios.</span>
          </div>
          <button className="pwa-banner-cta" onClick={() => updateServiceWorker(true)}>Actualizar</button>
          <button className="pwa-banner-close" onClick={() => setNeedRefresh(false)} aria-label="Después">×</button>
        </div>
      )}
    </>
  );
}
