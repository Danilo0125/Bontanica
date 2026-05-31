# Botánica · Resto Bar — sitio web

Página mobile-first animada: catálogo, galería, ubicación, reservas por WhatsApp
y módulo de **Caja (comandas por mesa)**.

Es un sitio **100% estático** (HTML/CSS/JS). No necesita build ni servidor.

## Publicar en Vercel

### Opción A — Arrastrar y soltar (más fácil)
1. Entra a https://vercel.com y crea una cuenta (gratis).
2. Click en **Add New… → Project → Deploy** y, cuando pida el código,
   arrastra **esta carpeta completa** (`dist/`) a la zona de carga.
   - Si te pregunta por un *Framework Preset*, elige **Other**.
   - *Build Command*: déjalo vacío. *Output Directory*: déjalo vacío (raíz).
3. Click **Deploy**. En ~20 segundos tendrás tu URL `…vercel.app`.

### Opción B — Vercel CLI
```bash
npm i -g vercel
cd dist
vercel        # sigue las preguntas; acepta los valores por defecto
vercel --prod # para publicarlo en producción
```

## Notas
- **Galería:** las fotos que arrastres a los recuadros se guardan dentro del
  proyecto. Llénalas *antes* de descargar/desplegar para que aparezcan publicadas.
- **WhatsApp:** edita el número en `data.jsx` (campo `whatsapp`, formato
  internacional sin "+", ej. `59170000000`).
- **Precios:** son referenciales. Edítalos en `data.jsx`.
- **Mapa:** el botón "Abrir en Google Maps" usa el link de `data.jsx` (`mapsUrl`).
