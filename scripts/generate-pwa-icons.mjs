// scripts/generate-pwa-icons.mjs — genera los iconos PWA desde un SVG inline.
// Uso: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');
await mkdir(PUBLIC, { recursive: true });

const BG = '#080b06';
const GOLD_DARK = '#d8b56a';
const GOLD_LIGHT = '#f0d99a';

// Icono principal: hoja estilizada centrada, tipo botánico.
function iconSvg({ size = 512, padding = 0 } = {}) {
  const inner = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = inner * 0.42;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${cx}, ${cy})">
    <path d="M 0 ${-r}
             C ${-r * 0.55} ${-r * 0.55}, ${-r * 0.95} ${-r * 0.15}, ${-r * 0.85} ${r * 0.4}
             C ${-r * 0.7} ${r * 0.85}, ${-r * 0.3} ${r * 1.0}, 0 ${r * 0.95}
             C ${r * 0.3} ${r * 1.0}, ${r * 0.7} ${r * 0.85}, ${r * 0.85} ${r * 0.4}
             C ${r * 0.95} ${-r * 0.15}, ${r * 0.55} ${-r * 0.55}, 0 ${-r} Z"
          fill="none" stroke="${GOLD_DARK}" stroke-width="${size * 0.025}" stroke-linejoin="round"/>
    <path d="M 0 ${-r * 0.9} L 0 ${r * 0.92}"
          stroke="${GOLD_LIGHT}" stroke-width="${size * 0.022}" stroke-linecap="round" opacity="0.9"/>
    <path d="M 0 ${-r * 0.3} C ${-r * 0.3} ${-r * 0.1}, ${-r * 0.55} ${r * 0.15}, ${-r * 0.7} ${r * 0.5}"
          stroke="${GOLD_LIGHT}" stroke-width="${size * 0.02}" stroke-linecap="round" opacity="0.85" fill="none"/>
    <path d="M 0 ${-r * 0.3} C ${r * 0.3} ${-r * 0.1}, ${r * 0.55} ${r * 0.15}, ${r * 0.7} ${r * 0.5}"
          stroke="${GOLD_LIGHT}" stroke-width="${size * 0.02}" stroke-linecap="round" opacity="0.85" fill="none"/>
    <path d="M 0 ${r * 0.2} C ${-r * 0.2} ${r * 0.4}, ${-r * 0.35} ${r * 0.7}, ${-r * 0.4} ${r * 0.85}"
          stroke="${GOLD_LIGHT}" stroke-width="${size * 0.018}" stroke-linecap="round" opacity="0.75" fill="none"/>
    <path d="M 0 ${r * 0.2} C ${r * 0.2} ${r * 0.4}, ${r * 0.35} ${r * 0.7}, ${r * 0.4} ${r * 0.85}"
          stroke="${GOLD_LIGHT}" stroke-width="${size * 0.018}" stroke-linecap="round" opacity="0.75" fill="none"/>
  </g>
</svg>`;
}

// any-purpose (bordes redondeados visibles, sin necesidad de safe-zone amplio)
const any192 = iconSvg({ size: 192 });
const any512 = iconSvg({ size: 512 });

// maskable: el contenido debe vivir dentro del círculo central (80% del canvas),
// el fondo full-bleed. Generamos a 512 con padding extra.
const maskable512 = iconSvg({ size: 512, padding: 64 });

const apple180 = iconSvg({ size: 180 });

async function write(name, svg, size) {
  const buf = Buffer.from(svg);
  await sharp(buf, { density: 600 })
    .resize(size, size, { fit: 'contain', background: BG })
    .png({ compressionLevel: 9 })
    .toFile(resolve(PUBLIC, name));
  console.log('✓', name, `(${size}px)`);
}

await write('pwa-192.png', any192, 192);
await write('pwa-512.png', any512, 512);
await write('pwa-maskable-512.png', maskable512, 512);
await write('apple-touch-icon.png', apple180, 180);

console.log('\nDone. Iconos en public/');
