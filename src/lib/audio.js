// audio.js — beeps sintetizados con Web Audio API.
// No requiere archivos. Distintos tonos por evento operativo.
const TONES = {
  new:       [880, 660],          // tanda nueva (cocina) — alegre, descendente
  change:    [523, 392, 523],     // cambio — C5 G4 C5
  cancel:    [440, 330],          // cancelación — A4 E4 (grave)
  delivered: [659, 784, 1047],    // ¡listo para entregar! (mesero) — E5 G5 C6 ascendente, optimista
  error:     [220, 220],          // error / red — A3 A3 monótono
};

const STORAGE_KEY = 'botanica_audio_on';

export function isAudioOn() {
  try { return localStorage.getItem(STORAGE_KEY) !== 'off'; }
  catch { return true; }
}
export function setAudioOn(on) {
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch {}
}

let sharedCtx = null;
export function ensureAudioCtx() {
  try {
    sharedCtx = sharedCtx ?? new (window.AudioContext || window.webkitAudioContext)();
    if (sharedCtx.state === 'suspended') sharedCtx.resume();
    return sharedCtx;
  } catch { return null; }
}

export function playBeep(kind = 'new') {
  if (!isAudioOn()) return;
  try {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const tones = TONES[kind] ?? TONES.new;
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.14);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.4);
    });
  } catch { /* navegador sin Web Audio o autoplay bloqueado */ }
}
