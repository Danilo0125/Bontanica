// format.js — helpers compartidos de formato.
export const money = (n) => Number(n ?? 0).toLocaleString('es-BO');

export const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
};

export const minutesSince = (iso) => {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
};
