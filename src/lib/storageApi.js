// storageApi.js — subida/borrado de imágenes de productos en Supabase Storage.
import { supabase } from './supabase.js';
import { compressImage } from './imageUtils.js';

const BUCKET = 'product-images';

// Sube y devuelve la URL pública. productId va al filename para identificar.
export async function uploadProductImage(productId, file) {
  const blob = await compressImage(file, 800, 0.85);
  // path = productId + timestamp para invalidar caché del navegador
  const path = `${productId}_${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000', // 1 año (URL es única por timestamp)
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// Borra una imagen del bucket dado su URL público.
// Extrae el path después de /product-images/.
export async function deleteProductImageByUrl(url) {
  if (!url) return;
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length).split('?')[0];
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('[storage] no pude borrar imagen vieja:', error.message);
}
