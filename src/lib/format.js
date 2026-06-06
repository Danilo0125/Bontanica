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

// Nombre completo de un order_item incluyendo sabor / mitad-mitad.
// "Pizza Familiar"                     — sin sabor
// "Pizza Familiar · Hawaiana"          — un sabor
// "Pizza Familiar · ½ Hawaiana / ½ Cuatro Quesos" — mitad-mitad
export const formatItemName = (it) => {
  if (!it) return '';
  const base = it.product_name_snapshot ?? '';
  const f1 = it.flavor_name_snapshot;
  const f2 = it.flavor_name_snapshot_2;
  if (f1 && f2) return `${base} · ½ ${f1} / ½ ${f2}`;
  if (f1) return `${base} · ${f1}`;
  return base;
};

export const isSplitItem = (it) => Boolean(it?.flavor_name_snapshot_2);
