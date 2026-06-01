// imageUtils.js — compresión client-side para reducir bandwidth y costo de Storage.
// El admin sube una foto de celular (3-5 MB) → comprimimos antes a ~80-200 KB.

/**
 * Lee un File, lo redimensiona a maxDim en el lado mayor y lo convierte a JPEG.
 * Devuelve un Blob listo para upload.
 *
 * @param {File} file
 * @param {number} maxDim   ancho/alto máximo del lado mayor en px (default 800)
 * @param {number} quality  calidad JPEG 0..1 (default .85)
 */
export async function compressImage(file, maxDim = 800, quality = 0.85) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Archivo no es una imagen');
  }
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((res, rej) => {
    canvas.toBlob((b) => b ? res(b) : rej(new Error('Falló compresión')),
      'image/jpeg', quality);
  });
  return blob;
}

/** Para preview rápido sin subir. */
export function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}
