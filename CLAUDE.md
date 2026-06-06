# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mobile-first landing page for **Botánica · RestoBar** (Cochabamba, Bolivia) + **Caja interna** (módulo POS para el evento del 6-jun-2026).

- Pública (`/`): hero con countdown, carta dinámica, galería, mapa, reservas por WhatsApp.
- Caja (`/caja/*`): rutas protegidas para Ochito y Nath. Tomar pedidos en la mesa → enviar a cocina → cocina marca listo → mesero cobra. Todo persistido en Supabase y sincronizado en vivo entre dispositivos.

Stack: **Vite + React 18 + React Router 7 + Supabase (Postgres + Realtime) + Leaflet**.

## Comandos

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/
npm run preview    # sirve dist/
```

## Variables de entorno

Copiar `.env.example` → `.env` (gitignored) y completar:

```
VITE_SUPABASE_URL=https://wemyyuujnvqllmzwpozg.supabase.co
VITE_SUPABASE_ANON_KEY=<sacar del dashboard de Supabase, Settings → API>
```

En Vercel: agregar las dos vars en Environment Variables del proyecto.

## Estructura

```
/
├── index.html
├── vite.config.js
├── vercel.json           # SPA rewrites + build
├── supabase/seed.sql     # esquema + RLS + realtime + datos iniciales
├── public/                # estáticos (favicon, hero, galería)
└── src/
    ├── main.jsx
    ├── App.jsx            # BrowserRouter + Routes
    ├── data/data.js       # solo VENUE (carta/mesas viven en Supabase)
    ├── styles/styles.css
    ├── lib/
    │   ├── supabase.js          # cliente único
    │   ├── cajaSession.js       # password gate + sesión localStorage
    │   ├── format.js            # money(), formatTime()
    │   ├── useProducts.js       # carga products de Supabase
    │   ├── useTables.js         # carga tables_pos
    │   ├── useOrders.js         # órdenes abiertas + realtime
    │   └── orderApi.js          # wrappers (get/create/add/markReady/pay/cancel)
    └── components/
        ├── PublicLayout.jsx     # shell público (hero, scroll, bottom-nav)
        ├── Hero.jsx / Catalog.jsx / Sections.jsx / ui.jsx
        └── caja/
            ├── CajaGate.jsx         # password + selector Ochito/Nath
            ├── ProtectedRoute.jsx
            ├── CajaLayout.jsx       # header común + switch mesero/cocina
            ├── MeseroView.jsx       # grilla 18 mesas con totales en vivo
            ├── MeseroTableDetail.jsx# detalle de mesa: batches + draft + cobrar
            ├── ProductPicker.jsx
            ├── PaymentSheet.jsx     # cobro efectivo / QR
            └── CocinaView.jsx       # cola de tandas pendientes, realtime
```

## Modelo de datos (Supabase)

5 tablas. Toda la verdad fluye de aquí:

- `products` — la carta. PK `text` (slugs: `mojito-vaso`, etc.). Editable solo desde dashboard.
- `tables_pos` — 18 mesas (id 1..18). Activación/desactivación desde dashboard.
- `servers` — Ochito y Nath (id `text`).
- `orders` — una orden viva por mesa con `status='open'`. Unique partial index sobre `(table_id) WHERE status='open'` garantiza máximo una cuenta abierta por mesa.
- `order_items` — cada producto agregado es una fila. Items enviados en un mismo "Enviar a cocina" comparten `batch_id`. Cocina marca por batch (`UPDATE ... WHERE batch_id=X SET status='ready'`).

Realtime publication habilitada en `orders` y `order_items`.

### Flujo de pedido

1. Mesero entra a `/caja/mesero/5` → `getOrCreateOpenOrder(5, server)` (idempotente).
2. Agrega productos al **draft local** (estado React, no DB).
3. Toca "Enviar a cocina" → `addItemsToOrder` inserta las filas con un `batch_id` nuevo.
4. Cocina (otra pestaña, otro dispositivo) ve la card aparecer por Realtime.
5. Cocina toca "Listo" → `markBatchReady` actualiza status del batch a `ready`.
6. Mesero ve badge "✓ Listo" en la tanda. Repite hasta que cierre.
7. Mesero toca "Cobrar" → `PaymentSheet` → `payOrder` (status → `paid`, `paid_at`).
8. Mesa vuelve a libre. La orden histórica queda en DB para futuras consultas.

## Seguridad — la verdad honesta

**Protegido (RLS):**
- DELETE imposible en todas las tablas desde el cliente.
- Precios no manipulables: `order_items_insert` valida `unit_price_snapshot = (SELECT price FROM products WHERE id = product_id)`.
- UPDATE de productos/mesas imposible desde el cliente (solo dashboard con service role).
- Una orden `paid` no se puede revertir a `open` (policy `using (status='open')` en orders_update).

**No protegido:**
- El password `87654321` vive en el bundle (`src/lib/cajaSession.js` constante `CAJA_PASSWORD`). Es un freno social, no de seguridad.
- La `anon key` es pública por diseño. Cualquiera con DevTools puede invocar lo que RLS permita.
- No hay auditoría granular: solo se firma `server_id` al agregar items y al abrir orden. Cambios de status en Cocina no quedan firmados todavía.

**Migración recomendada (no ahora):** Supabase Auth con magic link a 2 emails (Ochito@…, Nath@…) y RLS por `auth.uid()`. ~1 día de trabajo.

## Setup inicial de la DB

Si la DB está vacía:

1. Abrí Supabase Dashboard → SQL Editor.
2. Pegá el contenido de `supabase/seed.sql` y ejecutá. Es idempotente — se puede correr varias veces sin romper.
3. Verificá: `SELECT id, name, price FROM products;` debe devolver 8 filas.
4. Verificá Realtime: Dashboard → Database → Replication → `supabase_realtime` debe incluir `orders` y `order_items`.

Si tenés Supabase MCP conectado en Claude Code, se puede aplicar también con `mcp__supabase__*` tools.

## Deploy

Vercel ya tiene `buildCommand` y `outputDirectory` configurados. Agregar las dos env vars `VITE_SUPABASE_*` en el dashboard de Vercel. Push y deploy automático.

## Pendientes (TODO)

- **Redes sociales reales** (`src/data/data.js` → `VENUE.ig`, `VENUE.fb`).
- **QR de pago real** (`src/components/caja/PaymentSheet.jsx`): hoy es un patrón decorativo. Reemplazar por PNG estático del QR del banco o integrar API.
- **Auditoría de Cocina**: agregar `updated_by` en `order_items` para registrar quién marcó cada batch.
- **Hero post-evento**: después del 6-jun-2026 el countdown muestra "Estamos abiertos" indefinidamente.
- **OG image optimizada**: `botanica-hero.png` pesa 2.8 MB.
- **Code-splitting**: el bundle JS está por sobre 500 KB. Si pesa, lazy-loadear `/caja/*` con `React.lazy`.
- **Supabase Auth real**: ver sección de seguridad.
