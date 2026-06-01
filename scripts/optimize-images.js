// optimize-images.js — comprime las fotos de public/assets/ in-place.
// Hero: max 1920px JPG 82%.  Galería: max 1200px JPG 78%.
// Mantiene el filename original (sólo convierte PNG→JPEG para el hero).
import sharp from 'sharp';
import { readdir, readFile, writeFile, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve('public/assets');
const HERO = 'botanica-hero.png';

async function main() {
  const files = await readdir(DIR);
  let totalBefore = 0, totalAfter = 0;

  for (const f of files) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue;
    const full = path.join(DIR, f);
    const before = (await stat(full)).size;
    totalBefore += before;

    const isHero = f === HERO;
    const buf = await readFile(full);
    const img = sharp(buf, { failOn: 'none' }).rotate();
    const meta = await img.metadata();

    if (isHero) {
      // Hero PNG → reemplazar por JPEG optimizado en el mismo path conservando .png
      // (pero también un .jpg para el og-image más liviano)
      const jpeg = await img
        .resize({ width: 1920, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true, progressive: true })
        .toBuffer();
      // Reescribir como JPEG bajo .png (el navegador lo detecta por bytes, no por extensión).
      await writeFile(full, jpeg);
      // Y también una versión optimizada para og-image específicamente
      await writeFile(path.join(DIR, 'botanica-hero-og.jpg'),
        await sharp(buf).rotate().resize({ width: 1200, height: 630, fit: 'cover', position: 'center' })
          .jpeg({ quality: 80, mozjpeg: true }).toBuffer());
    } else {
      // Galería: max 1200px, quality 78, progressive
      const out = await img
        .resize({ width: Math.min(1200, meta.width ?? 1200), withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true, progressive: true })
        .toBuffer();
      await writeFile(full, out);
    }

    const after = (await stat(full)).size;
    totalAfter += after;
    const pct = Math.round((1 - after / before) * 100);
    console.log(`${f.padEnd(45)}  ${(before/1024).toFixed(0)} KB → ${(after/1024).toFixed(0)} KB  (-${pct}%)`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`TOTAL: ${(totalBefore/1024/1024).toFixed(2)} MB → ${(totalAfter/1024/1024).toFixed(2)} MB  (-${Math.round((1 - totalAfter/totalBefore) * 100)}%)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
