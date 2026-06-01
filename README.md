# Botánica · RestoBar — sitio web

Página mobile-first animada: catálogo, galería, ubicación, reservas por WhatsApp
y módulo de **Caja (comandas por mesa)**.

Construido con **Vite + React 18**.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173 con hot reload
npm run build    # genera dist/
npm run preview  # sirve dist/ para verificar el build
```

## Publicar en Vercel

`vercel.json` ya configura `buildCommand` y `outputDirectory`. Solo:

1. Sube el repo a GitHub e importa en https://vercel.com → *Add New → Project*.
2. O desde la CLI:
   ```bash
   npm i -g vercel
   vercel        # primera vez
   vercel --prod # producción
   ```

## Dónde editar qué

- **Menú, precios, datos del local (WhatsApp, Maps, fecha de evento):** `src/data/data.js`.
- **Imagen hero:** `public/assets/botanica-hero.png` (reemplaza el archivo, mantén el nombre).
- **Galería:** las fotos que arrastres a los recuadros `<image-slot>` se guardan en un sidecar local; llénalas antes de desplegar.
- **Estilo y atmósfera:** panel de Tweaks en la propia página o `src/styles/styles.css`.

## Notas

- **WhatsApp:** el número está en `src/data/data.js` (campo `whatsapp`, formato internacional sin "+", ej. `59170000000`).
- **Caja:** el estado vive en memoria — al refrescar se pierde la sesión.
